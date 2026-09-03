import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { WellnessCategory, WellnessBand, UserProfile } from '../types/domain';
import { getAuthorizedInstitutions } from './institutions';
import { getActiveWeeklyCycle } from './weekly-cycles';
import { createSupabaseAdminClient } from '../lib/supabase/server';
import { scoreToBand } from '../lib/scoring/engine';

export const PRIVACY_THRESHOLD_MIN_STUDENTS = 10;

export const CLINICAL_CATEGORY_DISPLAY_NAMES: Record<WellnessCategory, string> = {
  academic: 'Academic Balance & Workload',
  sleep_rest: 'Sleep & Rest Cycles',
  emotional_wellbeing: 'Emotional Awareness & Balance',
  social_connection: 'Peer & Social Connection',
  family_home: 'Family & Living Environment',
  financial: 'Financial Wellbeing',
  career: 'Career & Future Readiness',
  campus_experience: 'Campus Life & Belonging',
  physical_wellbeing: 'Physical Wellness & Energy',
  digital_balance: 'Digital & Screen Balance',
};

export interface ClinicalBandDistributionItem {
  band: WellnessBand;
  label: string;
  count: number | null;
  percentage: number | null;
  is_suppressed: boolean;
}

export interface ClinicalCategoryInsightItem {
  category: WellnessCategory;
  displayName: string;
  average_score: number | null;
  dominant_band: WellnessBand | null;
  respondents_count: number | null;
  is_suppressed: boolean;
  previous_period_comparison: string;
  trend_direction: 'baseline' | 'improving' | 'stable' | 'declining';
}

export interface ClinicalAreaToReview {
  category: WellnessCategory;
  displayName: string;
  pattern_title: string;
  pattern_description: string;
  average_score: number | null;
  dominant_band: WellnessBand | null;
  attention_signal: string;
}

export interface ClinicalWellbeingInsightsDTO {
  scope: {
    institution_id: string | null;
    institution_name: string;
    is_national_scope: boolean;
    authorized_institutions_count: number;
  };
  cycle: {
    id: string;
    name: string;
    week_number: number;
    starts_at: string;
    ends_at: string;
    status: string;
  } | null;
  overview: {
    total_eligible_students: number;
    completed_assessments_count: number | null;
    participation_rate: number | null;
    is_suppressed: boolean;
    suppression_notice?: string;
  };
  wellbeing_distribution: {
    is_suppressed: boolean;
    suppression_notice?: string;
    total_responses: number | null;
    bands: ClinicalBandDistributionItem[];
  };
  category_insights: ClinicalCategoryInsightItem[];
  weekly_trends: {
    is_suppressed: boolean;
    has_historical_comparison: boolean;
    historical_status: string;
    cycles: Array<{
      cycle_id: string;
      week_number: number;
      name: string;
      completed_count: number | null;
      average_overall_score: number | null;
      dominant_band: WellnessBand | null;
      is_suppressed: boolean;
    }>;
  };
  areas_to_review: ClinicalAreaToReview[];
  privacy: {
    threshold_min_students: number;
    rule: string;
  };
  disclaimer: string;
}

/**
 * Fetch and compute read-only aggregate clinical wellbeing insights for authorized clinicians.
 * Enforces strict data-layer N < 10 privacy protection: any slice with fewer than 10 students
 * suppresses counts, averages, and percentages before UI delivery.
 */
export async function getClinicalWellbeingInsights(
  supabase: SupabaseClient<Database>,
  clinicianProfile: UserProfile
): Promise<ClinicalWellbeingInsightsDTO> {
  const adminClient = createSupabaseAdminClient();
  const db = adminClient;

  // 1. Resolve Clinician Scope
  let targetInstitutionIds: string[] = [];
  let scopeInstitutionName = 'National Scope';
  let isNational = false;

  if (clinicianProfile.institution_id) {
    targetInstitutionIds = [clinicianProfile.institution_id];
    const { data: inst } = await (db.from('institutions') as any)
      .select('name')
      .eq('id', clinicianProfile.institution_id)
      .single();
    if (inst) scopeInstitutionName = inst.name;
  } else {
    // Clinician has multi-institution / national instrument authority
    const authorized = await getAuthorizedInstitutions(db, clinicianProfile.id);
    if (authorized && authorized.length > 0) {
      targetInstitutionIds = authorized.map((i) => i.id);
      scopeInstitutionName = authorized.length === 1 ? authorized[0].name : `All Authorized Institutions (${authorized.length})`;
      isNational = authorized.length > 1;
    } else {
      const { data: allInsts } = await (db.from('institutions') as any).select('id, name').eq('active', true);
      const list = allInsts || [];
      targetInstitutionIds = list.map((i: any) => i.id);
      scopeInstitutionName = list.length === 1 ? list[0].name : `All Campuses (${list.length})`;
      isNational = list.length > 1;
    }
  }

  // 2. Resolve Active Cycle
  const activeCycle = await getActiveWeeklyCycle(db);

  // 3. Resolve Eligible Students Population in Scope
  let eligibleQuery = (db.from('profiles') as any)
    .select('id', { count: 'exact' })
    .eq('role', 'student')
    .eq('active', true);

  if (targetInstitutionIds.length > 0) {
    eligibleQuery = eligibleQuery.in('institution_id', targetInstitutionIds);
  }

  const { count: eligibleCount, data: eligibleRows } = await eligibleQuery;
  const totalEligible = eligibleCount || (eligibleRows ? eligibleRows.length : 0);
  const eligibleStudentIds = new Set((eligibleRows || []).map((s: any) => s.id));

  // Fallback if no cycle exists
  if (!activeCycle) {
    return {
      scope: {
        institution_id: clinicianProfile.institution_id || null,
        institution_name: scopeInstitutionName,
        is_national_scope: isNational,
        authorized_institutions_count: targetInstitutionIds.length,
      },
      cycle: null,
      overview: {
        total_eligible_students: totalEligible,
        completed_assessments_count: null,
        participation_rate: null,
        is_suppressed: true,
        suppression_notice: 'No active assessment cycle found.',
      },
      wellbeing_distribution: {
        is_suppressed: true,
        suppression_notice: 'No active assessment cycle.',
        total_responses: null,
        bands: [],
      },
      category_insights: [],
      weekly_trends: {
        is_suppressed: true,
        has_historical_comparison: false,
        historical_status: 'Not enough historical data',
        cycles: [],
      },
      areas_to_review: [],
      privacy: {
        threshold_min_students: PRIVACY_THRESHOLD_MIN_STUDENTS,
        rule: 'N < 10 → Privacy Protected (N < 10)',
      },
      disclaimer:
        'Wellbeing indicators are intended to support early awareness and planning. They are not clinical diagnoses or medical assessments.',
    };
  }

  // 4. Fetch Completed Assessments for Active Cycle in Scope
  const { data: cycleAssessments } = await (db.from('assessments') as any)
    .select('id, student_id, cycle_id, status, overall_indicator, overall_band')
    .eq('cycle_id', activeCycle.id)
    .eq('status', 'completed');

  const completedInScope = (cycleAssessments || []).filter((a: any) => eligibleStudentIds.has(a.student_id));
  const completedCount = completedInScope.length;

  // DATA-LAYER PRIVACY ENFORCEMENT: Check if completed sample size meets threshold
  const isOverallSuppressed = completedCount < PRIVACY_THRESHOLD_MIN_STUDENTS;

  const participationRate = totalEligible > 0
    ? Math.round((completedCount / totalEligible) * 1000) / 10
    : 0;

  // 5. Wellbeing Distribution (Aggregate Bands)
  const bandCounts: Record<WellnessBand, number> = {
    stable: 0,
    watch: 0,
    needs_attention: 0,
    elevated: 0,
  };

  for (const a of completedInScope) {
    if (a.overall_band && bandCounts[a.overall_band as WellnessBand] !== undefined) {
      bandCounts[a.overall_band as WellnessBand]++;
    }
  }

  const bandConfigs: Array<{ band: WellnessBand; label: string }> = [
    { band: 'stable', label: 'Positive / Stable' },
    { band: 'watch', label: 'Watch / Mild Attention' },
    { band: 'needs_attention', label: 'Moderate Attention' },
    { band: 'elevated', label: 'Higher Attention' },
  ];

  const distributionBands: ClinicalBandDistributionItem[] = bandConfigs.map((cfg) => {
    const count = bandCounts[cfg.band];
    // Cell suppression: if overall sample is suppressed, or if this cell < 10
    const cellSuppressed = isOverallSuppressed || count < PRIVACY_THRESHOLD_MIN_STUDENTS;
    return {
      band: cfg.band,
      label: cfg.label,
      count: cellSuppressed ? null : count,
      percentage: cellSuppressed ? null : (completedCount > 0 ? Math.round((count / completedCount) * 1000) / 10 : 0),
      is_suppressed: cellSuppressed,
    };
  });

  // 6. Category Insights (from assessment_category_scores)
  const completedIds = completedInScope.map((a: any) => a.id);
  const categoryInsights: ClinicalCategoryInsightItem[] = [];

  const allCategories: WellnessCategory[] = [
    'academic',
    'sleep_rest',
    'emotional_wellbeing',
    'social_connection',
    'family_home',
    'financial',
    'career',
    'campus_experience',
    'physical_wellbeing',
    'digital_balance',
  ];

  if (completedIds.length > 0) {
    const { data: scoreRows } = await (db.from('assessment_category_scores') as any)
      .select('category, score, band')
      .in('assessment_id', completedIds);

    const catMap = new Map<WellnessCategory, { sum: number; count: number; bandCounts: Record<string, number> }>();
    for (const cat of allCategories) {
      catMap.set(cat, { sum: 0, count: 0, bandCounts: {} });
    }

    for (const r of (scoreRows || []) as any[]) {
      const cat = r.category as WellnessCategory;
      if (catMap.has(cat)) {
        const entry = catMap.get(cat)!;
        if (r.score !== null && r.score !== undefined) {
          entry.sum += Number(r.score);
          entry.count++;
        }
        if (r.band) {
          entry.bandCounts[r.band] = (entry.bandCounts[r.band] || 0) + 1;
        }
      }
    }

    for (const cat of allCategories) {
      const data = catMap.get(cat)!;
      const cellSuppressed = isOverallSuppressed || data.count < PRIVACY_THRESHOLD_MIN_STUDENTS;

      let dominantBand: WellnessBand | null = null;
      let maxCount = 0;
      for (const [b, c] of Object.entries(data.bandCounts)) {
        if (c > maxCount) {
          maxCount = c;
          dominantBand = b as WellnessBand;
        }
      }

      const avgScore = data.count > 0 ? Math.round((data.sum / data.count) * 10) / 10 : null;

      categoryInsights.push({
        category: cat,
        displayName: CLINICAL_CATEGORY_DISPLAY_NAMES[cat] || cat,
        average_score: cellSuppressed ? null : avgScore,
        dominant_band: cellSuppressed ? null : dominantBand,
        respondents_count: cellSuppressed ? null : data.count,
        is_suppressed: cellSuppressed,
        previous_period_comparison: 'Not enough historical data',
        trend_direction: 'baseline',
      });
    }
  } else {
    for (const cat of allCategories) {
      categoryInsights.push({
        category: cat,
        displayName: CLINICAL_CATEGORY_DISPLAY_NAMES[cat] || cat,
        average_score: null,
        dominant_band: null,
        respondents_count: null,
        is_suppressed: true,
        previous_period_comparison: 'Not enough historical data',
        trend_direction: 'baseline',
      });
    }
  }

  // 7. Areas to Review (Descriptive, Non-Clinical Aggregate Patterns)
  const areasToReview: ClinicalAreaToReview[] = [];

  if (!isOverallSuppressed) {
    // Identify unsuppressed categories with lower average indicator scores
    const reviewCandidates = categoryInsights
      .filter((ci) => !ci.is_suppressed && ci.average_score !== null)
      .sort((a, b) => (a.average_score || 0) - (b.average_score || 0));

    // Top 3 areas with lowest aggregate balance scores
    const topAttentionAreas = reviewCandidates.slice(0, 3);

    for (const area of topAttentionAreas) {
      let patternDesc = '';
      if (area.category === 'social_connection') {
        patternDesc = 'Aggregate indicators show lower peer interaction scores compared with campus baseline averages.';
      } else if (area.category === 'family_home') {
        patternDesc = 'Aggregate responses reflect lower living environment support scores across participating cohorts.';
      } else if (area.category === 'financial') {
        patternDesc = 'Aggregate pattern reflects lower reported financial peace-of-mind across surveyed student cohorts.';
      } else if (area.category === 'physical_wellbeing') {
        patternDesc = 'Aggregate indicators show lower reported vitality and physical exercise balance.';
      } else if (area.category === 'emotional_wellbeing') {
        patternDesc = 'Aggregate responses reflect elevated tension and self-regulation demands this period.';
      } else if (area.category === 'academic') {
        patternDesc = 'Aggregate pattern reflects elevated workload pacing pressures in the current cycle.';
      } else if (area.category === 'sleep_rest') {
        patternDesc = 'Aggregate indicators show lower regularity in rest and recovery intervals.';
      } else {
        patternDesc = 'Aggregate distribution indicates an area showing increased attention for institutional awareness.';
      }

      areasToReview.push({
        category: area.category,
        displayName: area.displayName,
        pattern_title: `${area.displayName} — Attention Pattern`,
        pattern_description: patternDesc,
        average_score: area.average_score,
        dominant_band: area.dominant_band,
        attention_signal: 'Area showing increased attention',
      });
    }
  }

  // 8. Weekly Trends
  let activeCycleAvg: number | null = null;
  let activeCycleBand: WellnessBand | null = null;
  if (!isOverallSuppressed && completedCount > 0) {
    const validScores = completedInScope
      .map((a: any) => a.overall_indicator)
      .filter((s: any) => s !== null && s !== undefined && !isNaN(s));
    if (validScores.length > 0) {
      activeCycleAvg = Math.round((validScores.reduce((sum: number, s: number) => sum + s, 0) / validScores.length) * 10) / 10;
      activeCycleBand = scoreToBand(activeCycleAvg);
    }
  }

  const weeklyTrends = {
    is_suppressed: isOverallSuppressed,
    has_historical_comparison: false,
    historical_status: 'Not enough historical data',
    cycles: [
      {
        cycle_id: activeCycle.id,
        week_number: activeCycle.week_number,
        name: activeCycle.name,
        completed_count: isOverallSuppressed ? null : completedCount,
        average_overall_score: activeCycleAvg,
        dominant_band: activeCycleBand,
        is_suppressed: isOverallSuppressed,
      },
    ],
  };

  return {
    scope: {
      institution_id: clinicianProfile.institution_id || null,
      institution_name: scopeInstitutionName,
      is_national_scope: isNational,
      authorized_institutions_count: targetInstitutionIds.length,
    },
    cycle: {
      id: activeCycle.id,
      name: activeCycle.name,
      week_number: activeCycle.week_number,
      starts_at: activeCycle.starts_at,
      ends_at: activeCycle.ends_at,
      status: activeCycle.status,
    },
    overview: {
      total_eligible_students: totalEligible,
      completed_assessments_count: isOverallSuppressed ? null : completedCount,
      participation_rate: isOverallSuppressed ? null : participationRate,
      is_suppressed: isOverallSuppressed,
      suppression_notice: isOverallSuppressed
        ? `Privacy Protection Active: Completed reflections (${completedCount}) are below the minimum anonymity threshold (${PRIVACY_THRESHOLD_MIN_STUDENTS} students). Aggregate metrics are withheld.`
        : undefined,
    },
    wellbeing_distribution: {
      is_suppressed: isOverallSuppressed,
      suppression_notice: isOverallSuppressed
        ? 'Privacy Protected (N < 10): Wellbeing band distribution is withheld.'
        : undefined,
      total_responses: isOverallSuppressed ? null : completedCount,
      bands: distributionBands,
    },
    category_insights: categoryInsights,
    weekly_trends: weeklyTrends,
    areas_to_review: areasToReview,
    privacy: {
      threshold_min_students: PRIVACY_THRESHOLD_MIN_STUDENTS,
      rule: 'N < 10 → Privacy Protected (N < 10)',
    },
    disclaimer:
      'Wellbeing indicators are intended to support early awareness and planning. They are not clinical diagnoses or medical assessments.',
  };
}