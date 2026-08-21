import type {
  UserRole,
  WellnessCategory,
  WellnessBand,
  WellnessTrend,
  AssessmentStatus,
  InterventionStatus,
  QuestionType
} from './domain';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          institution_id: string | null;
          department_id: string | null;
          student_roll_no: string | null;
          year_level: number | null;
          section_code: string | null;
          avatar_url: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role: UserRole;
          institution_id?: string | null;
          department_id?: string | null;
          student_roll_no?: string | null;
          year_level?: number | null;
          section_code?: string | null;
          avatar_url?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: UserRole;
          institution_id?: string | null;
          department_id?: string | null;
          student_roll_no?: string | null;
          year_level?: number | null;
          section_code?: string | null;
          avatar_url?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      institutions: {
        Row: {
          id: string;
          name: string;
          code: string;
          district: string;
          state: string;
          institution_type: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          district: string;
          state: string;
          institution_type: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          district?: string;
          state?: string;
          institution_type?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      departments: {
        Row: {
          id: string;
          institution_id: string;
          name: string;
          code: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          name: string;
          code: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          name?: string;
          code?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      weekly_cycles: {
        Row: {
          id: string;
          week_number: number;
          name: string;
          description: string | null;
          starts_at: string;
          ends_at: string;
          status: string;
          total_questions: number;
          common_questions: number;
          adaptive_questions: number;
          session_duration_minutes: number;
          reflection_required: boolean;
          adaptive_questions_enabled: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          week_number: number;
          name: string;
          description?: string | null;
          starts_at: string;
          ends_at: string;
          status?: string;
          total_questions?: number;
          common_questions?: number;
          adaptive_questions?: number;
          session_duration_minutes?: number;
          reflection_required?: boolean;
          adaptive_questions_enabled?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          week_number?: number;
          name?: string;
          description?: string | null;
          starts_at?: string;
          ends_at?: string;
          status?: string;
          total_questions?: number;
          common_questions?: number;
          adaptive_questions?: number;
          session_duration_minutes?: number;
          reflection_required?: boolean;
          adaptive_questions_enabled?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      assessment_cycles: {
        Row: {
          id: string;
          name: string;
          week_number: number;
          starts_at: string;
          ends_at: string;
          status: string;
          total_questions: number;
          common_questions: number;
          adaptive_questions: number;
          session_duration_minutes: number;
          reflection_required: boolean;
          adaptive_questions_enabled: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          week_number: number;
          starts_at: string;
          ends_at: string;
          status?: string;
          total_questions?: number;
          common_questions?: number;
          adaptive_questions?: number;
          session_duration_minutes?: number;
          reflection_required?: boolean;
          adaptive_questions_enabled?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          week_number?: number;
          starts_at?: string;
          ends_at?: string;
          status?: string;
          total_questions?: number;
          common_questions?: number;
          adaptive_questions?: number;
          session_duration_minutes?: number;
          reflection_required?: boolean;
          adaptive_questions_enabled?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      questions: {
        Row: {
          id: string;
          text: string;
          category: WellnessCategory;
          question_type: QuestionType;
          weight: number;
          active: boolean;
          order_index: number;
          is_base_question: boolean;
          question_code: string | null;
          week_number: number;
          target_department: string;
          adaptive_trigger_group: string | null;
          required: boolean;
          reusable: boolean;
          cooldown_weeks: number;
          maximum_uses: number | null;
          adaptive_enabled: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          text: string;
          category: WellnessCategory;
          question_type: QuestionType;
          weight?: number;
          active?: boolean;
          order_index?: number;
          is_base_question?: boolean;
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
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          text?: string;
          category?: WellnessCategory;
          question_type?: QuestionType;
          weight?: number;
          active?: boolean;
          order_index?: number;
          is_base_question?: boolean;
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
          created_at?: string;
          updated_at?: string;
        };
      };
      question_selection_rules: {
        Row: {
          id: string;
          question_id: string;
          trigger_category: WellnessCategory | null;
          trigger_condition: string;
          trigger_value: number | null;
          priority: number;
          enabled: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          trigger_category?: WellnessCategory | null;
          trigger_condition: string;
          trigger_value?: number | null;
          priority?: number;
          enabled?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          trigger_category?: WellnessCategory | null;
          trigger_condition?: string;
          trigger_value?: number | null;
          priority?: number;
          enabled?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      student_question_assignments: {
        Row: {
          id: string;
          student_id: string;
          cycle_id: string;
          question_id: string;
          selection_type: string;
          selection_priority: number | null;
          position: number;
          answered: boolean;
          answered_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          cycle_id: string;
          question_id: string;
          selection_type: string;
          selection_priority?: number | null;
          position: number;
          answered?: boolean;
          answered_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          cycle_id?: string;
          question_id?: string;
          selection_type?: string;
          selection_priority?: number | null;
          position?: number;
          answered?: boolean;
          answered_at?: string | null;
          created_at?: string;
        };
      };
      question_options: {
        Row: {
          id: string;
          question_id: string;
          label: string;
          score: number;
          order_index: number;
          option_code: string | null;
          signal_value: number | null;
          follow_up_group: string | null;
        };
        Insert: {
          id?: string;
          question_id: string;
          label: string;
          score: number;
          order_index?: number;
          option_code?: string | null;
          signal_value?: number | null;
          follow_up_group?: string | null;
        };
        Update: {
          id?: string;
          question_id?: string;
          label?: string;
          score?: number;
          order_index?: number;
          option_code?: string | null;
          signal_value?: number | null;
          follow_up_group?: string | null;
        };
      };
      question_rules: {
        Row: {
          id: string;
          trigger_question_id: string;
          operator: string;
          threshold: number;
          target_category: WellnessCategory;
          follow_up_question_id: string;
          priority: number;
          active: boolean;
        };
        Insert: {
          id?: string;
          trigger_question_id: string;
          operator: string;
          threshold: number;
          target_category: WellnessCategory;
          follow_up_question_id: string;
          priority?: number;
          active?: boolean;
        };
        Update: {
          id?: string;
          trigger_question_id?: string;
          operator?: string;
          threshold?: number;
          target_category?: WellnessCategory;
          follow_up_question_id?: string;
          priority?: number;
          active?: boolean;
        };
      };
      student_tasks: {
        Row: {
          id: string;
          student_id: string;
          assessment_id: string | null;
          category: WellnessCategory;
          title: string;
          description: string;
          estimated_minutes: number;
          task_type: string;
          due_date: string | null;
          status: string;
          credits_awarded: number;
          source_reason: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          assessment_id?: string | null;
          category: WellnessCategory;
          title: string;
          description: string;
          estimated_minutes?: number;
          task_type?: string;
          due_date?: string | null;
          status?: string;
          credits_awarded?: number;
          source_reason?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          assessment_id?: string | null;
          category?: WellnessCategory;
          title?: string;
          description?: string;
          estimated_minutes?: number;
          task_type?: string;
          due_date?: string | null;
          status?: string;
          credits_awarded?: number;
          source_reason?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
      };
      student_credits_log: {
        Row: {
          id: string;
          student_id: string;
          amount: number;
          activity_type: string;
          description: string | null;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          amount: number;
          activity_type: string;
          description?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          amount?: number;
          activity_type?: string;
          description?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
      };
      question_imports: {
        Row: {
          id: string;
          admin_id: string;
          filename: string;
          total_rows: number;
          successful_rows: number;
          error_log: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          filename: string;
          total_rows: number;
          successful_rows: number;
          error_log?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string;
          filename?: string;
          total_rows?: number;
          successful_rows?: number;
          error_log?: Json | null;
          created_at?: string;
        };
      };
      assessments: {
        Row: {
          id: string;
          student_id: string;
          cycle_id: string;
          status: AssessmentStatus;
          started_at: string;
          completed_at: string | null;
          overall_indicator: number | null;
          overall_band: WellnessBand | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          cycle_id: string;
          status?: AssessmentStatus;
          started_at?: string;
          completed_at?: string | null;
          overall_indicator?: number | null;
          overall_band?: WellnessBand | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          cycle_id?: string;
          status?: AssessmentStatus;
          started_at?: string;
          completed_at?: string | null;
          overall_indicator?: number | null;
          overall_band?: WellnessBand | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      assessment_responses: {
        Row: {
          id: string;
          assessment_id: string;
          question_id: string;
          selected_option_id: string | null;
          text_response: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          question_id: string;
          selected_option_id?: string | null;
          text_response?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          assessment_id?: string;
          question_id?: string;
          selected_option_id?: string | null;
          text_response?: string | null;
          created_at?: string;
        };
      };
      assessment_category_scores: {
        Row: {
          id: string;
          assessment_id: string;
          category: WellnessCategory;
          score: number;
          band: WellnessBand;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          category: WellnessCategory;
          score: number;
          band: WellnessBand;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          assessment_id?: string;
          category?: WellnessCategory;
          score?: number;
          band?: WellnessBand;
          created_at?: string;
          updated_at?: string;
        };
      };
      recommendations: {
        Row: {
          id: string;
          category: WellnessCategory;
          title: string;
          description: string;
          priority: number;
          active: boolean;
        };
        Insert: {
          id?: string;
          category: WellnessCategory;
          title: string;
          description: string;
          priority?: number;
          active?: boolean;
        };
        Update: {
          id?: string;
          category?: WellnessCategory;
          title?: string;
          description?: string;
          priority?: number;
          active?: boolean;
        };
      };
      assessment_recommendations: {
        Row: {
          id: string;
          assessment_id: string;
          recommendation_id: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          recommendation_id: string;
        };
        Update: {
          id?: string;
          assessment_id?: string;
          recommendation_id?: string;
        };
      };
      interventions: {
        Row: {
          id: string;
          institution_id: string;
          created_by: string;
          title: string;
          description: string;
          category: WellnessCategory;
          target_department_id: string | null;
          target_year: number | null;
          scheduled_at: string;
          location: string;
          capacity: number | null;
          status: InterventionStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
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
          status?: InterventionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          created_by?: string;
          title?: string;
          description?: string;
          category?: WellnessCategory;
          target_department_id?: string | null;
          target_year?: number | null;
          scheduled_at?: string;
          location?: string;
          capacity?: number | null;
          status?: InterventionStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      intervention_attendance: {
        Row: {
          id: string;
          intervention_id: string;
          student_id: string;
          attended_at: string;
        };
        Insert: {
          id?: string;
          intervention_id: string;
          student_id: string;
          attended_at?: string;
        };
        Update: {
          id?: string;
          intervention_id?: string;
          student_id?: string;
          attended_at?: string;
        };
      };
      intervention_feedback: {
        Row: {
          id: string;
          intervention_id: string;
          rating: number;
          anonymous_comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          intervention_id: string;
          rating: number;
          anonymous_comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          intervention_id?: string;
          rating?: number;
          anonymous_comment?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_student_task: {
        Args: {
          p_task_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      user_role: UserRole;
      wellness_category: WellnessCategory;
      wellness_band: WellnessBand;
      assessment_status: AssessmentStatus;
      intervention_status: InterventionStatus;
      question_type: QuestionType;
    };
  };
}
