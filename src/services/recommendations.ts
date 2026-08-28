import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { Recommendation, WellnessCategory, StudentTask } from '../types/domain';
import { createSupabaseAdminClient } from '../lib/supabase/server';

export interface RecommendationRule {
  id: string;
  category: WellnessCategory;
  minimum_signal: number;
  maximum_signal: number;
  priority: number;
  title: string;
  description: string;
  task_title: string;
  task_description: string;
  estimated_minutes: number;
  credits_awarded: number;
  active: boolean;
}

export interface CategorySignal {
  category: WellnessCategory;
  signalValue: number;
  sampleCount: number;
}

// Fallback seed rules matching 09_recommendation_engine.sql if database RPC/table is pending
const FALLBACK_RULES: RecommendationRule[] = [
  {
    id: 'rule-academic-1',
    category: 'academic',
    minimum_signal: 0.0,
    maximum_signal: 6.0,
    priority: 10,
    title: 'Try one focused study block this week',
    description: 'Breaking academic work into a single distraction-free focus block can make studying feel far more manageable.',
    task_title: 'Complete one 25-minute distraction-free study session',
    task_description: 'Set a timer for 25 minutes, put away notifications, and focus on one academic assignment.',
    estimated_minutes: 25,
    credits_awarded: 10,
    active: true,
  },
  {
    id: 'rule-sleep-1',
    category: 'sleep_rest',
    minimum_signal: 0.0,
    maximum_signal: 6.0,
    priority: 10,
    title: 'Try keeping a consistent wind-down period',
    description: 'Giving yourself 20 minutes to transition away from screens before bed helps improve sleep quality.',
    task_title: 'Complete one screen-free wind-down session before sleep',
    task_description: 'Turn off screens 20 minutes before sleeping and engage in light reading or relaxation.',
    estimated_minutes: 20,
    credits_awarded: 10,
    active: true,
  },
  {
    id: 'rule-digital-1',
    category: 'digital_balance',
    minimum_signal: 0.0,
    maximum_signal: 6.0,
    priority: 9,
    title: 'Create one phone-free focus period this week',
    description: 'Short breaks from digital notifications help clear mental fatigue and improve concentration.',
    task_title: 'Complete one 25-minute phone-free focus activity',
    task_description: 'Place your phone in another room or on Do Not Disturb while engaging in study or relaxation.',
    estimated_minutes: 25,
    credits_awarded: 10,
    active: true,
  },
  {
    id: 'rule-social-1',
    category: 'social_connection',
    minimum_signal: 0.0,
    maximum_signal: 6.0,
    priority: 8,
    title: 'Make time for one positive social connection this week',
    description: 'Connecting with friends, family, or classmates builds encouragement and mutual support.',
    task_title: 'Reach out to someone you trust',
    task_description: 'Spend 15 minutes chatting with a friend, classmate, or family member.',
    estimated_minutes: 15,
    credits_awarded: 10,
    active: true,
  },
  {
    id: 'rule-physical-1',
    category: 'physical_wellbeing',
    minimum_signal: 0.0,
    maximum_signal: 6.0,
    priority: 7,
    title: 'Add a short movement break to your day',
    description: 'A quick walk or stretch helps recharge your energy and focus.',
    task_title: 'Complete a 10-minute movement break',
    task_description: 'Take a 10-minute walk or do a quick stretching routine during a study break.',
    estimated_minutes: 10,
    credits_awarded: 10,
    active: true,
  },
  {
    id: 'rule-routine-1',
    category: 'family_home',
    minimum_signal: 0.0,
    maximum_signal: 6.0,
    priority: 6,
    title: 'Organize your weekly routine space',
    description: 'Tidying your workspace or preparing your schedule for the week creates clarity.',
    task_title: 'Set up your weekly schedule & workspace',
    task_description: 'Spend 15 minutes organizing your study area and reviewing key dates for the week.',
    estimated_minutes: 15,
    credits_awarded: 10,
    active: true,
  },
  {
    id: 'rule-career-1',
    category: 'career',
    minimum_signal: 0.0,
    maximum_signal: 6.0,
    priority: 7,
    title: 'Explore one practical step toward your future goals',
    description: 'Reviewing career resources or skills step-by-step builds long-term confidence.',
    task_title: 'Review one career or skill resource',
    task_description: 'Spend 20 minutes exploring an internship listing, resume tip, or skill tutorial.',
    estimated_minutes: 20,
    credits_awarded: 10,
    active: true,
  },
];

/**
 * Calculate category-level support signals from completed assessment responses.
 * Groups option signals (0.0 - 10.0) by wellness category and computes averages.
 * Excludes categories with zero answered questions.
 */
export function calculateCategorySupportSignals(
  responses: Array<{
    category: WellnessCategory;
    signalValue?: number | null;
    score?: number | null;
  }>
): CategorySignal[] {
  const categoryMap = new Map<WellnessCategory, { sum: number; count: number }>();

  for (const r of responses) {
    const val = r.signalValue ?? r.score;
    if (val !== undefined && val !== null && !isNaN(val)) {
      if (!categoryMap.has(r.category)) {
        categoryMap.set(r.category, { sum: 0, count: 0 });
      }
      const item = categoryMap.get(r.category)!;
      item.sum += val;
      item.count += 1;
    }
  }

  const result: CategorySignal[] = [];
  for (const [cat, data] of categoryMap.entries()) {
    if (data.count > 0) {
      result.push({
        category: cat,
        signalValue: Math.round((data.sum / data.count) * 10) / 10,
        sampleCount: data.count,
      });
    }
  }

  return result;
}

/**
 * Select up to 3 highest-priority category-diverse recommendation rules matching signals.
 */
export function selectCategoryDiverseRules(
  matchingRules: RecommendationRule[]
): RecommendationRule[] {
  if (matchingRules.length <= 3) return matchingRules;

  // Sort by priority descending
  const sorted = [...matchingRules].sort((a, b) => b.priority - a.priority);

  const selected: RecommendationRule[] = [];
  const selectedCategories = new Set<WellnessCategory>();

  // Pass 1: Select highest priority rule for each unique category up to 3
  for (const rule of sorted) {
    if (!selectedCategories.has(rule.category)) {
      selected.push(rule);
      selectedCategories.add(rule.category);
      if (selected.length === 3) break;
    }
  }

  // Pass 2: Fill remaining slots if fewer than 3 unique categories matched
  if (selected.length < 3) {
    for (const rule of sorted) {
      if (!selected.some((s) => s.id === rule.id)) {
        selected.push(rule);
        if (selected.length === 3) break;
      }
    }
  }

  return selected;
}

/**
 * Generate supportive recommendations & student tasks for a completed assessment.
 * Enforces server-side execution, idempotency, category diversity, and max 3 tasks.
 * Uses SECURITY DEFINER RPC generate_assessment_recommendations (which returns boolean status only).
 */
export async function generateRecommendationsForAssessment(
  supabase: SupabaseClient<Database>,
  userId: string,
  assessmentId: string
): Promise<{
  success: boolean;
  recommendations: Recommendation[];
  tasks: StudentTask[];
  alreadyGenerated?: boolean;
  error?: string;
}> {
  try {
    // 1. Verify assessment exists and is completed
    const { data: assessment } = await (supabase.from('assessments') as any)
      .select('*, cycle:assessment_cycles(*)')
      .eq('id', assessmentId)
      .eq('student_id', userId)
      .single();

    if (!assessment || assessment.status !== 'completed') {
      return { success: false, recommendations: [], tasks: [], error: 'Assessment not found or incomplete.' };
    }

    // 2. Idempotency Check: check if recommendations already exist for this assessment
    const { data: existingRecLinks } = await (supabase.from('assessment_recommendations') as any)
      .select('recommendation_id')
      .eq('assessment_id', assessmentId);

    const { data: existingTasks } = await (supabase.from('student_tasks') as any)
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('student_id', userId);

    if (existingRecLinks && existingRecLinks.length > 0) {
      const recIds = existingRecLinks.map((r: any) => r.recommendation_id);
      const { data: recData } = await supabase.from('recommendations').select('*').in('id', recIds);

      return {
        success: true,
        alreadyGenerated: true,
        recommendations: (recData || []) as Recommendation[],
        tasks: (existingTasks || []) as unknown as StudentTask[],
      };
    }

    // 3. Attempt DB SECURITY DEFINER Generation RPC (Returns Boolean status only!)
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      'generate_assessment_recommendations',
      { p_assessment_id: assessmentId }
    );

    if (!rpcError && rpcResult === true) {
      // RPC executed successfully server-side. Fetch created safe recommendations & tasks.
      const recs = await getRecommendationsForAssessment(supabase, assessmentId);
      const { data: createdTasks } = await (supabase.from('student_tasks') as any)
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('student_id', userId);

      return {
        success: true,
        recommendations: recs,
        tasks: (createdTasks || []) as unknown as StudentTask[],
      };
    }

    // 4. Fallback for pending DB migration: Evaluate server-side in Astro SSR using FALLBACK_RULES
    // AUDIT.md H2: question_options is readable only by clinician/super_admin
    // now, so this embed needs the admin client — assessmentId is already
    // scoped to this student by the caller, not by RLS on this query.
    const { data: responsesData } = await (createSupabaseAdminClient().from('assessment_responses') as any)
      .select('question_id, selected_option_id, question:questions(category), option:question_options(score, signal_value)')
      .eq('assessment_id', assessmentId);

    const rawResponses: Array<{ category: WellnessCategory; signalValue?: number | null; score?: number | null }> = [];
    if (responsesData) {
      for (const r of responsesData) {
        if (r.question?.category) {
          rawResponses.push({
            category: r.question.category as WellnessCategory,
            signalValue: r.option?.signal_value,
            score: r.option?.score,
          });
        }
      }
    }

    const categorySignals = calculateCategorySupportSignals(rawResponses);
    const activeRules = FALLBACK_RULES;

    const matchingRules: RecommendationRule[] = [];
    for (const sig of categorySignals) {
      for (const rule of activeRules) {
        if (
          rule.category === sig.category &&
          sig.signalValue >= rule.minimum_signal &&
          sig.signalValue <= rule.maximum_signal
        ) {
          matchingRules.push(rule);
        }
      }
    }

    const candidateRules = matchingRules.length > 0 ? matchingRules : activeRules;
    const selectedRules = selectCategoryDiverseRules(candidateRules);

    const generatedRecs: Recommendation[] = [];
    const generatedTasks: StudentTask[] = [];

    const cycleEndDate = assessment.cycle?.ends_at
      ? new Date(assessment.cycle.ends_at).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const rule of selectedRules) {
      let recId = rule.id;
      const { data: recEntry } = await (supabase.from('recommendations') as any)
        .select('id')
        .eq('category', rule.category)
        .eq('title', rule.title)
        .single();

      if (recEntry) {
        recId = recEntry.id;
      } else {
        const { data: newRec } = await (supabase.from('recommendations') as any)
          .insert({
            category: rule.category,
            title: rule.title,
            description: rule.description,
            priority: rule.priority,
            active: true,
          })
          .select()
          .single();
        if (newRec) recId = newRec.id;
      }

      await (supabase.from('assessment_recommendations') as any)
        .insert({
          assessment_id: assessmentId,
          recommendation_id: recId,
        });

      generatedRecs.push({
        id: recId,
        category: rule.category,
        title: rule.title,
        description: rule.description,
        priority: rule.priority,
        active: true,
      });

      const { data: newTask } = await (supabase.from('student_tasks') as any)
        .insert({
          student_id: userId,
          assessment_id: assessmentId,
          category: rule.category,
          title: rule.task_title,
          description: rule.task_description,
          estimated_minutes: rule.estimated_minutes,
          task_type: 'action',
          due_date: cycleEndDate,
          status: 'pending',
          credits_awarded: rule.credits_awarded,
          source_reason: 'recommendation_engine',
        })
        .select()
        .single();

      if (newTask) {
        generatedTasks.push(newTask as unknown as StudentTask);
      }
    }

    return {
      success: true,
      recommendations: generatedRecs,
      tasks: generatedTasks,
    };
  } catch (err: any) {
    return {
      success: false,
      recommendations: [],
      tasks: [],
      error: err.message || 'Failed to generate recommendations.',
    };
  }
}

/**
 * Fetch recommendations for the student's latest completed assessment.
 */
export async function getStudentRecommendations(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Recommendation[]> {
  const { data: latest } = await (supabase.from('assessments') as any)
    .select('id')
    .eq('student_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (!latest) return [];

  const { data: links } = await (supabase.from('assessment_recommendations') as any)
    .select('recommendation_id')
    .eq('assessment_id', latest.id);

  if (!links || links.length === 0) return [];

  const recIds = links.map((l: any) => l.recommendation_id);
  const { data: recs } = await supabase
    .from('recommendations')
    .select('*')
    .in('id', recIds)
    .order('priority', { ascending: false });

  return (recs || []) as Recommendation[];
}

/**
 * Fetch recommendations for a specific assessment ID.
 */
export async function getRecommendationsForAssessment(
  supabase: SupabaseClient<Database>,
  assessmentId: string
): Promise<Recommendation[]> {
  const { data: links } = await (supabase.from('assessment_recommendations') as any)
    .select('recommendation_id')
    .eq('assessment_id', assessmentId);

  if (!links || links.length === 0) return [];

  const recIds = links.map((l: any) => l.recommendation_id);
  const { data: recs } = await supabase
    .from('recommendations')
    .select('*')
    .in('id', recIds)
    .order('priority', { ascending: false });

  return (recs || []) as Recommendation[];
}
