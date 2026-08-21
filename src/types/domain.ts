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
  | 'physical_wellbeing'
  | 'digital_balance';

export type WellnessBand = 'stable' | 'watch' | 'needs_attention' | 'elevated';

export type WellnessTrend = 'improving' | 'stable' | 'declining' | 'first_check_in';

export type AssessmentStatus = 'not_started' | 'in_progress' | 'completed';

export type InterventionStatus = 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'expired';

export type QuestionType = 'single_choice' | 'multiple_choice' | 'scale_1_5' | 'text' | 'voice';

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  institution_id?: string | null;
  department_id?: string | null;
  student_roll_no?: string | null;
  year_level?: number | null;
  section_code?: string | null;
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
  question_code?: string | null;
  week_number?: number;
  target_department?: string;
  adaptive_trigger_group?: string | null;
  required?: boolean;
  reusable?: boolean;
  cooldown_weeks?: number;
  maximum_uses?: number | null;
  adaptive_enabled?: boolean;
  created_by?: string | null;
  updated_at?: string;
  options?: QuestionOption[];
}

export interface WeeklyCycle {
  id: string;
  week_number: number;
  name: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  status: 'draft' | 'scheduled' | 'active' | 'closed';
  total_questions: number;
  common_questions: number;
  adaptive_questions: number;
  session_duration_minutes: number;
  reflection_required: boolean;
  adaptive_questions_enabled: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionSelectionRule {
  id: string;
  question_id: string;
  trigger_category?: WellnessCategory | null;
  trigger_condition: string;
  trigger_value?: number | null;
  priority: number;
  enabled: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentQuestionAssignment {
  id: string;
  student_id: string;
  cycle_id: string;
  question_id: string;
  selection_type: 'common' | 'adaptive';
  selection_priority?: number | null;
  position: number;
  answered: boolean;
  answered_at?: string | null;
  created_at: string;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  label: string;
  score: number;
  order_index: number;
  option_code?: string | null;
  signal_value?: number | null;
  follow_up_group?: string | null;
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

export interface StudentTask {
  id: string;
  student_id: string;
  assessment_id?: string | null;
  category: WellnessCategory;
  title: string;
  description: string;
  estimated_minutes: number;
  task_type: string;
  due_date?: string | null;
  status: TaskStatus;
  credits_awarded: number;
  source_reason?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface StudentCreditLog {
  id: string;
  student_id: string;
  amount: number;
  activity_type: string;
  description?: string | null;
  reference_id?: string | null;
  created_at: string;
}

export interface QuestionImport {
  id: string;
  admin_id: string;
  filename: string;
  total_rows: number;
  successful_rows: number;
  error_log?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  created_at: string;
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
