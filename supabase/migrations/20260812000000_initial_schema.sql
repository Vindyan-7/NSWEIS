-- NSWEIS Initial Database Schema Migration
-- Version: 1.0 (CTO Baseline)

-- 1. Create Enums
CREATE TYPE user_role AS ENUM ('student', 'college_officer', 'government_admin', 'super_admin');

CREATE TYPE wellness_category AS ENUM (
  'academic',
  'sleep_rest',
  'emotional_wellbeing',
  'social_connection',
  'family_home',
  'financial',
  'career',
  'campus_experience',
  'physical_wellbeing'
);

CREATE TYPE wellness_band AS ENUM ('stable', 'watch', 'needs_attention', 'elevated');

CREATE TYPE assessment_status AS ENUM ('not_started', 'in_progress', 'completed');

CREATE TYPE intervention_status AS ENUM ('draft', 'scheduled', 'ongoing', 'completed', 'cancelled');

CREATE TYPE question_type AS ENUM ('single_choice', 'multiple_choice', 'scale_1_5', 'text', 'voice');

-- 2. Create Tables

-- Institutions Table
CREATE TABLE public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  institution_type TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Departments Table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles Table (Linked directly to auth.users.id)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  student_roll_no TEXT,
  year_level INT,
  avatar_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assessment Cycles Table
CREATE TABLE public.assessment_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  week_number INT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Questions Table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  category wellness_category NOT NULL,
  question_type question_type NOT NULL DEFAULT 'single_choice',
  weight NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  order_index INT NOT NULL DEFAULT 0,
  is_base_question BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Question Options Table
CREATE TABLE public.question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  score NUMERIC(3,1) NOT NULL,
  order_index INT NOT NULL DEFAULT 0
);

-- Question Rules Table (Adaptive Follow-ups)
CREATE TABLE public.question_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  operator TEXT NOT NULL DEFAULT 'less_than',
  threshold NUMERIC(3,1) NOT NULL DEFAULT 6.0,
  target_category wellness_category NOT NULL,
  follow_up_question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  priority INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Assessments Table
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES public.assessment_cycles(id) ON DELETE CASCADE,
  status assessment_status NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  overall_indicator NUMERIC(3,1),
  overall_band wellness_band,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_student_cycle UNIQUE (student_id, cycle_id)
);

-- Assessment Responses Table
CREATE TABLE public.assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES public.question_options(id) ON DELETE SET NULL,
  text_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_assessment_question UNIQUE (assessment_id, question_id)
);

-- Assessment Category Scores Table
CREATE TABLE public.assessment_category_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  category wellness_category NOT NULL,
  score NUMERIC(3,1) NOT NULL,
  band wellness_band NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_assessment_category UNIQUE (assessment_id, category)
);

-- Recommendations Table
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category wellness_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Assessment Recommendations Table
CREATE TABLE public.assessment_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  recommendation_id UUID NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE
);

-- Interventions Table
CREATE TABLE public.interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category wellness_category NOT NULL,
  target_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  target_year INT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL,
  capacity INT,
  status intervention_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intervention Attendance Table
CREATE TABLE public.intervention_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intervention Feedback Table
CREATE TABLE public.intervention_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  anonymous_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Performance Indexes
CREATE INDEX idx_profiles_institution ON public.profiles(institution_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_departments_institution ON public.departments(institution_id);
CREATE INDEX idx_assessments_student ON public.assessments(student_id);
CREATE INDEX idx_assessments_cycle ON public.assessments(cycle_id);
CREATE INDEX idx_responses_assessment ON public.assessment_responses(assessment_id);
CREATE INDEX idx_category_scores_assessment ON public.assessment_category_scores(assessment_id);
CREATE INDEX idx_interventions_institution ON public.interventions(institution_id);
CREATE INDEX idx_attendance_intervention ON public.intervention_attendance(intervention_id);

-- 4. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_category_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Helper Function for Profile Role Retrieval
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 6. Baseline RLS Policies

-- Public / Authenticated read access for Institutions & Departments
CREATE POLICY "Institutions visible to authenticated users" ON public.institutions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Departments visible to authenticated users" ON public.departments
  FOR SELECT TO authenticated USING (true);

-- Profiles: Users can view and edit their own profile
CREATE POLICY "Users can select own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.get_user_role() IN ('super_admin', 'government_admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Assessment Cycles & Questions: Read access for authenticated users
CREATE POLICY "Assessment cycles read access" ON public.assessment_cycles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Questions read access" ON public.questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Question options read access" ON public.question_options
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Question rules read access" ON public.question_rules
  FOR SELECT TO authenticated USING (true);

-- Assessments & Responses: Strictly owned by student
CREATE POLICY "Students can manage own assessments" ON public.assessments
  FOR ALL TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Students can manage own responses" ON public.assessment_responses
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE public.assessments.id = assessment_id AND public.assessments.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can view own category scores" ON public.assessment_category_scores
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE public.assessments.id = assessment_id AND public.assessments.student_id = auth.uid()
    )
  );

-- Recommendations: Read access for authenticated users
CREATE POLICY "Recommendations read access" ON public.recommendations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Students can view own assessment recommendations" ON public.assessment_recommendations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE public.assessments.id = assessment_id AND public.assessments.student_id = auth.uid()
    )
  );

-- Interventions: Officers can manage for their institution
CREATE POLICY "Interventions read access" ON public.interventions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Officers can insert interventions" ON public.interventions
  FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role() IN ('college_officer', 'super_admin')
  );

CREATE POLICY "Officers can update interventions" ON public.interventions
  FOR UPDATE TO authenticated USING (
    public.get_user_role() IN ('college_officer', 'super_admin')
  );
