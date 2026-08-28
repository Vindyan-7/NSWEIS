import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export interface PrivacyConsentDTO {
  id: string;
  user_id: string;
  purpose: string;
  consent_status: 'active' | 'withdrawn';
  policy_version: string;
  consented_at: string;
  withdrawn_at: string | null;
}

export interface PrivacyRequestDTO {
  id: string;
  user_id: string;
  request_type: 'access' | 'correction' | 'withdrawal' | 'deletion' | 'grievance';
  status: 'submitted' | 'under_review' | 'acknowledged' | 'contact_planned' | 'resolved';
  requested_at: string;
  resolved_at: string | null;
  notes: string | null;
  student_name?: string | null;
  department_name?: string | null;
  year_level?: number | null;
  section_code?: string | null;
}

export interface PrivacyAuditLogDTO {
  id: string;
  actor_user_id: string | null;
  actor_role: string;
  institution_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  purpose: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ProcessingPurposeDTO {
  purpose_key: string;
  title: string;
  description: string;
  data_categories: string[];
  active: boolean;
}

export interface RetentionPolicyDTO {
  data_category: string;
  purpose: string;
  retention_description: string;
  active: boolean;
}

// In-memory fallback stores for demo resilience
const inMemoryConsents = new Map<string, PrivacyConsentDTO>();
const inMemoryRequests = new Map<string, PrivacyRequestDTO[]>();
const inMemoryAuditLogs: PrivacyAuditLogDTO[] = [];

// Static Data Purpose Registry
export function getDataProcessingPurposes(): ProcessingPurposeDTO[] {
  return [
    {
      purpose_key: 'student_wellbeing_support',
      title: 'Student Well-being Reflection & Support',
      description: 'Support confidential student well-being self-reflection and provide non-clinical supportive guidance.',
      data_categories: ['account_metadata', 'weekly_reflection_responses', 'supportive_focus_areas'],
      active: true,
    },
    {
      purpose_key: 'anonymous_institutional_intelligence',
      title: 'Anonymous Institutional Intelligence',
      description: 'Provide anonymous aggregate well-being trends for institutional support planning.',
      data_categories: ['aggregate_completion_rates', 'aggregate_category_indicators'],
      active: true,
    },
    {
      purpose_key: 'aggregate_government_oversight',
      title: 'Government Regional Oversight',
      description: 'High-level regional participation trends across authorized institutions for policy planning.',
      data_categories: ['aggregate_institutional_completion_rates'],
      active: true,
    },
  ];
}

// Static Data Retention Policies
export function getDataRetentionPolicies(): RetentionPolicyDTO[] {
  return [
    {
      data_category: 'Identifiable Account Data',
      purpose: 'student_wellbeing_support',
      retention_description: 'Retained for active student enrollment duration, subject to institutional retention policies.',
      active: true,
    },
    {
      data_category: 'Private Reflection Data',
      purpose: 'student_wellbeing_support',
      retention_description: 'Retained only for student self-reflection history; confidential and inaccessible to officers.',
      active: true,
    },
    {
      data_category: 'Anonymous Aggregate Intelligence',
      purpose: 'anonymous_institutional_intelligence',
      retention_description: 'Retained in aggregate form for long-term institutional trend analysis.',
      active: true,
    },
  ];
}

// Fetch Student Consent
export async function getStudentConsent(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PrivacyConsentDTO> {
  try {
    const { data, error } = await (supabase.from('privacy_consents' as any) as any)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      return data as PrivacyConsentDTO;
    }
  } catch (err) {
    // DB table fallback
  }

  if (inMemoryConsents.has(userId)) {
    return inMemoryConsents.get(userId)!;
  }

  const defaultConsent: PrivacyConsentDTO = {
    id: `consent-${userId}`,
    user_id: userId,
    purpose: 'student_wellbeing_support',
    consent_status: 'active',
    policy_version: 'v1.0',
    consented_at: new Date().toISOString(),
    withdrawn_at: null,
  };

  inMemoryConsents.set(userId, defaultConsent);
  return defaultConsent;
}

// Update Student Consent Status
export async function updateStudentConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  consentStatus: 'active' | 'withdrawn'
): Promise<PrivacyConsentDTO> {
  const now = new Date().toISOString();

  try {
    const { data, error } = await (supabase.from('privacy_consents' as any) as any)
      .upsert(
        {
          user_id: userId,
          purpose: 'student_wellbeing_support',
          consent_status: consentStatus,
          policy_version: 'v1.0',
          consented_at: now,
          withdrawn_at: consentStatus === 'withdrawn' ? now : null,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (!error && data) {
      await logPrivacyAuditEvent(
        supabase,
        userId,
        'student',
        consentStatus === 'active' ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN',
        'privacy_consent',
        data.id,
        'student_wellbeing_support',
        { consent_status: consentStatus, policy_version: 'v1.0' }
      );
      return data as PrivacyConsentDTO;
    }
  } catch (err) {
    // Fallback
  }

  const updatedConsent: PrivacyConsentDTO = {
    id: `consent-${userId}`,
    user_id: userId,
    purpose: 'student_wellbeing_support',
    consent_status: consentStatus,
    policy_version: 'v1.0',
    consented_at: now,
    withdrawn_at: consentStatus === 'withdrawn' ? now : null,
  };

  inMemoryConsents.set(userId, updatedConsent);

  await logPrivacyAuditEvent(
    supabase,
    userId,
    'student',
    consentStatus === 'active' ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN',
    'privacy_consent',
    updatedConsent.id,
    'student_wellbeing_support',
    { consent_status: consentStatus, policy_version: 'v1.0' }
  );

  return updatedConsent;
}

// Fetch Student Privacy Requests
export async function getStudentPrivacyRequests(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PrivacyRequestDTO[]> {
  try {
    const { data, error } = await (supabase.from('privacy_requests' as any) as any)
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });

    if (!error && data) {
      return data as PrivacyRequestDTO[];
    }
  } catch (err) {
    // Fallback
  }

  return inMemoryRequests.get(userId) || [];
}

export async function getCollegeSupportRequests(
  supabase: SupabaseClient<Database>,
  institutionId: string
): Promise<PrivacyRequestDTO[]> {
  let studentMap = new Map<string, any>();
  let studentIds: string[] = [];

  try {
    // 1. Fetch student profiles belonging strictly to officer's institution
    const { data: studentProfiles } = await (supabase.from('profiles') as any)
      .select('id, full_name, year_level, section_code, department_id')
      .eq('institution_id', institutionId)
      .eq('role', 'student');

    if (studentProfiles && studentProfiles.length > 0) {
      studentMap = new Map<string, any>(studentProfiles.map((s: any) => [s.id, s]));
      studentIds = Array.from(studentMap.keys());

      // 2. Query grievance privacy requests for these students
      const { data: requests, error } = await (supabase.from('privacy_requests' as any) as any)
        .select('*')
        .eq('request_type', 'grievance')
        .in('user_id', studentIds)
        .order('requested_at', { ascending: false });

      if (!error && requests && requests.length > 0) {
        return requests.map((req: any) => {
          const student = studentMap.get(req.user_id);
          return {
            ...req,
            student_name: student?.full_name || 'Student',
            year_level: student?.year_level || 1,
            section_code: student?.section_code || 'A',
          };
        }) as PrivacyRequestDTO[];
      }
    }
  } catch (err) {
    // Fallback
  }

  // In-memory fallback
  const fallbackResults: PrivacyRequestDTO[] = [];
  if (studentIds.length > 0) {
    for (const sId of studentIds) {
      const memReqs = inMemoryRequests.get(sId) || [];
      const student = studentMap.get(sId);
      for (const req of memReqs) {
        if (req.request_type === 'grievance') {
          fallbackResults.push({
            ...req,
            student_name: student?.full_name || 'Student',
            year_level: student?.year_level || 1,
            section_code: student?.section_code || 'A',
          });
        }
      }
    }
  } else {
    // Return all in-memory grievance requests for fallback if profiles query was empty/failed
    for (const [, memReqs] of inMemoryRequests.entries()) {
      for (const req of memReqs) {
        if (req.request_type === 'grievance') {
          fallbackResults.push({
            ...req,
            student_name: 'Student',
            year_level: 1,
            section_code: 'A',
          });
        }
      }
    }
  }
  return fallbackResults;
}

export async function updateCollegeSupportRequestStatus(
  supabase: SupabaseClient<Database>,
  requestId: string,
  newStatus: 'submitted' | 'acknowledged' | 'contact_planned' | 'resolved'
): Promise<{ success: boolean }> {
  try {
    const updatePayload: any = { status: newStatus };
    if (newStatus === 'resolved') {
      updatePayload.resolved_at = new Date().toISOString();
    }
    await (supabase.from('privacy_requests' as any) as any)
      .update(updatePayload)
      .eq('id', requestId);
    return { success: true };
  } catch (err) {
    return { success: false };
  }
}

export async function resolveCollegeSupportRequest(
  supabase: SupabaseClient<Database>,
  requestId: string
): Promise<{ success: boolean }> {
  return updateCollegeSupportRequestStatus(supabase, requestId, 'resolved');
}

// Create Privacy Request
export async function createPrivacyRequest(
  supabase: SupabaseClient<Database>,
  userId: string,
  requestType: PrivacyRequestDTO['request_type'],
  notes?: string
): Promise<PrivacyRequestDTO> {
  const now = new Date().toISOString();

  try {
    const env = (import.meta as any).env || (globalThis as any).process?.env || {};
    const supabaseUrl = env.PUBLIC_SUPABASE_URL || '';
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
    let db: any = supabase;
    if (serviceKey && supabaseUrl) {
      const { createClient } = await import('@supabase/supabase-js');
      db = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }

    const { data, error } = await (db.from('privacy_requests' as any) as any)
      .insert([
        {
          user_id: userId,
          request_type: requestType,
          status: 'submitted',
          requested_at: now,
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (!error && data) {
      await logPrivacyAuditEvent(
        supabase,
        userId,
        'student',
        'PRIVACY_REQUEST_CREATED',
        'privacy_request',
        data.id,
        'student_wellbeing_support',
        { request_type: requestType }
      );
      return data as PrivacyRequestDTO;
    }
  } catch (err) {
    // Fallback
  }

  const newReq: PrivacyRequestDTO = {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId,
    request_type: requestType,
    status: 'submitted',
    requested_at: now,
    resolved_at: null,
    notes: notes || null,
  };

  const list = inMemoryRequests.get(userId) || [];
  list.unshift(newReq);
  inMemoryRequests.set(userId, list);

  await logPrivacyAuditEvent(
    supabase,
    userId,
    'student',
    'PRIVACY_REQUEST_CREATED',
    'privacy_request',
    newReq.id,
    'student_wellbeing_support',
    { request_type: requestType }
  );

  return newReq;
}

// Log Privacy Audit Event (Never logs private reflection text or raw response scores!)
export async function logPrivacyAuditEvent(
  supabase: SupabaseClient<Database>,
  actorUserId: string | null,
  actorRole: string,
  action: string,
  resourceType: string,
  resourceId?: string | null,
  purpose: string = 'student_wellbeing_support',
  metadata: Record<string, any> = {}
): Promise<void> {
  const safeMetadata = { ...metadata };
  delete safeMetadata.text_response;
  delete safeMetadata.reflection_text;
  delete safeMetadata.score;
  delete safeMetadata.answers;

  const now = new Date().toISOString();

  try {
    await (supabase.from('privacy_audit_logs' as any) as any).insert([
      {
        actor_user_id: actorUserId,
        actor_role: actorRole,
        action: action,
        resource_type: resourceType,
        resource_id: resourceId || null,
        purpose: purpose,
        metadata: safeMetadata,
        created_at: now,
      },
    ]);
  } catch (err) {
    // Fallback
  }

  inMemoryAuditLogs.push({
    id: `log-${Date.now()}`,
    actor_user_id: actorUserId,
    actor_role: actorRole,
    institution_id: null,
    action: action,
    resource_type: resourceType,
    resource_id: resourceId || null,
    purpose: purpose,
    metadata: safeMetadata,
    created_at: now,
  });
}

export function getPrivacyAuditLogs(): PrivacyAuditLogDTO[] {
  return [...inMemoryAuditLogs];
}
