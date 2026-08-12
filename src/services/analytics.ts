import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { WellnessCategory, WellnessBand } from '../types/domain';

export interface ParticipationMetrics {
  total_eligible_students: number;
  participating_students: number;
  participation_rate: number;
  active_cycle_name: string;
  active_cycle_id?: string | null;
}

export interface CategoryAggregateSummary {
  category: WellnessCategory;
  average_score: number | null;
  dominant_band: WellnessBand | null;
  participating_student_count: number;
  is_suppressed: boolean;
}

export interface DepartmentAggregateSummary {
  department_id: string;
  department_name: string;
  department_code: string;
  participating_student_count: number;
  average_overall_score: number | null;
  dominant_band: WellnessBand | null;
  is_suppressed: boolean;
  suppression_message?: string | null;
}

export const PRIVACY_THRESHOLD_MIN_STUDENTS = 10;

export async function getCollegeParticipationMetrics(
  supabase: SupabaseClient<Database>,
  institutionId: string
): Promise<ParticipationMetrics> {
  const { data, error } = await (supabase as any).rpc('get_college_participation_metrics', {
    p_institution_id: institutionId,
  });

  if (error || !data || data.length === 0) {
    // Fallback query directly from profiles & assessment tables
    const { count: eligibleCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('institution_id', institutionId)
      .eq('role', 'student')
      .eq('active', true);

    const { data: cycleData } = await supabase
      .from('assessment_cycles')
      .select('*')
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .single();

    const cycle = cycleData as any;
    const eligible = eligibleCount || 0;

    if (!cycle) {
      return {
        total_eligible_students: eligible,
        participating_students: 0,
        participation_rate: 0,
        active_cycle_name: 'No Active Cycle',
      };
    }

    const { data: assessmentsData } = await supabase
      .from('assessments')
      .select('student_id')
      .eq('cycle_id', cycle.id)
      .eq('status', 'completed');

    const assessments = (assessmentsData || []) as any[];

    const participating = assessments.length > 0 ? new Set(assessments.map((a) => a.student_id)).size : 0;
    const rate = eligible > 0 ? Math.round((participating / eligible) * 1000) / 10 : 0;

    return {
      total_eligible_students: eligible,
      participating_students: participating,
      participation_rate: rate,
      active_cycle_name: cycle.name,
      active_cycle_id: cycle.id,
    };
  }

  const row = data[0];
  return {
    total_eligible_students: Number(row.total_eligible_students || 0),
    participating_students: Number(row.participating_students || 0),
    participation_rate: Number(row.participation_rate || 0),
    active_cycle_name: row.active_cycle_name || 'Active Check-in',
    active_cycle_id: row.active_cycle_id,
  };
}

export async function getCollegeCategorySummaries(
  supabase: SupabaseClient<Database>,
  institutionId: string
): Promise<CategoryAggregateSummary[]> {
  const { data, error } = await (supabase as any).rpc('get_college_category_summary', {
    p_institution_id: institutionId,
  });

  if (!error && data && data.length > 0) {
    return data.map((r: any) => ({
      category: r.category as WellnessCategory,
      average_score: r.average_score !== null ? Number(r.average_score) : null,
      dominant_band: r.dominant_band as WellnessBand | null,
      participating_student_count: Number(r.participating_student_count || 0),
      is_suppressed: Boolean(r.is_suppressed),
    }));
  }

  // Pure Client-side Fallback with Privacy Threshold Enforcement (>=10)
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
    participating_student_count: 0,
    is_suppressed: true,
  }));
}

export async function getCollegeDepartmentSummaries(
  supabase: SupabaseClient<Database>,
  institutionId: string
): Promise<DepartmentAggregateSummary[]> {
  const { data, error } = await (supabase as any).rpc('get_college_department_summary', {
    p_institution_id: institutionId,
  });

  if (!error && data && data.length > 0) {
    return data.map((r: any) => ({
      department_id: r.department_id,
      department_name: r.department_name,
      department_code: r.department_code,
      participating_student_count: Number(r.participating_student_count || 0),
      average_overall_score: r.average_overall_score !== null ? Number(r.average_overall_score) : null,
      dominant_band: r.dominant_band as WellnessBand | null,
      is_suppressed: Boolean(r.is_suppressed),
      suppression_message: r.suppression_message,
    }));
  }

  // Fetch departments for fallback display with threshold protection
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
    participating_student_count: 0,
    average_overall_score: null,
    dominant_band: null,
    is_suppressed: true,
    suppression_message: 'Insufficient group size for anonymous reporting.',
  }));
}
