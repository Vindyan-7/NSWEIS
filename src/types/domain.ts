export type UserRole = 'student' | 'college_officer' | 'government_admin' | 'super_admin';

export type WellnessCategory =
  | 'academic'
  | 'sleep_rest'
  | 'emotional_wellbeing'
  | 'social_connection'
  | 'family_home'
  | 'financial'
  | 'career'
  | 'campus_experience'
  | 'physical_wellbeing';

export type WellnessBand = 'stable' | 'watch' | 'needs_attention' | 'elevated';

export type WellnessTrend = 'improving' | 'stable' | 'declining' | 'first_check_in';

export type AssessmentStatus = 'not_started' | 'in_progress' | 'completed';

export type InterventionStatus = 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export type QuestionType = 'single_choice' | 'multiple_choice' | 'scale_1_5' | 'text' | 'voice';

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  institution_id?: string | null;
  department_id?: string | null;
  student_roll_no?: string | null;
  year_level?: number | null;
  avatar_url?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Institution {
  id: string;
  name: string;
  code: string;
  district: string;
  state: string;
  institution_type: string;
  type?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  institution_id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssessmentCycle {
  id: string;
  name: string;
  week_number: number;
  starts_at: string;
  ends_at: string;
  status: 'upcoming' | 'active' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  text: string;
  category: WellnessCategory;
  question_type: QuestionType;
  weight: number;
  active: boolean;
  order_index: number;
  is_base_question: boolean;
  options?: QuestionOption[];
}

export interface QuestionOption {
  id: string;
  question_id: string;
  label: string;
  score: number;
  order_index: number;
}

export interface QuestionRule {
  id: string;
  trigger_question_id?: string | null;
  target_category: WellnessCategory;
  operator: 'less_than_or_equal' | 'less_than' | 'equals';
  threshold: number;
  follow_up_question_id: string;
  priority: number;
  active: boolean;
}

export interface Assessment {
  id: string;
  student_id: string;
  cycle_id: string;
  status: AssessmentStatus;
  started_at: string;
  completed_at?: string | null;
  overall_indicator?: number | null;
  overall_band?: WellnessBand | null;
  created_at: string;
  updated_at: string;
  cycle?: AssessmentCycle;
}

export interface AssessmentResponse {
  id: string;
  assessment_id: string;
  question_id: string;
  selected_option_id?: string | null;
  text_response?: string | null;
  created_at: string;
}

export interface AssessmentCategoryScore {
  id: string;
  assessment_id: string;
  category: WellnessCategory;
  score: number;
  band: WellnessBand;
  created_at: string;
  updated_at: string;
}

export interface Recommendation {
  id: string;
  category: WellnessCategory;
  title: string;
  description: string;
  priority: number;
  active: boolean;
}

export interface Intervention {
  id: string;
  institution_id: string;
  created_by: string;
  title: string;
  description: string;
  category: WellnessCategory;
  target_department_id?: string | null;
  target_year?: number | null;
  scheduled_at: string;
  location: string;
  capacity?: number | null;
  status: InterventionStatus;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}
