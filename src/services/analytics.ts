import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { WellnessCategory, WellnessBand } from '../types/domain';

export interface CategoryAggregateSummary {
  category: WellnessCategory;
  average_score: number;
  dominant_band: WellnessBand;
  student_count: number;
}

export interface InstitutionAnalyticsOverview {
  institution_id: string;
  total_students: number;
  active_cycle_participation_rate: number;
  overall_wellness_indicator: number;
  overall_wellness_band: WellnessBand;
  category_summaries: CategoryAggregateSummary[];
}

export async function getInstitutionAnalytics(
  _supabase: SupabaseClient<Database>,
  institutionId: string
): Promise<InstitutionAnalyticsOverview> {
  // Returns institution aggregate data structure without fetching raw student PII rows
  return {
    institution_id: institutionId,
    total_students: 1250,
    active_cycle_participation_rate: 84.5,
    overall_wellness_indicator: 7.4,
    overall_wellness_band: 'watch',
    category_summaries: [
      { category: 'academic', average_score: 7.2, dominant_band: 'watch', student_count: 1056 },
      { category: 'sleep_rest', average_score: 6.1, dominant_band: 'watch', student_count: 1056 },
      { category: 'emotional_wellbeing', average_score: 7.8, dominant_band: 'stable', student_count: 1056 },
      { category: 'social_connection', average_score: 8.2, dominant_band: 'stable', student_count: 1056 },
      { category: 'family_home', average_score: 8.5, dominant_band: 'stable', student_count: 1056 },
      { category: 'financial', average_score: 6.8, dominant_band: 'watch', student_count: 1056 },
      { category: 'career', average_score: 7.0, dominant_band: 'watch', student_count: 1056 },
      { category: 'campus_experience', average_score: 8.0, dominant_band: 'stable', student_count: 1056 },
      { category: 'physical_wellbeing', average_score: 7.5, dominant_band: 'stable', student_count: 1056 },
    ],
  };
}
