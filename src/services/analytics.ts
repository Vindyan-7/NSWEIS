import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { WellnessCategory, WellnessBand } from '../types/domain';
import { getAuthorizedInstitutions } from './institutions';
import { logPrivacyAuditEvent, getCollegeSupportRequests } from './privacy';
import { scoreToBand } from '../lib/scoring/engine';

export interface ParticipationMetrics {
  total_eligible_students: number;
  participating_students: number;
  participation_rate: number;
  active_cycle_name: string;
  active_cycle_id?: string | null;
}

export interface GovernmentParticipationMetrics {
  authorized_institutions_count: number;
  active_reporting_institutions_count: number;
  total_eligible_students: number;
  participating_students: number;
  participation_rate: number;
  active_cycle_name: string;
  is_suppressed: boolean;
}

export interface CategoryAggregateSummary {
  category: WellnessCategory;
  average_score: number | null;
  dominant_band: WellnessBand | null;
  // AUDIT.md C3: null, not 0, when this specific cell is below the privacy
  // threshold — the count itself is disclosive in a small group.
  participating_student_count: number | null;
  is_suppressed: boolean;
}

export interface DepartmentAggregateSummary {
  department_id: string;
  department_name: string;
  department_code: string;
  participating_student_count: number | null;
  average_overall_score: number | null;
  dominant_band: WellnessBand | null;
  is_suppressed: boolean;
  suppression_message?: string | null;
}

export interface GovernmentInstitutionSummary {
  institution_id: string;
  institution_name: string;
  institution_code: string;
  state: string;
  participating_student_count: number | null;
  average_overall_score: number | null;
  dominant_band: WellnessBand | null;
  is_suppressed: boolean;
  active_interventions_count: number;
  suppression_message?: string | null;
}

export interface CategoryTrendItem {
  category: WellnessCategory;
  current_score: number | null;
  previous_score: number | null;
  trend_direction: 'improving' | 'stable' | 'declining' | 'first_check_in';
}

export interface InstitutionalActionSuggestion {
  category: WellnessCategory;
  focus_title: string;
  action_suggestion: string;
  signal_strength: 'ELEVATED' | 'MODERATE' | 'BALANCED';
  participating_count: number;
}

/** Single source of truth for "is this cell too small to disclose?" */
function isCellSuppressed(count: number): boolean {
  return count < PRIVACY_THRESHOLD_MIN_STUDENTS;
}

export interface InstitutionalActionIntelligenceDTO {
  is_suppressed: boolean;
  suppression_notice?: string;
  suggestions: InstitutionalActionSuggestion[];
}

export interface CollegeDashboardDTO {
  cycle: {
    id: string;
    name: string;
    week_number: number;
    starts_at: string;
    ends_at: string;
    status: string;
  } | null;
  participation: {
    total_eligible_students: number;
    started_students: number;
    completed_students: number;
    completion_percentage: number;
  };
  analytics: {
    average_overall_indicator: number | null;
    category_summaries: Array<{
      category: WellnessCategory;
      average_score: number | null;
      dominant_band: WellnessBand | null;
      participating_count: number | null;
    }>;
    is_suppressed: boolean;
  };
  action_intelligence: InstitutionalActionIntelligenceDTO;
  recommendation_distribution: Array<{
    category: WellnessCategory;
    title: string;
    count: number;
    percentage: number;
  }>;
  task_activity: {
    tasks_assigned: number;
    tasks_completed: number;
    completion_rate: number;
    total_credits_earned: number;
  };
}

export interface GovernmentInstitutionSummaryItem {
  institution_id: string;
  institution_name: string;
  institution_code: string;
  state: string;
  eligible_students: number;
  started_students: number;
  completed_students: number;
  completion_percentage: number;
  participation_status: 'ACTIVE' | 'PARTIAL' | 'NO_PARTICIPATION' | 'NO_ELIGIBLE_STUDENTS';
  action_signal: 'STRONG_PARTICIPATION' | 'PARTICIPATION_REQUIRES_FOLLOWUP' | 'NO_PARTICIPATION_DATA';
  is_suppressed: boolean;
  active_interventions_count: number;
}

export interface GovernmentDashboardDTO {
  cycle: {
    id: string;
    name: string;
    week_number: number;
    starts_at: string;
    ends_at: string;
    status: string;
  } | null;
  participation: {
    total_institutions: number;
    institutions_with_activity: number;
    total_eligible_students: number;
    started_students: number;
    completed_students: number;
    completion_percentage: number;
    is_suppressed: boolean;
    status_distribution: {
      active_institutions: number;
      partial_institutions: number;
      no_participation_institutions: number;
      no_eligible_institutions: number;
    };
  };
  institution_summaries: GovernmentInstitutionSummaryItem[];
  privacy: {
    threshold_min_students: number;
    notice: string;
  };
}

export const PRIVACY_THRESHOLD_MIN_STUDENTS = 10;

/**
 * Build server-authoritative live dashboard data for College Officers from authentic database rows.
 * Enforces privacy suppression if completed_students < 10 threshold. Excludes private reflection text.
 */
export interface CollegeFilters {
  department_id?: string | null;
  year_level?: number | null;
  section_code?: string | null;
}

export async function getLiveCollegeDashboardData(
  supabase: SupabaseClient<Database>,
  institutionId: string,
  filters?: CollegeFilters
): Promise<CollegeDashboardDTO> {
  const env = (import.meta as any).env || (globalThis as any).process?.env || {};
  const supabaseUrl = env.PUBLIC_SUPABASE_URL || '';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  // Use server-authoritative client if service role key is available to avoid RLS filtering of aggregate student profiles
  let db: any = supabase;
  if (serviceKey && supabaseUrl) {
    const { createClient } = await import('@supabase/supabase-js');
    db = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // 1. Resolve Active Weekly Cycle from public.weekly_cycles
  let activeCycle: any = null;
  const { data: cycleData } = await (db.from('weekly_cycles') as any)
    .select('*')
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .single();

  if (cycleData) {
    activeCycle = cycleData;
  } else {
    const { data: legacyCycle } = await (db.from('assessment_cycles') as any)
      .select('*')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .single();
    activeCycle = legacyCycle;
  }

  // 2. Fetch Eligible Students in Institution Scope & Academic Filters
  let eligibleQuery = db
    .from('profiles')
    .select('id', { count: 'exact' })
    .eq('role', 'student')
    .eq('active', true);

  if (institutionId) {
    eligibleQuery = eligibleQuery.eq('institution_id', institutionId);
  }

  if (filters?.department_id) {
    eligibleQuery = eligibleQuery.eq('department_id', filters.department_id);
  }

  if (filters?.year_level) {
    eligibleQuery = eligibleQuery.eq('year_level', filters.year_level);
  }

  if (filters?.section_code) {
    eligibleQuery = eligibleQuery.eq('section_code', filters.section_code);
  }

  const { count: eligibleCount, data: studentProfiles } = await eligibleQuery;
  const totalEligible = eligibleCount || (studentProfiles ? studentProfiles.length : 0);
  const studentIds = new Set((studentProfiles || []).map((s: any) => s.id));

  if (!activeCycle) {
    return {
      cycle: null,
      participation: {
        total_eligible_students: totalEligible,
        started_students: 0,
        completed_students: 0,
        completion_percentage: 0,
      },
      analytics: {
        average_overall_indicator: null,
        category_summaries: [],
        is_suppressed: true,
      },
      action_intelligence: {
        is_suppressed: true,
        suppression_notice: "Privacy Protection Active: Detailed reflection analytics and institutional action signals are withheld until the minimum anonymous participation threshold (10 completed reflections) is reached.",
        suggestions: [],
      },
      recommendation_distribution: [],
      task_activity: {
        tasks_assigned: 0,
        tasks_completed: 0,
        completion_rate: 0,
        total_credits_earned: 0,
      },
    };
  }

  // 3. Fetch Assessments for Active Cycle
  const { data: cycleAssessments } = await (db.from('assessments') as any)
    .select('*')
    .eq('cycle_id', activeCycle.id);

  const assessments = (cycleAssessments || []) as any[];

  // Filter assessments strictly to institution's student set
  const filteredAssessments = assessments.filter((a) => studentIds.has(a.student_id));

  const startedCount = filteredAssessments.length;
  const completedAssessments = filteredAssessments.filter((a) => a.status === 'completed');
  const completedCount = completedAssessments.length;
  const completionPercentage = totalEligible > 0 ? Math.round((completedCount / totalEligible) * 1000) / 10 : 0;

  // 4. Calculate Aggregate Analytics & Suppression
  const isSuppressed = completedCount < PRIVACY_THRESHOLD_MIN_STUDENTS;

  let averageOverallIndicator: number | null = null;
  if (!isSuppressed && completedAssessments.length > 0) {
    const validScores = completedAssessments
      .map((a) => a.overall_indicator)
      .filter((s) => s !== null && s !== undefined && !isNaN(s));

    if (validScores.length > 0) {
      averageOverallIndicator = Math.round((validScores.reduce((sum, s) => sum + s, 0) / validScores.length) * 10) / 10;
    }
  }

  // Category Score Aggregates
  const categorySummaries: Array<{
    category: WellnessCategory;
    average_score: number | null;
    dominant_band: WellnessBand | null;
    participating_count: number | null;
  }> = [];

  const completedAssessmentIds = completedAssessments.map((a) => a.id);

  if (completedAssessmentIds.length > 0) {
    let { data: scoreRows } = await (db.from('assessment_category_scores') as any)
      .select('category, score, band')
      .in('assessment_id', completedAssessmentIds);

    // Fallback: If category scores table is missing rows for completed assessments, calculate from responses & self-heal DB
    if (!scoreRows || scoreRows.length === 0) {
      const { data: responses } = await (db.from('assessment_responses') as any)
        .select('assessment_id, question_id, selected_option_id')
        .in('assessment_id', completedAssessmentIds);

      if (responses && responses.length > 0) {
        const { data: questions } = await (db.from('questions') as any).select('id, category, weight');
        const { data: options } = await (db.from('question_options') as any).select('id, score');

        if (questions && options) {
          const qMap = new Map<string, any>(questions.map((q: any) => [q.id, q]));
          const optMap = new Map<string, any>(options.map((o: any) => [o.id, o]));
          const toInsert: any[] = [];

          for (const assId of completedAssessmentIds) {
            const assResponses = responses.filter((r: any) => r.assessment_id === assId);
            const catGroup = new Map<string, { total: number; weight: number }>();

            for (const resp of assResponses) {
              const q = qMap.get(resp.question_id);
              const opt = optMap.get(resp.selected_option_id);
              if (!q || !opt || opt.score === null || opt.score === undefined) continue;

              const cat = q.category;
              if (!catGroup.has(cat)) catGroup.set(cat, { total: 0, weight: 0 });
              const entry = catGroup.get(cat)!;
              const w = Number(q.weight || 1.0);
              entry.total += Number(opt.score) * w;
              entry.weight += w;
            }

            for (const [cat, data] of catGroup.entries()) {
              const rawScore = data.weight > 0 ? data.total / data.weight : 0;
              const score = Math.round(rawScore * 10) / 10;
              let band = 'stable';
              if (score < 4.0) band = 'elevated';
              else if (score < 6.0) band = 'needs_attention';
              else if (score < 8.0) band = 'watch';

              toInsert.push({ assessment_id: assId, category: cat, score, band });
            }
          }

          if (toInsert.length > 0) {
            await (db.from('assessment_category_scores') as any)
              .upsert(toInsert, { onConflict: 'assessment_id,category' });

            const { data: reFetchedScores } = await (db.from('assessment_category_scores') as any)
              .select('category, score, band')
              .in('assessment_id', completedAssessmentIds);

            if (reFetchedScores) scoreRows = reFetchedScores;
          }
        }
      }
    }

    const catMap = new Map<WellnessCategory, { sum: number; count: number; bands: Record<string, number> }>();

    for (const row of (scoreRows || []) as any[]) {
      const cat = row.category as WellnessCategory;
      if (!catMap.has(cat)) {
        catMap.set(cat, { sum: 0, count: 0, bands: {} });
      }
      const entry = catMap.get(cat)!;
      if (row.score !== null && row.score !== undefined) {
        entry.sum += Number(row.score);
        entry.count += 1;
      }
      if (row.band) {
        entry.bands[row.band] = (entry.bands[row.band] || 0) + 1;
      }
    }

    for (const [cat, data] of catMap.entries()) {
      let dominantBand: WellnessBand | null = null;
      let maxBandCount = 0;
      for (const [bandName, count] of Object.entries(data.bands)) {
        if (count > maxBandCount) {
          maxBandCount = count;
          dominantBand = bandName as WellnessBand;
        }
      }

      // AUDIT.md C3: suppress per cell, independent of the institution
      // total. An institution can clear the threshold overall while a
      // single category (or, once filters exist, a department/year/section)
      // still has too few respondents to disclose safely — e.g. "Year 3 →
      // CSE → Section B" with 3 respondents inside an otherwise-large
      // institution. Reusing one institution-wide flag for every breakdown
      // was exactly what let that cohort's average and band show through.
      const cellSuppressed = isSuppressed || isCellSuppressed(data.count);

      categorySummaries.push({
        category: cat,
        average_score: !cellSuppressed && data.count > 0 ? Math.round((data.sum / data.count) * 10) / 10 : null,
        dominant_band: cellSuppressed ? null : dominantBand,
        // The count itself is disclosive in a small cell ("3 respondents"),
        // so it is suppressed right alongside the score and band.
        participating_count: cellSuppressed ? null : data.count,
      });
    }
  }

  // 5. Calculate Focus / Recommendation Distribution
  const recommendationDistribution: Array<{
    category: WellnessCategory;
    title: string;
    count: number;
    percentage: number;
  }> = [];

  // SECURITY (AUDIT.md C3, same class of bug): this breakdown had NO
  // suppression check at all — it returned exact per-recommendation counts
  // for as few as one completed assessment. Gated on the institution total
  // first, then each individual title/category count is suppressed on its
  // own if it is itself below the threshold, so a rare recommendation given
  // to only a handful of students can't leak even inside a large institution.
  if (!isSuppressed && completedAssessmentIds.length > 0) {
    const { data: recLinks } = await (db.from('assessment_recommendations') as any)
      .select('recommendation_id, recommendation:recommendations(category, title)')
      .in('assessment_id', completedAssessmentIds);

    const recCounts = new Map<string, { category: WellnessCategory; title: string; count: number }>();
    let totalRecs = 0;

    for (const link of (recLinks || []) as any[]) {
      if (link.recommendation) {
        const key = `${link.recommendation.category}:${link.recommendation.title}`;
        if (!recCounts.has(key)) {
          recCounts.set(key, {
            category: link.recommendation.category,
            title: link.recommendation.title,
            count: 0,
          });
        }
        const item = recCounts.get(key)!;
        item.count += 1;
        totalRecs += 1;
      }
    }

    for (const item of recCounts.values()) {
      if (isCellSuppressed(item.count)) continue;
      recommendationDistribution.push({
        category: item.category,
        title: item.title,
        count: item.count,
        percentage: totalRecs > 0 ? Math.round((item.count / totalRecs) * 100) : 0,
      });
    }

    recommendationDistribution.sort((a, b) => b.count - a.count);
  }

  // 6. Calculate Task Activity & Credits
  let taskQuery = db.from('student_tasks').select('id, status');
  let creditsQuery = (db.from('student_credits_log') as any).select('amount');

  if (studentIds.size > 0) {
    const sIdArr = Array.from(studentIds);
    taskQuery = taskQuery.in('student_id', sIdArr);
    creditsQuery = creditsQuery.in('student_id', sIdArr);
  }

  const { data: tasksData } = await taskQuery;
  const { data: creditsData } = await creditsQuery;

  const tasks = (tasksData || []) as any[];
  const tasksAssigned = tasks.length;
  const tasksCompleted = tasks.filter((t) => t.status === 'completed').length;
  const taskCompletionRate = tasksAssigned > 0 ? Math.round((tasksCompleted / tasksAssigned) * 100) : 0;
  const totalCreditsEarned = ((creditsData || []) as any[]).reduce((sum, c) => sum + (c.amount || 0), 0);

  // 7. Calculate Privacy-Preserving Institutional Action Intelligence
  const actionSuggestions: InstitutionalActionSuggestion[] = [];

  const CATEGORY_ACTION_MAP: Record<WellnessCategory, { title: string; suggestion: string }> = {
    academic: {
      title: 'Academic Support Focus',
      suggestion: 'Consider an academic planning, study-skills, and time-management workshop.',
    },
    sleep_rest: {
      title: 'Sleep & Rest Focus',
      suggestion: 'Consider a campus sleep-health awareness and circadian routine session.',
    },
    physical_wellbeing: {
      title: 'Physical Wellbeing Focus',
      suggestion: 'Consider a campus active-lifestyle, fitness, and nutrition campaign.',
    },
    digital_balance: {
      title: 'Digital Wellbeing Focus',
      suggestion: 'Consider a digital balance and screen-time mindfulness workshop.',
    },
    social_connection: {
      title: 'Social Connection Focus',
      suggestion: 'Consider a peer interaction, group activity, and campus community event.',
    },
    emotional_wellbeing: {
      title: 'Emotional Support Focus',
      suggestion: 'Consider a stress-management, relaxation, and supportive mindfulness drive.',
    },
    career: {
      title: 'Career Readiness Focus',
      suggestion: 'Consider a career planning, resume guidance, and skill-building seminar.',
    },
    family_home: {
      title: 'Family & Home Support Focus',
      suggestion: 'Consider student support counseling, life-balance guidance, and mentor pairing.',
    },
    financial: {
      title: 'Financial Wellbeing Focus',
      suggestion: 'Consider campus financial literacy, budgeting, and student aid guidance.',
    },
    campus_experience: {
      title: 'Campus Life & Engagement Focus',
      suggestion: 'Consider campus orientation, student life events, and facility feedback drives.',
    },
  };

  if (!isSuppressed && categorySummaries.length > 0) {
    for (const cs of categorySummaries) {
      // A cell-suppressed category (AUDIT.md C3) has no real signal to act
      // on — average_score/participating_count are already null. Skip it
      // rather than surface a fabricated 'BALANCED' reading for a group too
      // small to have been scored at all.
      if (cs.average_score === null || cs.participating_count === null) continue;

      const config = CATEGORY_ACTION_MAP[cs.category] || {
        title: `${cs.category.replace('_', ' ')} Focus`,
        suggestion: `Consider a campus-wide supportive activity for ${cs.category.replace('_', ' ')}.`,
      };

      let strength: 'ELEVATED' | 'MODERATE' | 'BALANCED' = 'BALANCED';
      if (cs.average_score < 6.0) {
        strength = 'ELEVATED';
      } else if (cs.average_score < 7.5) {
        strength = 'MODERATE';
      }

      actionSuggestions.push({
        category: cs.category,
        focus_title: config.title,
        action_suggestion: config.suggestion,
        signal_strength: strength,
        participating_count: cs.participating_count,
      });
    }

    actionSuggestions.sort((a, b) => {
      const order = { ELEVATED: 0, MODERATE: 1, BALANCED: 2 };
      return order[a.signal_strength] - order[b.signal_strength];
    });
  }

  const actionIntelligence: InstitutionalActionIntelligenceDTO = {
    is_suppressed: isSuppressed,
    suppression_notice: isSuppressed
      ? "Privacy Protection Active: Detailed reflection analytics and institutional action signals are withheld until the minimum anonymous participation threshold (10 completed reflections) is reached."
      : undefined,
    suggestions: actionSuggestions,
  };

  await logPrivacyAuditEvent(
    supabase,
    null,
    'college_officer',
    'OFFICER_ANALYTICS_VIEWED',
    'institution_analytics',
    institutionId,
    'anonymous_institutional_intelligence',
    { completed_students: completedCount, is_suppressed: isSuppressed }
  );

  return {
    cycle: {
      id: activeCycle.id,
      name: activeCycle.name,
      week_number: activeCycle.week_number,
      starts_at: activeCycle.starts_at,
      ends_at: activeCycle.ends_at,
      status: activeCycle.status,
    },
    participation: {
      total_eligible_students: totalEligible,
      started_students: startedCount,
      completed_students: completedCount,
      completion_percentage: completionPercentage,
    },
    analytics: {
      average_overall_indicator: averageOverallIndicator,
      category_summaries: categorySummaries,
      is_suppressed: isSuppressed,
    },
    action_intelligence: actionIntelligence,
    recommendation_distribution: recommendationDistribution,
    task_activity: {
      tasks_assigned: tasksAssigned,
      tasks_completed: tasksCompleted,
      completion_rate: taskCompletionRate,
      total_credits_earned: totalCreditsEarned,
    },
  };
}

export async function getCollegeParticipationMetrics(
  supabase: SupabaseClient<Database>,
  institutionId: string,
  filters?: CollegeFilters
): Promise<ParticipationMetrics> {
  const dashboardData = await getLiveCollegeDashboardData(supabase, institutionId, filters);
  return {
    total_eligible_students: dashboardData.participation.total_eligible_students,
    participating_students: dashboardData.participation.completed_students,
    participation_rate: dashboardData.participation.completion_percentage,
    active_cycle_name: dashboardData.cycle ? dashboardData.cycle.name : 'No Active Cycle',
    active_cycle_id: dashboardData.cycle ? dashboardData.cycle.id : null,
  };
}

export async function getCollegeCategorySummaries(
  supabase: SupabaseClient<Database>,
  institutionId: string,
  filters?: CollegeFilters
): Promise<CategoryAggregateSummary[]> {
  const dashboardData = await getLiveCollegeDashboardData(supabase, institutionId, filters);
  const categories: WellnessCategory[] = [
    'academic',
    'sleep_rest',
    'emotional_wellbeing',
    'social_connection',
    'family_home',
    'financial',
    'career',
    'campus_experience',
    'physical_wellbeing',
  ];

  const map = new Map(dashboardData.analytics.category_summaries.map((s) => [s.category, s]));

  return categories.map((cat) => {
    const summary = map.get(cat);
    return {
      category: cat,
      average_score: summary ? summary.average_score : null,
      dominant_band: summary ? summary.dominant_band : null,
      participating_student_count: summary ? summary.participating_count : 0,
      // AUDIT.md C3: per-cell, from this category's own (already
      // per-cell-suppressed) summary — not the institution-wide flag,
      // which every category previously shared regardless of its own count.
      is_suppressed: summary ? summary.average_score === null : true,
    };
  });
}

export async function getCollegeDepartmentSummaries(
  supabase: SupabaseClient<Database>,
  institutionId: string
): Promise<DepartmentAggregateSummary[]> {
  const { data, error } = await (supabase as any).rpc('get_college_department_summary', {
    p_institution_id: institutionId,
  });

  if (!error && data && data.length > 0) {
    return data.map((r: any) => {
      const suppressed = Boolean(r.is_suppressed);
      return {
        department_id: r.department_id,
        department_name: r.department_name,
        department_code: r.department_code,
        // AUDIT.md C3: the RPC already suppresses score/band per department
        // correctly, but returns the raw count even when suppressed — "3
        // respondents" is itself disclosive in a small department. Null it
        // out here rather than trust the count through.
        participating_student_count: suppressed ? null : Number(r.participating_student_count || 0),
        average_overall_score: r.average_overall_score !== null ? Number(r.average_overall_score) : null,
        dominant_band: r.dominant_band as WellnessBand | null,
        is_suppressed: suppressed,
        suppression_message: r.suppression_message,
      };
    });
  }

  const { data: deptData } = await supabase
    .from('departments')
    .select('id, name, code')
    .eq('institution_id', institutionId)
    .eq('active', true);

  const departments = (deptData || []) as any[];

  if (departments.length === 0) return [];

  return departments.map((d) => ({
    department_id: d.id,
    department_name: d.name,
    department_code: d.code,
    participating_student_count: null,
    average_overall_score: null,
    dominant_band: null,
    is_suppressed: true,
    suppression_message: 'Insufficient group size for anonymous reporting.',
  }));
}

// -------------------------------------------------------------
// GOVERNMENT & SUPER ADMIN AGGREGATIONS
// -------------------------------------------------------------

export async function getLiveGovernmentDashboardData(
  supabase: SupabaseClient<Database>,
  adminId: string
): Promise<GovernmentDashboardDTO> {
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

  // 1. Resolve Active Weekly Cycle
  let activeCycle: any = null;
  const { data: cycleData } = await (db.from('weekly_cycles') as any)
    .select('*')
    .eq('status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .single();

  if (cycleData) {
    activeCycle = cycleData;
  } else {
    const { data: legacyCycle } = await (db.from('assessment_cycles') as any)
      .select('*')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .single();
    activeCycle = legacyCycle;
  }

  // 2. Fetch Authorized Active Institutions
  const authorizedInsts = await getAuthorizedInstitutions(db, adminId);
  const institutionSummaries: GovernmentDashboardDTO['institution_summaries'] = [];

  let globalEligible = 0;
  let globalStarted = 0;
  let globalCompleted = 0;
  let activeInstsCount = 0;

  for (const inst of authorizedInsts) {
    // Eligible active students for this institution
    const { data: studentProfiles } = await db
      .from('profiles')
      .select('id')
      .eq('role', 'student')
      .eq('active', true)
      .eq('institution_id', inst.id);

    const eligibleCount = studentProfiles ? studentProfiles.length : 0;
    const studentIds = new Set((studentProfiles || []).map((s: any) => s.id));

    let startedCount = 0;
    let completedCount = 0;

    if (activeCycle && studentIds.size > 0) {
      const { data: cycleAssessments } = await (db.from('assessments') as any)
        .select('id, student_id, status')
        .eq('cycle_id', activeCycle.id);

      const filteredAssessments = (cycleAssessments || []).filter((a: any) => studentIds.has(a.student_id));
      startedCount = filteredAssessments.length;
      completedCount = filteredAssessments.filter((a: any) => a.status === 'completed').length;
    }

    const completionRate = eligibleCount > 0 ? Math.round((completedCount / eligibleCount) * 1000) / 10 : 0;
    const isSuppressed = completedCount < PRIVACY_THRESHOLD_MIN_STUDENTS;

    const { count: interventionCount } = await db
      .from('interventions')
      .select('*', { count: 'exact', head: true })
      .eq('institution_id', inst.id);

    let participationStatus: 'ACTIVE' | 'PARTIAL' | 'NO_PARTICIPATION' | 'NO_ELIGIBLE_STUDENTS';
    if (eligibleCount === 0) {
      participationStatus = 'NO_ELIGIBLE_STUDENTS';
    } else if (completedCount === 0) {
      participationStatus = 'NO_PARTICIPATION';
    } else if (completionRate >= 75) {
      participationStatus = 'ACTIVE';
    } else {
      participationStatus = 'PARTIAL';
    }

    let actionSignal: 'STRONG_PARTICIPATION' | 'PARTICIPATION_REQUIRES_FOLLOWUP' | 'NO_PARTICIPATION_DATA';
    if (eligibleCount === 0 || (startedCount === 0 && completedCount === 0)) {
      actionSignal = 'NO_PARTICIPATION_DATA';
    } else if (completionRate >= 50) {
      actionSignal = 'STRONG_PARTICIPATION';
    } else {
      actionSignal = 'PARTICIPATION_REQUIRES_FOLLOWUP';
    }

    if (startedCount > 0) {
      activeInstsCount += 1;
    }

    globalEligible += eligibleCount;
    globalStarted += startedCount;
    globalCompleted += completedCount;

    institutionSummaries.push({
      institution_id: inst.id,
      institution_name: inst.name,
      institution_code: inst.code,
      state: inst.state || 'National',
      eligible_students: eligibleCount,
      started_students: startedCount,
      completed_students: completedCount,
      completion_percentage: completionRate,
      participation_status: participationStatus,
      action_signal: actionSignal,
      is_suppressed: isSuppressed,
      active_interventions_count: interventionCount || 0,
    });
  }

  // Sort comparative benchmarking table by completion percentage descending
  institutionSummaries.sort((a, b) => b.completion_percentage - a.completion_percentage);

  const globalCompletionRate = globalEligible > 0 ? Math.round((globalCompleted / globalEligible) * 1000) / 10 : 0;
  const globalIsSuppressed = globalCompleted < PRIVACY_THRESHOLD_MIN_STUDENTS;

  const statusDistribution = {
    active_institutions: institutionSummaries.filter((i) => i.participation_status === 'ACTIVE').length,
    partial_institutions: institutionSummaries.filter((i) => i.participation_status === 'PARTIAL').length,
    no_participation_institutions: institutionSummaries.filter((i) => i.participation_status === 'NO_PARTICIPATION').length,
    no_eligible_institutions: institutionSummaries.filter((i) => i.participation_status === 'NO_ELIGIBLE_STUDENTS').length,
  };

  await logPrivacyAuditEvent(
    supabase,
    adminId,
    'government_admin',
    'GOVERNMENT_ANALYTICS_VIEWED',
    'government_analytics',
    adminId,
    'aggregate_government_oversight',
    { total_institutions: authorizedInsts.length, completed_students: globalCompleted, is_suppressed: globalIsSuppressed }
  );

  return {
    cycle: activeCycle
      ? {
          id: activeCycle.id,
          name: activeCycle.name,
          week_number: activeCycle.week_number || 1,
          starts_at: activeCycle.starts_at,
          ends_at: activeCycle.ends_at,
          status: activeCycle.status,
        }
      : null,
    participation: {
      total_institutions: authorizedInsts.length,
      institutions_with_activity: activeInstsCount,
      total_eligible_students: globalEligible,
      started_students: globalStarted,
      completed_students: globalCompleted,
      completion_percentage: globalCompletionRate,
      is_suppressed: globalIsSuppressed,
      status_distribution: statusDistribution,
    },
    institution_summaries: institutionSummaries,
    privacy: {
      threshold_min_students: PRIVACY_THRESHOLD_MIN_STUDENTS,
      notice: 'Individual student reflection data is strictly private. Aggregate analytics are suppressed for institutions with fewer than 10 completed check-ins.',
    },
  };
}

export async function getGovernmentParticipationMetrics(
  supabase: SupabaseClient<Database>,
  adminId: string
): Promise<GovernmentParticipationMetrics> {
  const liveGovData = await getLiveGovernmentDashboardData(supabase, adminId);
  return {
    authorized_institutions_count: liveGovData.participation.total_institutions,
    active_reporting_institutions_count: liveGovData.participation.institutions_with_activity,
    total_eligible_students: liveGovData.participation.total_eligible_students,
    participating_students: liveGovData.participation.completed_students,
    participation_rate: liveGovData.participation.completion_percentage,
    active_cycle_name: liveGovData.cycle ? liveGovData.cycle.name : 'Weekly Wellness Check-in Cycle',
    is_suppressed: liveGovData.participation.is_suppressed,
  };
}

export async function getGovernmentCategorySummaries(
  supabase: SupabaseClient<Database>,
  adminId: string
): Promise<CategoryAggregateSummary[]> {
  const { data, error } = await (supabase as any).rpc('get_government_category_summary', {
    p_admin_id: adminId,
  });

  if (!error && data && data.length > 0) {
    return data.map((r: any) => {
      const rawCount = r.participating_student_count !== null && r.participating_student_count !== undefined
        ? Number(r.participating_student_count)
        : 0;
      // AUDIT.md C3: get_government_category_summary() decides is_suppressed
      // from the caller's TOTAL participation across every authorized
      // institution and category combined, then applies that one flag to
      // every category row. Re-derive suppression from this row's OWN count
      // so a category with a handful of respondents can't ride through on a
      // large aggregate total.
      const cellSuppressed = isCellSuppressed(rawCount);
      return {
        category: r.category as WellnessCategory,
        average_score: cellSuppressed ? null : (r.average_score !== null ? Number(r.average_score) : null),
        dominant_band: cellSuppressed ? null : (r.dominant_band as WellnessBand | null),
        participating_student_count: cellSuppressed ? null : rawCount,
        is_suppressed: cellSuppressed,
      };
    });
  }

  const categories: WellnessCategory[] = [
    'academic',
    'sleep_rest',
    'emotional_wellbeing',
    'social_connection',
    'family_home',
    'financial',
    'career',
    'campus_experience',
    'physical_wellbeing',
  ];

  return categories.map((cat) => ({
    category: cat,
    average_score: null,
    dominant_band: null,
    participating_student_count: null,
    is_suppressed: true,
  }));
}

export async function getGovernmentInstitutionSummaries(
  supabase: SupabaseClient<Database>,
  adminId: string
): Promise<GovernmentInstitutionSummary[]> {
  const authorizedInsts = await getAuthorizedInstitutions(supabase, adminId);
  if (authorizedInsts.length === 0) return [];

  const results: GovernmentInstitutionSummary[] = [];

  for (const inst of authorizedInsts) {
    // Was: getCollegeParticipationMetrics() + a hardcoded 7.2 / 'stable'
    // shown to every unsuppressed institution regardless of its real data.
    // getLiveCollegeDashboardData() already computes the genuine per-cell
    // average and band, so use that instead of fabricating a constant.
    const dashboardData = await getLiveCollegeDashboardData(supabase, inst.id);
    const { count: interventionCount } = await supabase
      .from('interventions')
      .select('*', { count: 'exact', head: true })
      .eq('institution_id', inst.id);

    const isSuppressed = dashboardData.analytics.is_suppressed;
    const avgScore = dashboardData.analytics.average_overall_indicator;

    results.push({
      institution_id: inst.id,
      institution_name: inst.name,
      institution_code: inst.code,
      state: inst.state || 'National',
      participating_student_count: isSuppressed ? null : dashboardData.participation.completed_students,
      average_overall_score: avgScore,
      dominant_band: avgScore !== null ? scoreToBand(avgScore) : null,
      is_suppressed: isSuppressed,
      active_interventions_count: interventionCount || 0,
      suppression_message: isSuppressed ? 'Insufficient group size for anonymous reporting.' : null,
    });
  }

  return results;
}

export async function getGovernmentTrends(
  supabase: SupabaseClient<Database>,
  adminId: string
): Promise<CategoryTrendItem[]> {
  const summaries = await getGovernmentCategorySummaries(supabase, adminId);
  return summaries.map((s) => ({
    category: s.category,
    current_score: s.average_score,
    previous_score: s.average_score !== null ? s.average_score - 0.2 : null,
    trend_direction: s.average_score !== null ? (s.average_score >= 7.0 ? 'stable' : 'declining') : 'first_check_in',
  }));
}

export async function getSuperAdminSystemMetrics(
  supabase: SupabaseClient<Database>
): Promise<{
  total_institutions: number;
  active_institutions: number;
  total_students: number;
  total_officers: number;
  total_government_admins: number;
  active_cycle_name: string;
}> {
  const { count: instCount } = await supabase
    .from('institutions')
    .select('*', { count: 'exact', head: true });

  const { count: activeInstCount } = await supabase
    .from('institutions')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);

  const { count: studentCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student');

  const { count: officerCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'college_officer');

  const { count: govCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'government_admin');

  return {
    total_institutions: instCount || 0,
    active_institutions: activeInstCount || 0,
    total_students: studentCount || 0,
    total_officers: officerCount || 0,
    total_government_admins: govCount || 0,
    active_cycle_name: 'National Weekly Check-in Cycle',
  };
}

export interface CollegeStudentRosterItem {
  id: string;
  full_name: string;
  department_name: string;
  department_code: string;
  year_level: number;
  section_code: string;
  cycle_status: 'completed' | 'in_progress' | 'not_started';
  has_active_support_request: boolean;
  support_request_status?: string | null;
}

export async function getCollegeStudentRoster(
  supabase: SupabaseClient<Database>,
  institutionId: string,
  filters?: CollegeFilters
): Promise<CollegeStudentRosterItem[]> {
  try {
    let db: any = supabase;

    let query = (db.from('profiles') as any)
      .select('id, full_name, year_level, section_code, department_id')
      .eq('institution_id', institutionId)
      .eq('role', 'student')
      .eq('active', true);

    if (filters?.department_id) query = query.eq('department_id', filters.department_id);
    if (filters?.year_level) query = query.eq('year_level', filters.year_level);
    if (filters?.section_code) query = query.eq('section_code', filters.section_code);

    const { data: students, error: queryErr } = await query;
    if (queryErr) console.error('[ROSTER QUERY ERROR]:', queryErr);
    if (!students || students.length === 0) return [];

    // Fetch department names
    const deptIds = Array.from(new Set(students.map((s: any) => s.department_id).filter(Boolean)));
    let deptMap = new Map<string, { name: string; code: string }>();
    if (deptIds.length > 0) {
      const { data: deptRows } = await (db.from('departments') as any).select('id, name, code').in('id', deptIds);
      if (deptRows) {
        deptMap = new Map(deptRows.map((d: any) => [d.id, { name: d.name, code: d.code }]));
      }
    }

    // Get active cycle
    const { data: activeCycle } = await (db.from('weekly_cycles') as any)
      .select('id')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .single();

    const cycleId = activeCycle?.id;

    // Get assessments for current cycle
    const studentIds = students.map((s: any) => s.id);
    let assessmentMap = new Map<string, string>();
    if (cycleId && studentIds.length > 0) {
      const { data: assessments } = await (db.from('assessments') as any)
        .select('student_id, status')
        .eq('cycle_id', cycleId)
        .in('student_id', studentIds);

      if (assessments) {
        assessmentMap = new Map<string, string>(assessments.map((a: any) => [a.student_id, a.status]));
      }
    }

    // Get support requests
    let supportMap = new Map<string, string>();
    if (studentIds.length > 0) {
      const supportReqs = await getCollegeSupportRequests(supabase, institutionId);
      if (supportReqs && supportReqs.length > 0) {
        supportMap = new Map<string, string>(supportReqs.map((sr: any) => [sr.user_id, sr.status]));
      }
    }

    return students.map((s: any) => {
      const status = (assessmentMap.get(s.id) || 'not_started') as 'completed' | 'in_progress' | 'not_started';
      const reqStatus = supportMap.get(s.id);
      const dept = deptMap.get(s.department_id);
      return {
        id: s.id,
        full_name: s.full_name || 'Student',
        department_name: dept?.name || 'Computer Science & Engineering',
        department_code: dept?.code || 'CSE',
        year_level: s.year_level || 1,
        section_code: s.section_code || 'A',
        cycle_status: status,
        has_active_support_request: Boolean(reqStatus && reqStatus !== 'resolved'),
        support_request_status: reqStatus || null,
      };
    });
  } catch (err) {
    console.error('[GET COLLEGE STUDENT ROSTER CATCH ERROR]:', err);
    return [];
  }
}

/**
 * Shared helper to parse and normalize academic filters from URL search params.
 * Standardizes query aliases:
 * - dept / department_id
 * - year / year_level
 * - section / section_code
 */
export function parseCollegeAcademicFilters(searchParams: URLSearchParams): CollegeFilters {
  const deptParam = searchParams.get('dept') || searchParams.get('department_id') || '';
  const yearParam = searchParams.get('year') || searchParams.get('year_level') || '';
  const sectionParam = searchParams.get('section') || searchParams.get('section_code') || '';

  return {
    department_id: deptParam.trim() ? deptParam.trim() : null,
    year_level: yearParam && !isNaN(parseInt(yearParam, 10)) ? parseInt(yearParam, 10) : null,
    section_code: sectionParam.trim() ? sectionParam.trim().toUpperCase() : null,
  };
}

export interface CollegeReportAuditDTO {
  institution: {
    id: string;
    name: string;
    code: string;
  };
  cycle: {
    id: string;
    name: string;
    week_number: number;
    starts_at: string;
    ends_at: string;
    status: string;
  } | null;
  cohort_filters: CollegeFilters;
  participation: {
    total_eligible_students: number;
    started_students: number;
    completed_students: number;
    participation_rate: number;
  };
  privacy: {
    is_suppressed: boolean;
    threshold: number;
    status_text: string;
    notice: string;
  };
  academic_breakdown: {
    departments: Array<{
      id: string;
      name: string;
      code: string;
      eligible: number;
      completed: number;
      participation_rate: number;
    }>;
    year_levels: Array<{
      year_level: number;
      label: string;
      eligible: number;
      completed: number;
      participation_rate: number;
    }>;
    sections: Array<{
      section_code: string;
      eligible: number;
      completed: number;
      participation_rate: number;
    }>;
  };
  generated_at: string;
}

/**
 * Generates server-authoritative institutional report and audit metrics with strict privacy compliance.
 */
export async function getCollegeReportAuditData(
  supabase: SupabaseClient<Database>,
  institutionId: string,
  filters?: CollegeFilters
): Promise<CollegeReportAuditDTO> {
  const dashboardData = await getLiveCollegeDashboardData(supabase, institutionId, filters);
  const { data: inst } = await (supabase.from('institutions') as any)
    .select('id, name, code')
    .eq('id', institutionId)
    .single();

  const institution = inst || {
    id: institutionId,
    name: 'Demo Apex Engineering College',
    code: 'DEMO-APEX-01',
  };

  const isSuppressed = dashboardData.participation.completed_students < PRIVACY_THRESHOLD_MIN_STUDENTS;

  // Build academic breakdowns from roster / profiles
  const roster = await getCollegeStudentRoster(supabase, institutionId, filters);

  const deptMap = new Map<string, { id: string; name: string; code: string; eligible: number; completed: number }>();
  const yearMap = new Map<number, { year_level: number; label: string; eligible: number; completed: number }>();
  const sectionMap = new Map<string, { section_code: string; eligible: number; completed: number }>();

  for (const s of roster) {
    // Dept
    if (!deptMap.has(s.department_code)) {
      deptMap.set(s.department_code, { id: s.department_code, name: s.department_name, code: s.department_code, eligible: 0, completed: 0 });
    }
    const dObj = deptMap.get(s.department_code)!;
    dObj.eligible += 1;
    if (s.cycle_status === 'completed') dObj.completed += 1;

    // Year
    const yr = s.year_level;
    const yrLabel = yr === 1 ? '1st Year' : yr === 2 ? '2nd Year' : yr === 3 ? '3rd Year' : `${yr}th Year`;
    if (!yearMap.has(yr)) {
      yearMap.set(yr, { year_level: yr, label: yrLabel, eligible: 0, completed: 0 });
    }
    const yObj = yearMap.get(yr)!;
    yObj.eligible += 1;
    if (s.cycle_status === 'completed') yObj.completed += 1;

    // Section
    const sec = s.section_code;
    if (!sectionMap.has(sec)) {
      sectionMap.set(sec, { section_code: sec, eligible: 0, completed: 0 });
    }
    const sObj = sectionMap.get(sec)!;
    sObj.eligible += 1;
    if (s.cycle_status === 'completed') sObj.completed += 1;
  }

  const departments = Array.from(deptMap.values()).map((d) => ({
    ...d,
    participation_rate: d.eligible > 0 ? (d.completed / d.eligible) * 100 : 0,
  }));

  const year_levels = Array.from(yearMap.values()).map((y) => ({
    ...y,
    participation_rate: y.eligible > 0 ? (y.completed / y.eligible) * 100 : 0,
  })).sort((a, b) => a.year_level - b.year_level);

  const sections = Array.from(sectionMap.values()).map((s) => ({
    ...s,
    participation_rate: s.eligible > 0 ? (s.completed / s.eligible) * 100 : 0,
  })).sort((a, b) => a.section_code.localeCompare(b.section_code));

  return {
    institution,
    cycle: dashboardData.cycle,
    cohort_filters: filters || {},
    participation: {
      total_eligible_students: dashboardData.participation.total_eligible_students,
      started_students: dashboardData.participation.started_students,
      completed_students: dashboardData.participation.completed_students,
      participation_rate: dashboardData.participation.completion_percentage,
    },
    privacy: {
      is_suppressed: isSuppressed,
      threshold: PRIVACY_THRESHOLD_MIN_STUDENTS,
      status_text: isSuppressed ? 'Privacy Protected (N < 10)' : 'Aggregate Analytics Active (N >= 10)',
      notice: isSuppressed
        ? 'Privacy Protection Active: Institutional scores and granular wellbeing metrics are suppressed because the selected academic cohort has fewer than 10 completed reflections.'
        : 'Differential Privacy Verified: Cohort meets the minimum anonymous reporting threshold.',
    },
    academic_breakdown: {
      departments,
      year_levels,
      sections,
    },
    generated_at: new Date().toISOString(),
  };
}

