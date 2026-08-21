import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { Question, WellnessCategory, StudentQuestionAssignment, WeeklyCycle } from '../types/domain';
import { getActiveWeeklyCycle, getWeeklyCycleById } from './weekly-cycles';

export interface CategorySignal {
  category: WellnessCategory;
  signalValue: number;
  sampleCount: number;
}

export interface StudentTaskStates {
  incompleteCategories: Set<WellnessCategory>;
  completedCategories: Set<WellnessCategory>;
}

export interface RuleEvaluationContext {
  categorySignals: Map<WellnessCategory, number>;
  taskStates: StudentTaskStates;
}

export interface CandidateQuestion {
  question: Question;
  applicableRulePriority?: number;
  categorySignal?: number;
}

/**
 * Calculate category-level support signals (0.0 - 10.0 scale) from student assessment responses.
 */
export function calculateCategorySignals(
  responses: Array<{ category: WellnessCategory; signalValue?: number | null }>
): Map<WellnessCategory, number> {
  const categoryMap = new Map<WellnessCategory, { sum: number; count: number }>();

  for (const r of responses) {
    if (r.category && r.signalValue !== undefined && r.signalValue !== null && !isNaN(r.signalValue)) {
      if (!categoryMap.has(r.category)) {
        categoryMap.set(r.category, { sum: 0, count: 0 });
      }
      const data = categoryMap.get(r.category)!;
      data.sum += r.signalValue;
      data.count += 1;
    }
  }

  const result = new Map<WellnessCategory, number>();
  for (const [cat, data] of categoryMap.entries()) {
    if (data.count > 0) {
      result.set(cat, Math.round((data.sum / data.count) * 10) / 10);
    }
  }

  return result;
}

/**
 * Extract incomplete and completed task categories for a student.
 */
export function extractTaskStates(
  tasks: Array<{ category: WellnessCategory; status: string }>
): StudentTaskStates {
  const incompleteCategories = new Set<WellnessCategory>();
  const completedCategories = new Set<WellnessCategory>();

  for (const t of tasks) {
    if (t.status === 'pending' || t.status === 'in_progress') {
      incompleteCategories.add(t.category);
    } else if (t.status === 'completed') {
      completedCategories.add(t.category);
    }
  }

  return { incompleteCategories, completedCategories };
}

/**
 * Evaluate if a selection rule is triggered by student category signals or task states.
 */
export function evaluateSelectionRule(
  rule: {
    trigger_category?: WellnessCategory | null;
    trigger_condition: string;
    trigger_value?: number | null;
    enabled: boolean;
  },
  context: RuleEvaluationContext
): boolean {
  if (!rule.enabled) return false;

  const cat = rule.trigger_category;
  const cond = rule.trigger_condition;
  const val = rule.trigger_value ?? 5.0;

  // Task-aware conditions
  if (cond === 'task_incomplete') {
    if (cat) return context.taskStates.incompleteCategories.has(cat);
    return context.taskStates.incompleteCategories.size > 0;
  }
  if (cond === 'task_completed') {
    if (cat) return context.taskStates.completedCategories.has(cat);
    return context.taskStates.completedCategories.size > 0;
  }

  // Signal-based conditions
  if (cat) {
    const signalVal = context.categorySignals.get(cat);
    if (signalVal === undefined) return false; // Category not answered yet

    if (cond === 'below' || cond === 'signal_lte') return signalVal < val;
    if (cond === 'at_or_below') return signalVal <= val;
    if (cond === 'above' || cond === 'signal_gte') return signalVal > val;
    if (cond === 'at_or_above') return signalVal >= val;
  }

  return false;
}

/**
 * Check if a question is blocked by cooldown_weeks or maximum_uses.
 */
export function isQuestionEligibleByHistory(
  question: Question,
  previousAssignments: Array<{ question_id: string; week_number: number }>,
  currentWeekNumber: number
): boolean {
  const qAssignments = previousAssignments.filter((a) => a.question_id === question.id);

  // Maximum uses check
  if (question.maximum_uses !== undefined && question.maximum_uses !== null) {
    if (qAssignments.length >= question.maximum_uses) {
      return false; // Exhausted maximum uses
    }
  }

  // Cooldown weeks check
  if (question.cooldown_weeks && question.cooldown_weeks > 0) {
    for (const assign of qAssignments) {
      const weeksAgo = currentWeekNumber - assign.week_number;
      if (weeksAgo >= 0 && weeksAgo <= question.cooldown_weeks) {
        return false; // Currently in cooldown window
      }
    }
  }

  return true;
}

/**
 * Select configured number of common questions for a student.
 */
export function selectCommonQuestions(
  candidateQuestions: Question[],
  assignedQuestionIds: Set<string>,
  studentDepartment: string | null | undefined,
  previousAssignments: Array<{ question_id: string; week_number: number }>,
  currentWeekNumber: number,
  targetCount: number
): Question[] {
  const eligible = candidateQuestions.filter((q) => {
    if (!q.active) return false;
    if (assignedQuestionIds.has(q.id)) return false;

    // Department match check
    const deptMatch = !q.target_department || q.target_department === 'ALL' || (studentDepartment && q.target_department === studentDepartment);
    if (!deptMatch) return false;

    // History eligibility check (cooldown & max uses)
    if (!isQuestionEligibleByHistory(q, previousAssignments, currentWeekNumber)) return false;

    return true;
  });

  // Sort deterministically: week_number ASC, order_index ASC, question_code ASC
  const sorted = [...eligible].sort((a, b) => {
    if ((a.week_number || 1) !== (b.week_number || 1)) {
      return (a.week_number || 1) - (b.week_number || 1);
    }
    if (a.order_index !== b.order_index) {
      return a.order_index - b.order_index;
    }
    return (a.question_code || '').localeCompare(b.question_code || '');
  });

  return sorted.slice(0, targetCount);
}

/**
 * Select configured number of adaptive questions for a student with category diversity.
 */
export function selectAdaptiveQuestions(
  candidateQuestions: Question[],
  selectionRules: Array<{
    id: string;
    question_id: string;
    trigger_category?: WellnessCategory | null;
    trigger_condition: string;
    trigger_value?: number | null;
    priority: number;
    enabled: boolean;
  }>,
  evaluationContext: RuleEvaluationContext,
  assignedQuestionIds: Set<string>,
  studentDepartment: string | null | undefined,
  previousAssignments: Array<{ question_id: string; week_number: number }>,
  currentWeekNumber: number,
  targetCount: number
): Question[] {
  if (targetCount <= 0) return [];

  // 1. Evaluate applicable rules
  const applicableRules = selectionRules.filter((r) => evaluateSelectionRule(r, evaluationContext));
  const ruleByQuestionId = new Map<string, { priority: number; category?: WellnessCategory | null }>();

  for (const r of applicableRules) {
    if (!ruleByQuestionId.has(r.question_id) || ruleByQuestionId.get(r.question_id)!.priority < r.priority) {
      ruleByQuestionId.set(r.question_id, { priority: r.priority, category: r.trigger_category });
    }
  }

  // 2. Filter candidate questions
  const eligibleCandidates: CandidateQuestion[] = [];
  for (const q of candidateQuestions) {
    if (!q.active) continue;
    if (q.adaptive_enabled === false) continue; // Adaptive disabled for this question
    if (assignedQuestionIds.has(q.id)) continue;

    // Department match check
    const deptMatch = !q.target_department || q.target_department === 'ALL' || (studentDepartment && q.target_department === studentDepartment);
    if (!deptMatch) continue;

    // History eligibility check
    if (!isQuestionEligibleByHistory(q, previousAssignments, currentWeekNumber)) continue;

    // Rule match check
    const ruleInfo = ruleByQuestionId.get(q.id);
    if (!ruleInfo) continue; // No applicable rule triggered for this question

    eligibleCandidates.push({
      question: q,
      applicableRulePriority: ruleInfo.priority,
      categorySignal: evaluationContext.categorySignals.get(q.category) ?? 5.0,
    });
  }

  // 3. Sort deterministically by priority DESC, category signal ASC (lower signal = higher support need), order_index ASC
  eligibleCandidates.sort((a, b) => {
    const priA = a.applicableRulePriority ?? 0;
    const priB = b.applicableRulePriority ?? 0;
    if (priA !== priB) return priB - priA;

    const sigA = a.categorySignal ?? 5.0;
    const sigB = b.categorySignal ?? 5.0;
    if (sigA !== sigB) return sigA - sigB;

    return a.question.order_index - b.question.order_index;
  });

  // 4. Enforce Category Diversity
  const selected: Question[] = [];
  const selectedCategories = new Set<WellnessCategory>();

  // Pass 1: Select highest priority candidate from unique categories
  for (const cand of eligibleCandidates) {
    if (!selectedCategories.has(cand.question.category)) {
      selected.push(cand.question);
      selectedCategories.add(cand.question.category);
      if (selected.length === targetCount) break;
    }
  }

  // Pass 2: Fill remaining slots if fewer unique categories were available
  if (selected.length < targetCount) {
    for (const cand of eligibleCandidates) {
      if (!selected.some((q) => q.id === cand.question.id)) {
        selected.push(cand.question);
        if (selected.length === targetCount) break;
      }
    }
  }

  return selected;
}

/**
 * Main Deterministic Selection Engine:
 * Generates personalized weekly question assignments for a student and target weekly cycle.
 * Enforces database idempotency, category diversity, cooldowns, and department targeting.
 */
export async function generateStudentQuestionAssignment(
  supabase: SupabaseClient<Database>,
  studentId: string,
  cycleId: string,
  studentDepartment?: string | null
): Promise<{
  success: boolean;
  assignments: StudentQuestionAssignment[];
  alreadyAssigned?: boolean;
  error?: string;
}> {
  try {
    // 1. Idempotency Check: check if assignments already exist for (studentId, cycleId)
    const { data: existingAssignments } = await (supabase.from('student_question_assignments') as any)
      .select('*')
      .eq('student_id', studentId)
      .eq('cycle_id', cycleId)
      .order('position', { ascending: true });

    if (existingAssignments && existingAssignments.length > 0) {
      return {
        success: true,
        alreadyAssigned: true,
        assignments: existingAssignments as StudentQuestionAssignment[],
      };
    }

    // 2. Fetch Active Weekly Cycle Configuration
    const cycle: WeeklyCycle | null = await getWeeklyCycleById(supabase, cycleId) || await getActiveWeeklyCycle(supabase);
    if (!cycle) {
      return { success: false, assignments: [], error: 'Active weekly cycle configuration not found.' };
    }

    // 3. Fetch Student's Previous Assessment Responses & Signals
    const { data: previousAssessments } = await (supabase.from('assessments') as any)
      .select('id, completed_at, cycle:weekly_cycles(week_number)')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    let latestAssessmentId: string | null = null;
    if (previousAssessments && previousAssessments.length > 0) {
      latestAssessmentId = previousAssessments[0].id;
    }

    const rawResponses: Array<{ category: WellnessCategory; signalValue?: number | null }> = [];
    if (latestAssessmentId) {
      const { data: respData } = await (supabase.from('assessment_responses') as any)
        .select('question:questions(category), option:question_options(signal_value, score)')
        .eq('assessment_id', latestAssessmentId);

      if (respData) {
        for (const r of respData) {
          if (r.question?.category) {
            rawResponses.push({
              category: r.question.category as WellnessCategory,
              signalValue: r.option?.signal_value ?? r.option?.score,
            });
          }
        }
      }
    }

    const categorySignals = calculateCategorySignals(rawResponses);

    // 4. Fetch Student's Generated Task States
    const { data: taskData } = await (supabase.from('student_tasks') as any)
      .select('category, status')
      .eq('student_id', studentId);

    const taskStates = extractTaskStates(taskData || []);

    const evaluationContext: RuleEvaluationContext = {
      categorySignals,
      taskStates,
    };

    // 5. Fetch Previous Student Question Assignment History
    const { data: historyData } = await (supabase.from('student_question_assignments') as any)
      .select('question_id, cycle:weekly_cycles(week_number)')
      .eq('student_id', studentId);

    const previousAssignments: Array<{ question_id: string; week_number: number }> = [];
    if (historyData) {
      for (const h of historyData) {
        previousAssignments.push({
          question_id: h.question_id,
          week_number: h.cycle?.week_number || 1,
        });
      }
    }

    // 6. Fetch Master Question Library & Selection Rules
    const { data: allQuestionsData } = await (supabase.from('questions') as any)
      .select('*, options:question_options(*)')
      .eq('active', true)
      .order('order_index', { ascending: true });

    const allQuestions = (allQuestionsData || []) as Question[];

    const { data: selectionRulesData } = await (supabase.from('question_selection_rules') as any)
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: false });

    const selectionRules = (selectionRulesData || []) as any[];

    // 7. Execute Adaptive & Common Question Selection
    const assignedQuestionIds = new Set<string>();

    const adaptiveCount = cycle.adaptive_questions_enabled ? cycle.adaptive_questions : 0;
    const commonCount = cycle.total_questions - adaptiveCount;

    // A. Select Common Questions (Positions 1-7)
    const selectedCommon = selectCommonQuestions(
      allQuestions,
      assignedQuestionIds,
      studentDepartment,
      previousAssignments,
      cycle.week_number,
      commonCount
    );

    for (const q of selectedCommon) {
      assignedQuestionIds.add(q.id);
    }

    // B. Select Adaptive Questions via Selection Rules
    let selectedAdaptive = selectAdaptiveQuestions(
      allQuestions,
      selectionRules,
      evaluationContext,
      assignedQuestionIds,
      studentDepartment,
      previousAssignments,
      cycle.week_number,
      adaptiveCount
    );

    for (const q of selectedAdaptive) {
      assignedQuestionIds.add(q.id);
    }

    // C. Fill remaining adaptive slots if fewer than adaptiveCount were selected via rules (e.g., Week 1 baseline with no prior signals)
    if (selectedAdaptive.length < adaptiveCount) {
      const needed = adaptiveCount - selectedAdaptive.length;
      const fallbackAdaptive = allQuestions.filter((q) => {
        if (!q.active) return false;
        if (q.adaptive_enabled === false) return false;
        if (assignedQuestionIds.has(q.id)) return false;
        const deptMatch = !q.target_department || q.target_department === 'ALL' || (studentDepartment && q.target_department === studentDepartment);
        if (!deptMatch) return false;
        if (!isQuestionEligibleByHistory(q, previousAssignments, cycle.week_number)) return false;
        return true;
      }).sort((a, b) => a.order_index - b.order_index).slice(0, needed);

      for (const q of fallbackAdaptive) {
        assignedQuestionIds.add(q.id);
      }
      selectedAdaptive = [...selectedAdaptive, ...fallbackAdaptive];
    }

    // D. Top-up safety: Ensure total assigned questions equals cycle.total_questions (10)
    const totalTarget = cycle.total_questions;
    let totalAssigned = selectedCommon.length + selectedAdaptive.length;

    if (totalAssigned < totalTarget) {
      const topUpNeeded = totalTarget - totalAssigned;
      const topUpQuestions = allQuestions.filter((q) => {
        if (!q.active) return false;
        if (assignedQuestionIds.has(q.id)) return false;
        const deptMatch = !q.target_department || q.target_department === 'ALL' || (studentDepartment && q.target_department === studentDepartment);
        if (!deptMatch) return false;
        if (!isQuestionEligibleByHistory(q, previousAssignments, cycle.week_number)) return false;
        return true;
      }).sort((a, b) => a.order_index - b.order_index).slice(0, topUpNeeded);

      for (const q of topUpQuestions) {
        assignedQuestionIds.add(q.id);
      }
      selectedAdaptive = [...selectedAdaptive, ...topUpQuestions];
    }

    // Combine: Common questions first, followed by Adaptive questions
    const finalSelected: Array<{ question: Question; selectionType: 'common' | 'adaptive' }> = [
      ...selectedCommon.map((q) => ({ question: q, selectionType: 'common' as const })),
      ...selectedAdaptive.map((q) => ({ question: q, selectionType: 'adaptive' as const })),
    ];

    if (finalSelected.length === 0) {
      return { success: false, assignments: [], error: 'No eligible questions available in library.' };
    }

    // 8. Insert Assignments into public.student_question_assignments
    const inserts = finalSelected.map((item, idx) => ({
      student_id: studentId,
      cycle_id: cycleId,
      question_id: item.question.id,
      selection_type: item.selectionType,
      selection_priority: item.selectionType === 'adaptive' ? 100 : 50,
      position: idx + 1,
      answered: false,
    }));

    const { data: createdAssignments, error: insertError } = await (supabase.from('student_question_assignments') as any)
      .insert(inserts)
      .select();

    if (insertError) {
      return { success: false, assignments: [], error: insertError.message };
    }

    return {
      success: true,
      assignments: (createdAssignments || []) as StudentQuestionAssignment[],
    };
  } catch (err: any) {
    return {
      success: false,
      assignments: [],
      error: err.message || 'Failed to generate student question assignments.',
    };
  }
}

/**
 * Fetch generated question assignments for a student and weekly cycle.
 */
export async function getStudentQuestionAssignments(
  supabase: SupabaseClient<Database>,
  studentId: string,
  cycleId: string
): Promise<Array<StudentQuestionAssignment & { question: Question }>> {
  const { data, error } = await (supabase.from('student_question_assignments') as any)
    .select('*, question:questions(*, options:question_options(*))')
    .eq('student_id', studentId)
    .eq('cycle_id', cycleId)
    .order('position', { ascending: true });

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    id: row.id,
    student_id: row.student_id,
    cycle_id: row.cycle_id,
    question_id: row.question_id,
    selection_type: row.selection_type as 'common' | 'adaptive',
    selection_priority: row.selection_priority,
    position: row.position,
    answered: row.answered,
    answered_at: row.answered_at,
    created_at: row.created_at,
    question: row.question as Question,
  }));
}
