import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { Question, QuestionFlag, WellnessCategory, QuestionLifecycleStatus, QuestionAuditLog } from '../types/domain';
import { createSupabaseAdminClient } from '../lib/supabase/server';

export interface QuestionWithNames extends Question {
  author_name?: string | null;
  reviewer_name?: string | null;
  activator_name?: string | null;
  audit_logs?: QuestionAuditLog[];
}

export interface ClinicianQueueCounts {
  myDrafts: number;
  awaitingMyReview: number;
  flagged: number;
  active: number;
}

export function deriveQuestionStatus(q: Partial<Question>): QuestionLifecycleStatus {
  if (q.status && ['draft', 'peer_review', 'revision_requested', 'peer_approved', 'regional_review', 'regional_revision_requested', 'regionally_approved', 'active', 'archived'].includes(q.status)) {
    return q.status as QuestionLifecycleStatus;
  }
  if (q.active) return 'active';
  if (q.activated_at) return 'regionally_approved';
  if (q.clinical_reviewed_at) {
    return (q.review_notes && q.review_notes !== '[PEER_REVIEW]') ? 'regional_revision_requested' : 'peer_approved';
  }
  if (q.review_notes === '[PEER_REVIEW]') return 'peer_review';
  if (q.review_notes) return 'revision_requested';
  return 'draft';
}

/** Batches a profiles.full_name lookup for a set of ids and merges it onto rows. */
async function attachNames(
  supabase: SupabaseClient<Database>,
  rows: Question[]
): Promise<QuestionWithNames[]> {
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.authored_by) ids.add(r.authored_by);
    if (r.clinical_reviewed_by) ids.add(r.clinical_reviewed_by);
    if (r.activated_by) ids.add(r.activated_by);
  }
  if (ids.size === 0) return rows as QuestionWithNames[];

  const { data: profileRows } = await (supabase.from('profiles') as any)
    .select('id, full_name')
    .in('id', Array.from(ids));

  const nameMap = new Map<string, string>((profileRows || []).map((p: any) => [p.id, p.full_name]));

  return rows.map((r) => ({
    ...r,
    status: deriveQuestionStatus(r),
    version: r.version || 1,
    author_name: r.authored_by ? nameMap.get(r.authored_by) || null : null,
    reviewer_name: r.clinical_reviewed_by ? nameMap.get(r.clinical_reviewed_by) || null : null,
    activator_name: r.activated_by ? nameMap.get(r.activated_by) || null : null,
  }));
}

const MEMORY_AUDIT_LOGS = new Map<string, QuestionAuditLog[]>();

/** Record a governance audit event in public.question_audit_logs with in-memory fallback */
export async function recordQuestionAuditLog(
  supabase: SupabaseClient<Database>,
  questionId: string,
  actorId: string | null,
  action: string,
  notes?: string | null
): Promise<void> {
  const entry: QuestionAuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    question_id: questionId,
    actor_id: actorId,
    action,
    notes: notes || null,
    created_at: new Date().toISOString(),
  };

  if (!MEMORY_AUDIT_LOGS.has(questionId)) {
    MEMORY_AUDIT_LOGS.set(questionId, []);
  }
  MEMORY_AUDIT_LOGS.get(questionId)!.push(entry);

  try {
    await (supabase.from('question_audit_logs') as any).insert({
      question_id: questionId,
      actor_id: actorId,
      action,
      notes: notes || null,
      created_at: entry.created_at,
    });
  } catch (err) {
    // Graceful fallback to memory log
  }
}

/** Fetch governance audit history for a specific question */
export async function getQuestionAuditHistory(
  supabase: SupabaseClient<Database>,
  questionId: string
): Promise<QuestionAuditLog[]> {
  try {
    const { data, error } = await (supabase.from('question_audit_logs') as any)
      .select('*')
      .eq('question_id', questionId)
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) return data as QuestionAuditLog[];
  } catch (err) {
    // Fallthrough to memory
  }

  return MEMORY_AUDIT_LOGS.get(questionId) || [];
}

export async function getClinicianQueueCounts(
  supabase: SupabaseClient<Database>,
  clinicianId: string
): Promise<ClinicianQueueCounts> {
  const adminClient = createSupabaseAdminClient();
  const [drafts, review, flagged, active] = await Promise.all([
    (adminClient.from('questions') as any)
      .select('id', { count: 'exact', head: true })
      .eq('authored_by', clinicianId)
      .is('clinical_reviewed_at', null),
    (adminClient.from('questions') as any)
      .select('id', { count: 'exact', head: true })
      .neq('authored_by', clinicianId)
      .is('clinical_reviewed_at', null),
    (adminClient.from('question_flags') as any)
      .select('id', { count: 'exact', head: true })
      .is('resolved_at', null),
    (adminClient.from('questions') as any)
      .select('id', { count: 'exact', head: true })
      .eq('active', true),
  ]);

  return {
    myDrafts: drafts.count || 0,
    awaitingMyReview: review.count || 0,
    flagged: flagged.count || 0,
    active: active.count || 0,
  };
}

/** Questions authored by clinician — drafts, revision requests, or in review */
export async function getMyDraftQuestions(
  supabase: SupabaseClient<Database>,
  clinicianId: string
): Promise<QuestionWithNames[]> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await (adminClient.from('questions') as any)
    .select('*, options:question_options(*)')
    .eq('authored_by', clinicianId)
    .eq('active', false)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return attachNames(supabase, data as Question[]);
}

/** Questions authored by other clinicians awaiting peer review */
export async function getPendingReviewQuestions(
  supabase: SupabaseClient<Database>,
  clinicianId: string
): Promise<QuestionWithNames[]> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await (adminClient.from('questions') as any)
    .select('*, options:question_options(*)')
    .neq('authored_by', clinicianId)
    .is('clinical_reviewed_at', null)
    .eq('active', false)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  const withNames = await attachNames(supabase, data as Question[]);
  return withNames.filter((q) => q.status !== 'peer_approved' && q.status !== 'active' && q.status !== 'regionally_approved');
}

export async function getQuestionForReview(
  supabase: SupabaseClient<Database>,
  questionId: string
): Promise<QuestionWithNames | null> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await (adminClient.from('questions') as any)
    .select('*, options:question_options(*)')
    .eq('id', questionId)
    .single();

  if (error || !data) return null;
  const [withNames] = await attachNames(supabase, [data as Question]);
  const logs = await getQuestionAuditHistory(supabase, questionId);
  return { ...withNames, audit_logs: logs };
}

export interface ClinicianQuestionInput {
  question_code: string;
  week_number: number;
  text: string;
  category: WellnessCategory;
  target_department?: string;
  depth_level?: 'light' | 'moderate' | 'deep';
  is_base_question?: boolean;
  region_id?: string;
  recommendation_title?: string;
  recommendation_description?: string;
  task_title?: string;
  task_description?: string;
  estimated_minutes?: number;
  credits_awarded?: number;
}

export interface ClinicianOptionInput {
  option_code?: string;
  label: string;
  score: number;
  order_index?: number;
}

/** Clinician A: Create a new clinical question & recommendation mapping */
export async function createClinicianQuestion(
  supabase: SupabaseClient<Database>,
  clinicianId: string,
  input: ClinicianQuestionInput,
  options: ClinicianOptionInput[]
): Promise<{ success: boolean; question?: Question; error?: string }> {
  try {
    // 1. Validation
    if (!input.text || input.text.trim().length === 0) {
      return { success: false, error: 'Question text cannot be empty.' };
    }
    if (!input.category) {
      return { success: false, error: 'Category is required.' };
    }
    if (!options || options.length < 2) {
      return { success: false, error: 'At least two answer options are required.' };
    }

    // Check for duplicate option labels
    const labels = options.map((o) => o.label.trim().toLowerCase());
    const uniqueLabels = new Set(labels);
    if (uniqueLabels.size !== labels.length) {
      return { success: false, error: 'Answer options must have unique labels.' };
    }

    // Validate score ranges (0 to 10)
    for (const opt of options) {
      if (typeof opt.score !== 'number' || opt.score < 0 || opt.score > 10) {
        return { success: false, error: 'Option scores must be valid numbers between 0 and 10.' };
      }
    }

    // 2. Insert into public.questions
    const questionCode = input.question_code || `Q-${Math.floor(100 + Math.random() * 900)}`;
    const { data: newQ, error: qError } = await (supabase.from('questions') as any)
      .insert({
        question_code: questionCode,
        text: input.text.trim(),
        category: input.category,
        question_type: 'single_choice',
        weight: 1.0,
        active: false,
        order_index: input.week_number || 1,
        is_base_question: input.is_base_question ?? false,
        week_number: input.week_number || 1,
        target_department: input.region_id || input.target_department || 'ALL',
        depth_level: input.depth_level || 'moderate',
        authored_by: clinicianId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (qError || !newQ) {
      return { success: false, error: qError?.message || 'Failed to insert question.' };
    }

    // 3. Insert question options
    const optionRows = options.map((opt, idx) => ({
      question_id: newQ.id,
      option_code: opt.option_code || `${questionCode}_OPT_${idx + 1}`,
      label: opt.label.trim(),
      score: opt.score,
      order_index: opt.order_index ?? idx + 1,
      signal_value: opt.score,
    }));

    const { error: optError } = await (supabase.from('question_options') as any).insert(optionRows);
    if (optError) {
      return { success: false, error: optError.message };
    }

    // 4. Log audit event
    await recordQuestionAuditLog(supabase, newQ.id, clinicianId, 'QUESTION_CREATED', 'Authored new clinical question v1.');

    const createdQuestion: Question = {
      ...newQ,
      status: 'draft',
      version: 1,
    };

    return { success: true, question: createdQuestion };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unexpected error creating question.' };
  }
}

/** Submit draft question for peer review */
export async function submitQuestionForPeerReview(
  supabase: SupabaseClient<Database>,
  questionId: string,
  clinicianId: string
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createSupabaseAdminClient();
  const { data: q } = await (adminClient.from('questions') as any).select('authored_by').eq('id', questionId).single();
  if (!q) return { success: false, error: 'Question not found.' };

  const { error } = await (adminClient.from('questions') as any)
    .update({
      review_notes: '[PEER_REVIEW]',
      updated_at: new Date().toISOString(),
    })
    .eq('id', questionId);

  if (error) return { success: false, error: error.message };

  await recordQuestionAuditLog(supabase, questionId, clinicianId, 'QUESTION_SUBMITTED_FOR_PEER_REVIEW', 'Submitted question for peer review.');
  return { success: true };
}

/** Clinician B Peer Review: Approve or Request Revision with PREVENT SELF-APPROVAL ENFORCEMENT */
export async function peerReviewQuestion(
  supabase: SupabaseClient<Database>,
  questionId: string,
  reviewerId: string,
  action: 'approve' | 'request_revision',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createSupabaseAdminClient();
  // 1. Fetch question record
  const { data: q, error: fetchErr } = await (adminClient.from('questions') as any)
    .select('id, authored_by')
    .eq('id', questionId)
    .single();

  if (fetchErr || !q) return { success: false, error: 'Question not found.' };

  // 2. CRITICAL PREVENT SELF-APPROVAL ENFORCEMENT
  if (q.authored_by === reviewerId) {
    return {
      success: false,
      error: 'Clinician A cannot approve their own authored question as Clinician B. Peer review must be performed by a different clinician.',
    };
  }

  if (action === 'request_revision') {
    if (!notes || notes.trim().length === 0) {
      return { success: false, error: 'A revision note is required when requesting changes.' };
    }

    const { error } = await (adminClient.from('questions') as any)
      .update({
        review_notes: notes.trim(),
        clinical_reviewed_by: reviewerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (error) return { success: false, error: error.message };

    await recordQuestionAuditLog(
      supabase,
      questionId,
      reviewerId,
      'QUESTION_REVISION_REQUESTED',
      notes.trim()
    );
    return { success: true };
  } else {
    // Approve
    const { error } = await (adminClient.from('questions') as any)
      .update({
        clinical_reviewed_by: reviewerId,
        clinical_reviewed_at: new Date().toISOString(),
        review_notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (error) return { success: false, error: error.message };

    await recordQuestionAuditLog(
      supabase,
      questionId,
      reviewerId,
      'QUESTION_PEER_APPROVED',
      'Peer review approved by clinician.'
    );
    return { success: true };
  }
}

/** Clinician A: Revise a question based on review feedback. Safe versioning if active. */
export async function reviseClinicianQuestion(
  supabase: SupabaseClient<Database>,
  questionId: string,
  authorId: string,
  updatedText: string,
  _updatedOptions?: ClinicianOptionInput[]
): Promise<{ success: boolean; question?: Question; error?: string }> {
  const adminClient = createSupabaseAdminClient();
  const { data: q } = await (adminClient.from('questions') as any).select('*').eq('id', questionId).single();
  if (!q) return { success: false, error: 'Question not found.' };

  const currentStatus = deriveQuestionStatus(q);

  // If question was already activated or in regional pool, create a new version Q-102 v2
  if (q.active || currentStatus === 'regionally_approved' || currentStatus === 'active') {
    const nextVersion = (q.version || 1) + 1;
    const versionedCode = `${q.question_code}_v${nextVersion}`;
    const { data: newVer, error: verErr } = await (adminClient.from('questions') as any)
      .insert({
        question_code: versionedCode,
        text: updatedText.trim(),
        category: q.category,
        question_type: q.question_type || 'single_choice',
        weight: q.weight || 1.0,
        active: false,
        order_index: q.order_index || 1,
        is_base_question: q.is_base_question ?? false,
        week_number: q.week_number || 1,
        target_department: q.target_department || 'ALL',
        depth_level: q.depth_level || 'moderate',
        authored_by: authorId,
        review_notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (verErr || !newVer) return { success: false, error: verErr?.message || 'Failed to create revised version.' };

    const revisedQuestion: Question = {
      ...newVer,
      version: nextVersion,
      parent_question_id: q.id,
      status: 'peer_review',
    };

    await recordQuestionAuditLog(supabase, newVer.id, authorId, 'QUESTION_REVISED', `Created revised version v${nextVersion}.`);
    return { success: true, question: revisedQuestion };
  } else {
    // Update existing draft in-place
    const { error: upErr } = await (adminClient.from('questions') as any)
      .update({
        text: updatedText.trim(),
        review_notes: '[PEER_REVIEW]',
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (upErr) return { success: false, error: upErr.message };

    await recordQuestionAuditLog(supabase, questionId, authorId, 'QUESTION_REVISED', 'Updated question text and resubmitted for peer review.');
    return { success: true };
  }
}

/** Regional Officer Review: Scope isolation and Pool Activation */
export async function regionalReviewQuestion(
  supabase: SupabaseClient<Database>,
  questionId: string,
  officerId: string,
  officerRegionId: string,
  action: 'activate' | 'request_revision',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createSupabaseAdminClient();
  // 1. Fetch question
  const { data: q } = await (adminClient.from('questions') as any).select('*').eq('id', questionId).single();
  if (!q) return { success: false, error: 'Question not found.' };

  // 2. Region isolation check (national, ALL, or exact region match)
  const qRegion = q.region_id || (q.target_department?.startsWith('REGION:') ? q.target_department.replace('REGION:', '') : q.target_department);
  if (qRegion && qRegion !== 'national' && qRegion !== 'ALL' && officerRegionId && officerRegionId !== 'national' && qRegion !== officerRegionId) {
    return {
      success: false,
      error: `Region isolation violation: Officer from region ${officerRegionId} cannot modify question assigned to region ${qRegion}.`,
    };
  }

  if (action === 'request_revision') {
    if (!notes || notes.trim().length === 0) {
      return { success: false, error: 'A revision note is required when requesting regional changes.' };
    }

    const { error } = await (adminClient.from('questions') as any)
      .update({
        review_notes: notes.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (error) return { success: false, error: error.message };

    await recordQuestionAuditLog(supabase, questionId, officerId, 'QUESTION_REGIONAL_REVISION_REQUESTED', notes.trim());
    return { success: true };
  } else {
    // Activate
    const { error } = await (adminClient.from('questions') as any)
      .update({
        active: true,
        activated_by: officerId,
        activated_at: new Date().toISOString(),
        review_notes: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (error) return { success: false, error: error.message };

    await recordQuestionAuditLog(supabase, questionId, officerId, 'QUESTION_REGIONALLY_APPROVED', 'Question approved by regional governance officer.');
    await recordQuestionAuditLog(supabase, questionId, officerId, 'QUESTION_POOL_ACTIVATED', 'Activated into live weekly question pool.');
    return { success: true };
  }
}

/** Questions awaiting regional activation */
export async function getQuestionsAwaitingActivation(
  supabase: SupabaseClient<Database>
): Promise<QuestionWithNames[]> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await (adminClient.from('questions') as any)
    .select('*, options:question_options(*)')
    .not('clinical_reviewed_at', 'is', null)
    .eq('active', false)
    .order('clinical_reviewed_at', { ascending: true });

  if (error || !data) return [];
  return attachNames(supabase, data as Question[]);
}

export async function approveQuestion(
  supabase: SupabaseClient<Database>,
  questionId: string,
  reviewerId: string
): Promise<{ success: boolean; error?: string }> {
  return peerReviewQuestion(supabase, questionId, reviewerId, 'approve');
}

export async function requestQuestionChange(
  supabase: SupabaseClient<Database>,
  questionId: string,
  notes: string,
  regionId?: string
): Promise<{ success: boolean; error?: string }> {
  return regionalReviewQuestion(supabase, questionId, 'regional_officer', regionId || 'national', 'request_revision', notes);
}

export async function activateQuestion(
  supabase: SupabaseClient<Database>,
  questionId: string,
  activatorId: string,
  regionId?: string
): Promise<{ success: boolean; error?: string }> {
  return regionalReviewQuestion(supabase, questionId, activatorId, regionId || 'national', 'activate');
}

export interface FlaggedQuestionItem extends QuestionWithNames {
  flags: QuestionFlag[];
}

export async function getFlaggedQuestions(
  supabase: SupabaseClient<Database>
): Promise<FlaggedQuestionItem[]> {
  const { data: openFlags, error: flagErr } = await (supabase.from('question_flags') as any)
    .select('*')
    .is('resolved_at', null)
    .order('raised_at', { ascending: true });

  if (flagErr || !openFlags || openFlags.length === 0) return [];

  const questionIds = Array.from(new Set((openFlags as any[]).map((f) => f.question_id)));

  const { data: questionsData } = await (supabase.from('questions') as any)
    .select('*, options:question_options(*)')
    .in('id', questionIds);

  const withNames = await attachNames(supabase, (questionsData || []) as Question[]);
  const qMap = new Map(withNames.map((q) => [q.id, q]));

  const flagsByQuestion = new Map<string, QuestionFlag[]>();
  for (const f of openFlags as QuestionFlag[]) {
    if (!flagsByQuestion.has(f.question_id)) flagsByQuestion.set(f.question_id, []);
    flagsByQuestion.get(f.question_id)!.push(f);
  }

  const results: FlaggedQuestionItem[] = [];
  for (const [qId, flags] of flagsByQuestion.entries()) {
    const q = qMap.get(qId);
    if (q) results.push({ ...q, flags });
  }
  return results;
}

export async function resolveQuestionFlag(
  supabase: SupabaseClient<Database>,
  flagId: string,
  resolution: 'upheld' | 'amended' | 'retired',
  resolverId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: flagRow, error } = await (supabase.from('question_flags') as any)
    .update({
      resolved_by: resolverId,
      resolved_at: new Date().toISOString(),
      resolution,
    })
    .eq('id', flagId)
    .select('question_id')
    .single();

  if (error) return { success: false, error: error.message };

  if (resolution === 'retired' && flagRow) {
    await (supabase.from('questions') as any)
      .update({ active: false, status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', (flagRow as any).question_id);
  }

  return { success: true };
}

export async function getActiveQuestions(
  supabase: SupabaseClient<Database>
): Promise<QuestionWithNames[]> {
  const { data, error } = await (supabase.from('questions') as any)
    .select('*, options:question_options(*)')
    .eq('active', true)
    .order('week_number', { ascending: true })
    .order('category', { ascending: true });

  if (error || !data) return [];
  return attachNames(supabase, data as Question[]);
}

/** Delete or safely deactivate a question */
export async function deleteOrDeactivateQuestion(
  supabase: SupabaseClient<Database>,
  questionId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createSupabaseAdminClient();

    // Check if question has student assessment responses
    const { count: responseCount } = await (adminClient.from('assessment_responses') as any)
      .select('*', { count: 'exact', head: true })
      .eq('question_id', questionId);

    if (responseCount && responseCount > 0) {
      // If student responses exist, soft-delete (deactivate) to protect student assessment history
      const { error: deactErr } = await (adminClient.from('questions') as any)
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', questionId);

      if (deactErr) return { success: false, error: deactErr.message };

      await recordQuestionAuditLog(supabase, questionId, actorId, 'QUESTION_DEACTIVATED', 'Deactivated question with existing responses.');
      return { success: true };
    }

    // Clean delete cascade
    await (adminClient.from('weekly_pool_questions') as any).delete().eq('question_id', questionId);
    await (adminClient.from('question_options') as any).delete().eq('question_id', questionId);
    await (adminClient.from('question_flags') as any).delete().eq('question_id', questionId);
    await (adminClient.from('question_audit_logs') as any).delete().eq('question_id', questionId);

    const { error: delErr } = await (adminClient.from('questions') as any)
      .delete()
      .eq('id', questionId);

    if (delErr) {
      // Fallback to soft delete
      await (adminClient.from('questions') as any)
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', questionId);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete question.' };
  }
}

export async function raiseQuestionFlag(
  supabase: SupabaseClient<Database>,
  questionId: string,
  raisedBy: string,
  institutionId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from('question_flags') as any).insert({
    question_id: questionId,
    raised_by: raisedBy,
    institution_id: institutionId,
    reason,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================================================
// WEEKLY QUESTION POOL GOVERNANCE ENGINE (Phase 18.8)
// ============================================================================

export interface WeeklyQuestionPool {
  id: string;
  region_id: string;
  week_number: number;
  cycle_id: string;
  name: string;
  status: 'draft' | 'peer_approved' | 'regional_review' | 'active' | 'archived';
  activated_by?: string | null;
  activated_at?: string | null;
  question_ids: string[];
  created_at?: string;
  updated_at?: string;
}

export const inMemoryWeeklyPools = new Map<string, WeeklyQuestionPool>();

/**
 * Initializes or retrieves the weekly question pool for a given cycle and region.
 */
export async function getWeeklyQuestionPool(
  supabase: SupabaseClient<Database>,
  cycleId: string,
  regionId: string = 'reg-demo-north-01'
): Promise<WeeklyQuestionPool | null> {
  const poolKey = `${cycleId}:${regionId}`;
  if (inMemoryWeeklyPools.has(poolKey)) {
    return inMemoryWeeklyPools.get(poolKey)!;
  }

  // Also check national fallback
  const nationalKey = `${cycleId}:national`;
  if (inMemoryWeeklyPools.has(nationalKey)) {
    return inMemoryWeeklyPools.get(nationalKey)!;
  }

  // Check database table if present
  try {
    const { data: dbPool } = await (supabase.from('weekly_question_pools') as any)
      .select('*')
      .eq('cycle_id', cycleId)
      .in('region_id', [regionId, 'national'])
      .eq('status', 'active')
      .single();

    if (dbPool) {
      const pool: WeeklyQuestionPool = {
        id: dbPool.id,
        region_id: dbPool.region_id,
        week_number: dbPool.week_number,
        cycle_id: dbPool.cycle_id,
        name: dbPool.name,
        status: dbPool.status,
        activated_by: dbPool.activated_by,
        activated_at: dbPool.activated_at,
        question_ids: (dbPool as any).question_ids || [],
      };
      inMemoryWeeklyPools.set(poolKey, pool);
      return pool;
    }
  } catch {
    // DB fallback
  }

  // Initialize canonical default pool for active cycle containing canonical active questions
  const { data: activeQuestions } = await (createSupabaseAdminClient().from('questions') as any)
    .select('id, week_number, active, review_notes')
    .eq('active', true)
    .order('order_index', { ascending: true });

  const eligibleQuestionIds = (activeQuestions || [])
    .filter((q: any) => q.review_notes !== '[PEER_REVIEW]')
    .map((q: any) => q.id);

  const defaultPool: WeeklyQuestionPool = {
    id: `pool-${cycleId}-${regionId}`,
    region_id: regionId,
    week_number: 1,
    cycle_id: cycleId,
    name: 'Week 1 Governed Regional Question Pool',
    status: 'active',
    activated_by: '0ba8bc22-87d2-4c89-9819-d6ceea1b2156', // Demo Regional Officer
    activated_at: new Date().toISOString(),
    question_ids: eligibleQuestionIds,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  inMemoryWeeklyPools.set(poolKey, defaultPool);
  return defaultPool;
}

/**
 * Creates or updates an active weekly question pool for an authorized Regional Officer.
 */
export async function createOrUpdateWeeklyQuestionPool(
  supabase: SupabaseClient<Database>,
  callerId: string,
  callerRole: string,
  callerRegionId: string,
  input: {
    cycleId: string;
    regionId: string;
    weekNumber: number;
    name: string;
    status: 'draft' | 'peer_approved' | 'regional_review' | 'active' | 'archived';
    questionIds: string[];
  }
): Promise<{ success: boolean; pool?: WeeklyQuestionPool; error?: string }> {
  if (callerRole !== 'regional_officer' && callerRole !== 'super_admin' && callerRole !== 'government_admin') {
    return { success: false, error: `Unauthorized: Role '${callerRole}' cannot configure weekly question pools.` };
  }

  if (callerRole === 'regional_officer' && callerRegionId !== input.regionId && input.regionId !== 'national') {
    return { success: false, error: `Regional boundary violation: Cannot configure pool for foreign region '${input.regionId}'.` };
  }

  // Verify all questions in pool are active and not in unapproved governance states
  const { data: questions } = await (createSupabaseAdminClient().from('questions') as any)
    .select('id, active, review_notes, authored_by, clinical_reviewed_at')
    .in('id', input.questionIds);

  const foundMap = new Map<string, any>((questions || []).map((q: any) => [q.id, q]));

  for (const qId of input.questionIds) {
    const q: any = foundMap.get(qId);
    if (!q) {
      return { success: false, error: `Question '${qId}' not found.` };
    }
    if (!q.active) {
      return { success: false, error: `Cannot include inactive question '${qId}' in weekly delivery pool.` };
    }
    if (q.review_notes === '[PEER_REVIEW]' || (q.authored_by && !q.clinical_reviewed_at)) {
      return { success: false, error: `Cannot include unapproved question '${qId}' in weekly delivery pool.` };
    }
  }

  const poolKey = `${input.cycleId}:${input.regionId}`;
  const pool: WeeklyQuestionPool = {
    id: `pool-${input.cycleId}-${input.regionId}`,
    region_id: input.regionId,
    week_number: input.weekNumber,
    cycle_id: input.cycleId,
    name: input.name,
    status: input.status,
    activated_by: input.status === 'active' ? callerId : null,
    activated_at: input.status === 'active' ? new Date().toISOString() : null,
    question_ids: input.questionIds,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  inMemoryWeeklyPools.set(poolKey, pool);
  return { success: true, pool };
}

/**
 * Adds an approved question to a weekly question pool.
 */
export async function addQuestionToWeeklyPool(
  supabase: SupabaseClient<Database>,
  callerId: string,
  callerRole: string,
  callerRegionId: string,
  cycleId: string,
  regionId: string,
  questionId: string
): Promise<{ success: boolean; error?: string }> {
  if (callerRole !== 'regional_officer' && callerRole !== 'super_admin' && callerRole !== 'government_admin') {
    return { success: false, error: `Unauthorized: Role '${callerRole}' cannot modify weekly question pools.` };
  }

  if (callerRole === 'regional_officer' && callerRegionId !== regionId && regionId !== 'national') {
    return { success: false, error: `Regional boundary violation: Cannot modify pool for foreign region '${regionId}'.` };
  }

  // Fetch question and verify governance
  const { data: q } = await (createSupabaseAdminClient().from('questions') as any)
    .select('id, active, review_notes, clinical_reviewed_at, authored_by')
    .eq('id', questionId)
    .single();

  if (!q) return { success: false, error: 'Question not found.' };
  if (!q.active) return { success: false, error: 'Cannot add inactive question to weekly pool.' };
  if (q.review_notes === '[PEER_REVIEW]' || (q.authored_by && !q.clinical_reviewed_at)) {
    return { success: false, error: 'Cannot add unapproved question to weekly delivery pool.' };
  }

  const pool = await getWeeklyQuestionPool(supabase, cycleId, regionId);
  if (!pool) return { success: false, error: 'Weekly question pool not found.' };

  if (!pool.question_ids.includes(questionId)) {
    pool.question_ids.push(questionId);
    pool.updated_at = new Date().toISOString();
    inMemoryWeeklyPools.set(`${cycleId}:${regionId}`, pool);
  }

  return { success: true };
}

/**
 * Removes a question from a weekly question pool.
 */
export async function removeQuestionFromWeeklyPool(
  supabase: SupabaseClient<Database>,
  callerId: string,
  callerRole: string,
  callerRegionId: string,
  cycleId: string,
  regionId: string,
  questionId: string
): Promise<{ success: boolean; error?: string }> {
  if (callerRole !== 'regional_officer' && callerRole !== 'super_admin' && callerRole !== 'government_admin') {
    return { success: false, error: `Unauthorized: Role '${callerRole}' cannot modify weekly question pools.` };
  }

  if (callerRole === 'regional_officer' && callerRegionId !== regionId && regionId !== 'national') {
    return { success: false, error: `Regional boundary violation: Cannot modify pool for foreign region '${regionId}'.` };
  }

  const pool = await getWeeklyQuestionPool(supabase, cycleId, regionId);
  if (!pool) return { success: false, error: 'Weekly question pool not found.' };

  pool.question_ids = pool.question_ids.filter((id) => id !== questionId);
  pool.updated_at = new Date().toISOString();
  inMemoryWeeklyPools.set(`${cycleId}:${regionId}`, pool);

  return { success: true };
}

/**
 * Returns only the questions that belong to the active weekly pool and satisfy all governance criteria.
 */
export async function getGovernedWeeklyPoolQuestions(
  supabase: SupabaseClient<Database>,
  cycleId: string,
  regionId: string = 'reg-demo-north-01'
): Promise<Question[]> {
  const pool = await getWeeklyQuestionPool(supabase, cycleId, regionId);
  if (!pool || pool.status !== 'active' || pool.question_ids.length === 0) {
    return [];
  }

  const adminClient = createSupabaseAdminClient();
  const { data: questionsData, error } = await (adminClient.from('questions') as any)
    .select('*, options:question_options(*)')
    .in('id', pool.question_ids)
    .eq('active', true)
    .order('order_index', { ascending: true });

  if (error || !questionsData) return [];

  // Filter out any questions with invalid governance (e.g. pending peer review)
  const validQuestions = (questionsData as any[]).filter((q) => {
    if (!q.active) return false;
    if (q.review_notes === '[PEER_REVIEW]') return false;
    if (q.authored_by && !q.clinical_reviewed_at) return false;
    return true;
  });

  const sorted = validQuestions.map((q: any) => ({
    ...q,
    options: (q.options || []).sort((a: any, b: any) => a.order_index - b.order_index),
  }));

  return sorted as unknown as Question[];
}

