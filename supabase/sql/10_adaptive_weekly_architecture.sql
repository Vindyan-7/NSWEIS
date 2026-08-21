-- NSWEIS SQL MIGRATION
-- ID: 10
-- Feature: Adaptive Weekly Journey Database Foundation
-- Purpose: Schema baseline for configurable weekly cycles, question selection rules, question reuse metadata, and student question assignment history.
-- Execution: Safe for repeated manual execution in Supabase SQL Editor
-- Dependencies: 00_initial_schema.sql through 09_recommendation_engine.sql
-- Status: PENDING MANUAL EXECUTION

-- ============================================================
-- BLOCK 1: Weekly Cycles Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weekly_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INTEGER NOT NULL CHECK (week_number >= 1),
  name TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'active', 'closed')),
  total_questions INTEGER NOT NULL DEFAULT 10 CHECK (total_questions >= 1),
  common_questions INTEGER NOT NULL DEFAULT 7 CHECK (common_questions >= 0),
  adaptive_questions INTEGER NOT NULL DEFAULT 3 CHECK (adaptive_questions >= 0),
  session_duration_minutes INTEGER NOT NULL DEFAULT 20 CHECK (session_duration_minutes >= 1),
  reflection_required BOOLEAN NOT NULL DEFAULT TRUE,
  adaptive_questions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_weekly_cycles_dates CHECK (ends_at > starts_at),
  CONSTRAINT chk_weekly_cycles_questions CHECK (common_questions + adaptive_questions <= total_questions)
);

-- Partial unique index: Only one weekly cycle can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_cycles_active_unique 
  ON public.weekly_cycles(status) WHERE status = 'active';

-- ============================================================
-- BLOCK 2: Question Library Extensions
-- ============================================================
ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS reusable BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cooldown_weeks INTEGER NOT NULL DEFAULT 0 CHECK (cooldown_weeks >= 0),
  ADD COLUMN IF NOT EXISTS maximum_uses INTEGER CHECK (maximum_uses IS NULL OR maximum_uses >= 1),
  ADD COLUMN IF NOT EXISTS adaptive_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================
-- BLOCK 3: Question Selection Rules Configuration Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_selection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  trigger_category wellness_category,
  trigger_condition TEXT NOT NULL,
  trigger_value NUMERIC(4,1) CHECK (trigger_value IS NULL OR (trigger_value >= 0.0 AND trigger_value <= 10.0)),
  priority INTEGER NOT NULL DEFAULT 50 CHECK (priority >= 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BLOCK 4: Student Question Assignment History Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_question_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES public.weekly_cycles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  selection_type TEXT NOT NULL CHECK (selection_type IN ('common', 'adaptive')),
  selection_priority INTEGER,
  position INTEGER NOT NULL CHECK (position >= 1),
  answered BOOLEAN NOT NULL DEFAULT FALSE,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_student_cycle_question UNIQUE (student_id, cycle_id, question_id)
);

-- ============================================================
-- BLOCK 5: Performance Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_weekly_cycles_status ON public.weekly_cycles(status);
CREATE INDEX IF NOT EXISTS idx_weekly_cycles_week_num ON public.weekly_cycles(week_number);
CREATE INDEX IF NOT EXISTS idx_questions_adaptive_enabled ON public.questions(adaptive_enabled);
CREATE INDEX IF NOT EXISTS idx_selection_rules_question ON public.question_selection_rules(question_id);
CREATE INDEX IF NOT EXISTS idx_selection_rules_enabled_pri ON public.question_selection_rules(enabled, priority);
CREATE INDEX IF NOT EXISTS idx_student_assignments_student_cycle ON public.student_question_assignments(student_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_student_assignments_question ON public.student_question_assignments(question_id);
CREATE INDEX IF NOT EXISTS idx_student_assignments_student_question ON public.student_question_assignments(student_id, question_id);

-- ============================================================
-- BLOCK 6: Enable RLS & Configure Hardened Policies
-- ============================================================
ALTER TABLE public.weekly_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_selection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_question_assignments ENABLE ROW LEVEL SECURITY;

-- weekly_cycles policies
DROP POLICY IF EXISTS "Weekly cycles read access for authenticated users" ON public.weekly_cycles;
CREATE POLICY "Weekly cycles read access for authenticated users" ON public.weekly_cycles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admins can manage weekly cycles" ON public.weekly_cycles;
CREATE POLICY "Super admins can manage weekly cycles" ON public.weekly_cycles
  FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');

-- question_selection_rules policies (Strictly internal to Super Admin)
DROP POLICY IF EXISTS "Super admins can manage selection rules" ON public.question_selection_rules;
CREATE POLICY "Super admins can manage selection rules" ON public.question_selection_rules
  FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');

-- student_question_assignments policies (Students read own assignments only)
DROP POLICY IF EXISTS "Students can view own question assignments" ON public.student_question_assignments;
CREATE POLICY "Students can view own question assignments" ON public.student_question_assignments
  FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "Super admins can manage question assignments" ON public.student_question_assignments;
CREATE POLICY "Super admins can manage question assignments" ON public.student_question_assignments
  FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
