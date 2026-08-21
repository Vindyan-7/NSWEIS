import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { StudentTask, StudentCreditLog } from '../types/domain';

export interface StudentProgressSummary {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  completionPercentage: number;
  weeklyParticipation: Array<{
    weekNumber: number;
    checkInCompleted: boolean;
    completedTasksCount: number;
    creditsEarned: number;
  }>;
}

export interface StudentCreditBalance {
  currentBalance: number;
  thisWeekEarned: number;
  totalEarned: number;
}

/**
 * Fetch all tasks assigned to the authenticated student.
 */
export async function getStudentTasks(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StudentTask[]> {
  const { data, error } = await supabase
    .from('student_tasks')
    .select('*')
    .eq('student_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as unknown as StudentTask[];
}

/**
 * Fetch active tasks (pending or in_progress) assigned to the authenticated student.
 */
export async function getActiveStudentTasks(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StudentTask[]> {
  const { data, error } = await supabase
    .from('student_tasks')
    .select('*')
    .eq('student_id', userId)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as unknown as StudentTask[];
}

/**
 * Fetch completed tasks assigned to the authenticated student.
 */
export async function getCompletedStudentTasks(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StudentTask[]> {
  const { data, error } = await supabase
    .from('student_tasks')
    .select('*')
    .eq('student_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (error || !data) return [];
  return data as unknown as StudentTask[];
}

/**
 * Calculate overall well-being credit balance from the student_credits_log ledger.
 */
export async function getStudentCreditBalance(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StudentCreditBalance> {
  const { data, error } = await (supabase.from('student_credits_log') as any)
    .select('amount, created_at')
    .eq('student_id', userId);

  if (error || !data || data.length === 0) {
    return { currentBalance: 0, thisWeekEarned: 0, totalEarned: 0 };
  }

  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0, 0, 0, 0);

  let currentBalance = 0;
  let thisWeekEarned = 0;
  let totalEarned = 0;

  for (const row of data as any[]) {
    const amt = row.amount || 0;
    currentBalance += amt;
    if (amt > 0) totalEarned += amt;

    const createdAt = new Date(row.created_at);
    if (createdAt >= startOfWeek && amt > 0) {
      thisWeekEarned += amt;
    }
  }

  return { currentBalance, thisWeekEarned, totalEarned };
}

/**
 * Fetch student credit history log entries.
 */
export async function getStudentCreditHistory(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StudentCreditLog[]> {
  const { data, error } = await (supabase.from('student_credits_log') as any)
    .select('id, student_id, amount, activity_type, description, created_at')
    .eq('student_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as unknown as StudentCreditLog[];
}

/**
 * Calculate student participation and task progress overview.
 */
export async function getStudentProgress(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StudentProgressSummary> {
  const allTasks = await getStudentTasks(supabase, userId);
  const completedTasksList = allTasks.filter((t) => t.status === 'completed');
  const activeTasksList = allTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');

  const totalTasks = allTasks.length;
  const completedTasks = completedTasksList.length;
  const activeTasks = activeTasksList.length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Fetch student completed assessments to derive weekly participation
  let { data: cycles } = await (supabase.from('weekly_cycles') as any)
    .select('id, week_number')
    .order('week_number', { ascending: true });

  if (!cycles || cycles.length === 0) {
    const { data: legacyCycles } = await (supabase.from('assessment_cycles') as any)
      .select('id, week_number')
      .order('week_number', { ascending: true });
    cycles = legacyCycles;
  }

  const { data: assessments } = await (supabase.from('assessments') as any)
    .select('cycle_id, status')
    .eq('student_id', userId)
    .eq('status', 'completed');

  const completedCycleIds = new Set(((assessments as any[]) || []).map((a) => a.cycle_id));

  const weeklyParticipation: Array<{
    weekNumber: number;
    checkInCompleted: boolean;
    completedTasksCount: number;
    creditsEarned: number;
  }> = [];

  const activeCycles = cycles && cycles.length > 0 ? cycles : [{ id: 'w1', week_number: 1 }, { id: 'w2', week_number: 2 }, { id: 'w3', week_number: 3 }, { id: 'w4', week_number: 4 }];

  for (const cycle of activeCycles) {
    const isCheckInDone = completedCycleIds.has(cycle.id);
    weeklyParticipation.push({
      weekNumber: cycle.week_number,
      checkInCompleted: isCheckInDone,
      completedTasksCount: completedTasks,
      creditsEarned: completedTasks * 10,
    });
  }

  return {
    totalTasks,
    completedTasks,
    activeTasks,
    completionPercentage,
    weeklyParticipation,
  };
}

/**
 * Execute controlled task completion via SECURITY DEFINER RPC.
 */
export async function completeStudentTask(
  supabase: SupabaseClient<Database>,
  taskId: string
): Promise<{ success: boolean; error?: string; alreadyCompleted?: boolean; creditsAwarded?: number }> {
  const { data, error } = await (supabase as any).rpc('complete_student_task', {
    p_task_id: taskId,
  });

  if (error) {
    return { success: false, error: 'Unable to complete this activity right now. Please try again.' };
  }

  const res = data as any;
  if (!res || !res.success) {
    return { success: false, error: 'Unable to complete this activity right now. Please try again.' };
  }

  return {
    success: true,
    alreadyCompleted: !!res.already_completed,
    creditsAwarded: res.credits_awarded || 0,
  };
}
