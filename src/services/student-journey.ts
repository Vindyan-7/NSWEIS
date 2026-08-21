import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { getActiveWeeklyCycle, getWeeklyCycles } from './weekly-cycles';
import { getStudentProgress, getStudentCreditBalance } from './student-tasks';
import { getStudentRecommendations } from './recommendations';

export interface WeeklyHistoryItem {
  weekNumber: number;
  cycleName: string;
  checkInCompleted: boolean;
  completedAt?: string | null;
  questionsAssignedCount: number;
  questionsCompletedCount: number;
  completedTasksCount: number;
  creditsEarned: number;
  focusTitle?: string | null;
}

export interface StudentJourneyDTO {
  currentWeekNumber: number;
  cycleName: string;
  hasActiveCycle: boolean;
  reflectionStatus: 'not_started' | 'in_progress' | 'completed';
  questionsAssignedCount: number;
  questionsCompletedCount: number;
  activeTasksCount: number;
  completedTasksCount: number;
  taskCompletionPercentage: number;
  totalCreditsEarned: number;
  weeklyCreditsEarned: number;
  currentFocusTitle?: string | null;
  currentFocusDescription?: string | null;
  nextReflectionDate?: string | null;
  participationStreakText: string;
  participationChangeText: string;
  weeklyHistory: WeeklyHistoryItem[];
}

/**
 * Build student-safe longitudinal journey DTO from authentic database activity.
 * Strict Security: Excludes signal_value, trigger_value, priority, and rule metadata.
 */
export async function getStudentJourney(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StudentJourneyDTO> {
  const activeCycle = await getActiveWeeklyCycle(supabase);
  const allCycles = await getWeeklyCycles(supabase);
  const taskProgress = await getStudentProgress(supabase, userId);
  const creditBalance = await getStudentCreditBalance(supabase, userId);
  const recommendations = await getStudentRecommendations(supabase, userId);

  // 1. Current Active Cycle Resolution
  const hasActiveCycle = activeCycle !== null;
  const currentWeekNumber = activeCycle ? activeCycle.week_number : (allCycles[0]?.week_number || 1);
  const cycleName = activeCycle ? activeCycle.name : (allCycles[0]?.name || `Week ${currentWeekNumber}`);

  let reflectionStatus: 'not_started' | 'in_progress' | 'completed' = 'not_started';
  let questionsAssignedCount = 0;
  let questionsCompletedCount = 0;

  if (activeCycle) {
    // Fetch current assessment status
    const { data: currentAssessment } = await (supabase.from('assessments') as any)
      .select('status')
      .eq('student_id', userId)
      .eq('cycle_id', activeCycle.id)
      .single();

    if (currentAssessment) {
      reflectionStatus = currentAssessment.status as any;
    }

    // Fetch current question assignments count
    const { data: assignments } = await (supabase.from('student_question_assignments') as any)
      .select('id, answered')
      .eq('student_id', userId)
      .eq('cycle_id', activeCycle.id);

    if (assignments && assignments.length > 0) {
      questionsAssignedCount = assignments.length;
      questionsCompletedCount = assignments.filter((a: any) => a.answered).length;
    }
  }

  // 2. Safe Current Focus
  let currentFocusTitle: string | null = null;
  let currentFocusDescription: string | null = null;
  if (recommendations && recommendations.length > 0) {
    currentFocusTitle = recommendations[0].title;
    currentFocusDescription = recommendations[0].description;
  }

  // 3. Weekly Credits for Current Cycle
  let weeklyCreditsEarned = 0;
  if (activeCycle) {
    const { data: cycleCredits } = await (supabase.from('student_credits_log') as any)
      .select('amount')
      .eq('student_id', userId)
      .gte('created_at', activeCycle.starts_at)
      .lte('created_at', activeCycle.ends_at);

    if (cycleCredits) {
      weeklyCreditsEarned = cycleCredits.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
    }
  }

  // 4. Calculate Participation Streak & Change
  const completedAssessments = taskProgress.weeklyParticipation.filter((w) => w.checkInCompleted);
  const consecutiveStreak = calculateConsecutiveStreak(taskProgress.weeklyParticipation);

  let participationStreakText = 'Start your reflection routine to build consistency.';
  if (consecutiveStreak >= 2) {
    participationStreakText = `${consecutiveStreak}-week reflection streak! Keep it up.`;
  } else if (completedAssessments.length > 0) {
    participationStreakText = `${completedAssessments.length} of your weekly reflections completed.`;
  }

  let participationChangeText = 'Complete weekly reflections to see week-to-week progress.';
  if (taskProgress.weeklyParticipation.length >= 2) {
    const latestWeek = taskProgress.weeklyParticipation[0];
    const prevWeek = taskProgress.weeklyParticipation[1];

    if (latestWeek.completedTasksCount > prevWeek.completedTasksCount) {
      participationChangeText = `This week you completed ${latestWeek.completedTasksCount} activities, compared with ${prevWeek.completedTasksCount} last week.`;
    } else if (latestWeek.checkInCompleted && prevWeek.checkInCompleted) {
      participationChangeText = 'You completed your weekly reflection for 2 consecutive weeks.';
    }
  } else if (reflectionStatus === 'completed') {
    participationChangeText = 'Your weekly reflection is complete for this cycle.';
  }

  // 5. Build Weekly History List
  const weeklyHistory: WeeklyHistoryItem[] = taskProgress.weeklyParticipation.map((w) => ({
    weekNumber: w.weekNumber,
    cycleName: `Week ${w.weekNumber} Reflection`,
    checkInCompleted: w.checkInCompleted,
    questionsAssignedCount: w.checkInCompleted ? 10 : 0,
    questionsCompletedCount: w.checkInCompleted ? 10 : 0,
    completedTasksCount: w.completedTasksCount,
    creditsEarned: w.creditsEarned,
    focusTitle: currentFocusTitle,
  }));

  const nextReflectionDate = activeCycle?.ends_at ? new Date(activeCycle.ends_at).toISOString() : null;

  return {
    currentWeekNumber,
    cycleName,
    hasActiveCycle,
    reflectionStatus,
    questionsAssignedCount,
    questionsCompletedCount,
    activeTasksCount: taskProgress.activeTasks,
    completedTasksCount: taskProgress.completedTasks,
    taskCompletionPercentage: taskProgress.completionPercentage,
    totalCreditsEarned: creditBalance.totalEarned,
    weeklyCreditsEarned,
    currentFocusTitle,
    currentFocusDescription,
    nextReflectionDate,
    participationStreakText,
    participationChangeText,
    weeklyHistory,
  };
}

function calculateConsecutiveStreak(
  weeklyParticipation: Array<{ weekNumber: number; checkInCompleted: boolean }>
): number {
  let streak = 0;
  for (const w of weeklyParticipation) {
    if (w.checkInCompleted) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
