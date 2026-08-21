import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type {
  Assessment,
  AssessmentCycle,
  AssessmentCategoryScore,
  Question,
  Recommendation,
  WellnessBand,
  WellnessCategory,
} from '../types/domain';
import { calculateCategoryScores, calculateOverallIndicator } from '../lib/scoring/engine';

export async function getActiveAssessmentCycle(
  supabase: SupabaseClient<Database>
): Promise<AssessmentCycle | null> {
  const { data, error } = await (supabase.from('weekly_cycles') as any)
    .select('*')
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .single();

  if (!error && data) return data as unknown as AssessmentCycle;

  const { data: legacy } = await supabase
    .from('assessment_cycles')
    .select('*')
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !legacy) return null;
  return legacy as AssessmentCycle;
}

export async function getStudentAssessmentForCycle(
  supabase: SupabaseClient<Database>,
  studentId: string,
  cycleId: string
): Promise<Assessment | null> {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('student_id', studentId)
    .eq('cycle_id', cycleId)
    .single();

  if (error || !data) return null;
  return data as Assessment;
}

export async function getStudentAssessmentHistory(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<Assessment[]> {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (error || !data) return [];

  const result: Assessment[] = [];
  for (const item of data as any[]) {
    if (item.cycle_id) {
      const { data: cycle } = await (supabase.from('weekly_cycles') as any)
        .select('*')
        .eq('id', item.cycle_id)
        .single();
      result.push({
        ...item,
        cycle: cycle || null,
      });
    } else {
      result.push(item);
    }
  }

  return result;
}

export async function getLatestCompletedAssessment(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<{
  assessment: Assessment;
  scores: AssessmentCategoryScore[];
} | null> {
  const { data: assessment } = await supabase
    .from('assessments')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (!assessment) return null;

  const { data: scores } = await supabase
    .from('assessment_category_scores')
    .select('*')
    .eq('assessment_id', (assessment as any).id);

  return {
    assessment: assessment as Assessment,
    scores: (scores || []) as AssessmentCategoryScore[],
  };
}

export async function getBaseQuestions(
  supabase: SupabaseClient<Database>,
  weekNumber?: number,
  departmentCode?: string
): Promise<Question[]> {
  let query = supabase
    .from('questions')
    .select('*, options:question_options(*)')
    .eq('is_base_question', true)
    .eq('active', true);

  if (weekNumber !== undefined) {
    query = query.eq('week_number', weekNumber);
  }

  if (departmentCode) {
    query = query.in('target_department', ['ALL', departmentCode]);
  }

  const { data: questionsData, error: qError } = await query.order('order_index');

  if (qError || !questionsData) return [];

  // Sort question options by order_index
  const sorted = questionsData.map((q: any) => ({
    ...q,
    options: (q.options || []).sort((a: any, b: any) => a.order_index - b.order_index),
  }));

  return sorted as unknown as Question[];
}

export async function getOrCreateStudentAssessment(
  supabase: SupabaseClient<Database>,
  studentId: string,
  cycleId: string
): Promise<Assessment | null> {
  const existing = await getStudentAssessmentForCycle(supabase, studentId, cycleId);
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('assessments')
    .insert({
      student_id: studentId,
      cycle_id: cycleId,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    } as any)
    .select()
    .single();

  if (error || !created) return null;
  return created as Assessment;
}

export async function getAdaptiveFollowUpQuestions(
  supabase: SupabaseClient<Database>,
  baseResponses: Array<{ questionId: string; category: WellnessCategory; score: number; weight: number }>
): Promise<Question[]> {
  // 1. Calculate normalized 0-10 category indicators from base responses
  const categoryScores = calculateCategoryScores(baseResponses);
  const categoryScoreMap = new Map<WellnessCategory, number>(
    categoryScores.map((cs) => [cs.category, cs.score])
  );

  // 2. Fetch active adaptive rules
  const { data: rulesData } = await supabase
    .from('question_rules')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: true });

  const rules = (rulesData || []) as any[];
  if (rules.length === 0) return [];

  const followUpIds: string[] = [];

  // 3. Evaluate adaptive rules against normalized category indicators
  for (const rule of rules) {
    const categoryIndicator = categoryScoreMap.get(rule.target_category);
    if (categoryIndicator !== undefined) {
      const isTriggered =
        rule.operator === 'less_than_or_equal'
          ? categoryIndicator <= rule.threshold
          : rule.operator === 'less_than'
          ? categoryIndicator < rule.threshold
          : categoryIndicator === rule.threshold;

      if (isTriggered && !followUpIds.includes(rule.follow_up_question_id)) {
        followUpIds.push(rule.follow_up_question_id);
      }
    }
  }

  if (followUpIds.length === 0) return [];

  const { data: followUpQuestions } = await supabase
    .from('questions')
    .select('*, options:question_options(*)')
    .in('id', followUpIds)
    .eq('active', true);

  if (!followUpQuestions) return [];

  const sorted = followUpQuestions.map((q: any) => ({
    ...q,
    options: (q.options || []).sort((a: any, b: any) => a.order_index - b.order_index),
  }));

  return sorted as unknown as Question[];
}

export async function saveAssessmentResponses(
  supabase: SupabaseClient<Database>,
  assessmentId: string,
  responses: Array<{
    questionId: string;
    selectedOptionId?: string;
    textResponse?: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  const responseInserts = responses.map((r) => ({
    assessment_id: assessmentId,
    question_id: r.questionId,
    selected_option_id: r.selectedOptionId || null,
    text_response: r.textResponse || null,
  }));

  const { error } = await supabase
    .from('assessment_responses')
    .upsert(responseInserts as any, { onConflict: 'assessment_id,question_id' });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function submitAssessmentResponsesAndScore(
  supabase: SupabaseClient<Database>,
  assessmentId: string,
  rawResponses: Array<{
    questionId: string;
    category: WellnessCategory;
    selectedOptionId?: string;
    score: number;
    weight: number;
    textResponse?: string;
  }>
): Promise<{ success: boolean; overallBand?: WellnessBand; error?: string }> {
  // Save/upsert all responses
  const saveResult = await saveAssessmentResponses(
    supabase,
    assessmentId,
    rawResponses.map((r) => ({
      questionId: r.questionId,
      selectedOptionId: r.selectedOptionId,
      textResponse: r.textResponse,
    }))
  );

  if (!saveResult.success) {
    return { success: false, error: saveResult.error };
  }

  // Calculate scores
  const categoryScores = calculateCategoryScores(
    rawResponses.map((r) => ({
      category: r.category,
      score: r.score,
      weight: r.weight,
    }))
  );

  const { overallScore, overallBand } = calculateOverallIndicator(categoryScores);

  // Insert category scores
  const scoreInserts = categoryScores.map((cs) => ({
    assessment_id: assessmentId,
    category: cs.category,
    score: cs.score,
    band: cs.band,
  }));

  await supabase
    .from('assessment_category_scores')
    .upsert(scoreInserts as any, { onConflict: 'assessment_id,category' });

  // Select matching recommendations
  const categoriesToRecommend = categoryScores
    .filter((cs) => cs.band === 'needs_attention' || cs.band === 'elevated')
    .map((cs) => cs.category);

  if (categoriesToRecommend.length > 0) {
    const recs = await getRecommendationsForAssessment(supabase, categoriesToRecommend);
    if (recs.length > 0) {
      const recInserts = recs.map((rec) => ({
        assessment_id: assessmentId,
        recommendation_id: rec.id,
      }));
      await supabase.from('assessment_recommendations').insert(recInserts as any);
    }
  }

  // Update assessment status to completed
  await (supabase.from('assessments' as any) as any)
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      overall_indicator: overallScore,
      overall_band: overallBand,
    })
    .eq('id', assessmentId);

  return { success: true, overallBand };
}

export async function getRecommendationsForAssessment(
  supabase: SupabaseClient<Database>,
  categories: WellnessCategory[]
): Promise<Recommendation[]> {
  if (categories.length === 0) return [];

  const { data, error } = await supabase
    .from('recommendations')
    .select('*')
    .in('category', categories)
    .eq('active', true)
    .order('priority', { ascending: false });

  if (error || !data) return [];
  return data as Recommendation[];
}

export async function getAssessmentDetails(
  supabase: SupabaseClient<Database>,
  assessmentId: string,
  studentId: string
): Promise<{
  assessment: Assessment;
  scores: AssessmentCategoryScore[];
  recommendations: Recommendation[];
} | null> {
  const { data: assessment } = await supabase
    .from('assessments')
    .select('*, cycle:assessment_cycles(*)')
    .eq('id', assessmentId)
    .eq('student_id', studentId)
    .single();

  if (!assessment) return null;

  const { data: scores } = await supabase
    .from('assessment_category_scores')
    .select('*')
    .eq('assessment_id', assessmentId);

  const { data: recLinks } = await supabase
    .from('assessment_recommendations')
    .select('recommendation_id')
    .eq('assessment_id', assessmentId);

  let recommendations: Recommendation[] = [];

  if (recLinks && recLinks.length > 0) {
    const recIds = recLinks.map((r: any) => r.recommendation_id);
    const { data: recData } = await supabase
      .from('recommendations')
      .select('*')
      .in('id', recIds);
    if (recData) recommendations = recData as Recommendation[];
  }

  return {
    assessment: assessment as unknown as Assessment,
    scores: (scores || []) as AssessmentCategoryScore[],
    recommendations,
  };
}
