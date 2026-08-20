-- NSWEIS SQL MIGRATION
-- ID: 07
-- Feature: Student-First MVP Schema Extensions (Section, Credits Ledger, Tasks, Question Targeting, Import Audit)
-- Purpose: Complete database baseline for student-first MVP companion model. Adds digital_balance category, section_code to profiles, student_credits_log immutable ledger, student_tasks table, task completion RPC, question targeting fields, and question_imports audit table.
-- Execution: Safe for repeated manual execution in Supabase SQL Editor
-- Dependencies: 00_initial_schema.sql, 01_seed_demo_data.sql, 02_demo_student_profile.sql, 03_college_institutional_intelligence.sql, 04_government_intelligence.sql, 05_demo_government_dataset.sql, 06_hackathon_demo_dataset.sql
-- Status: PENDING MANUAL EXECUTION

-- ============================================================
-- BLOCK 1: Extend Wellness Category Enum safely
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'wellness_category'::regtype
    AND enumlabel = 'digital_balance'
  ) THEN
    ALTER TYPE wellness_category ADD VALUE 'digital_balance';
  END IF;
END $$;

-- ============================================================
-- BLOCK 2: Profile Table Extension (Section Only)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS section_code TEXT DEFAULT 'A';

-- ============================================================
-- BLOCK 3: Question Table Extensions (Targeting & Codes)
-- ============================================================
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS week_number INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS target_department TEXT DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS adaptive_trigger_group TEXT,
  ADD COLUMN IF NOT EXISTS required BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_questions_targeting
  ON public.questions(week_number, target_department, active);

-- ============================================================
-- BLOCK 4: Question Options Extensions
-- ============================================================
ALTER TABLE public.question_options
  ADD COLUMN IF NOT EXISTS option_code TEXT,
  ADD COLUMN IF NOT EXISTS signal_value NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS follow_up_group TEXT;

-- ============================================================
-- BLOCK 5: Student Credits Immutable Ledger Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_credits_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credits_log_student ON public.student_credits_log(student_id);
CREATE INDEX IF NOT EXISTS idx_credits_log_reference ON public.student_credits_log(reference_id);

-- Database-level uniqueness guarantee for credit reference awards (Prevents concurrent double-crediting)
CREATE UNIQUE INDEX IF NOT EXISTS idx_credits_log_reference_unique
  ON public.student_credits_log(reference_id)
  WHERE reference_id IS NOT NULL;

-- ============================================================
-- BLOCK 6: Student Tasks Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
  category wellness_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  estimated_minutes INT NOT NULL DEFAULT 15,
  task_type TEXT NOT NULL DEFAULT 'reflection',
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  credits_awarded INT NOT NULL DEFAULT 10,
  source_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_tasks_student ON public.student_tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_student_tasks_status ON public.student_tasks(student_id, status);

-- ============================================================
-- BLOCK 7: Question Imports Audit Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  total_rows INT NOT NULL,
  successful_rows INT NOT NULL,
  error_log JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BLOCK 8: Controlled Task Completion SECURITY DEFINER RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_student_task(p_task_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_task public.student_tasks%ROWTYPE;
BEGIN
  -- 1. Verify caller authentication
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: authentication required.' USING ERRCODE = '42501';
  END IF;

  -- 2. Fetch task with row-level lock and verify student ownership
  SELECT * INTO v_task FROM public.student_tasks
  WHERE id = p_task_id AND student_id = v_caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or access denied.' USING ERRCODE = '42501';
  END IF;

  -- 3. Idempotency & status state transition checks
  IF v_task.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'task_id', p_task_id);
  ELSIF v_task.status NOT IN ('pending', 'in_progress') THEN
    RAISE EXCEPTION 'Task cannot be completed from state: %', v_task.status USING ERRCODE = '42501';
  END IF;

  -- 4. Mark task as completed server-side
  UPDATE public.student_tasks
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = p_task_id;

  -- 5. Award credit ledger entry with DB-level unique constraint guard
  IF v_task.credits_awarded > 0 THEN
    INSERT INTO public.student_credits_log (
      student_id,
      amount,
      activity_type,
      description,
      reference_id
    ) VALUES (
      v_caller_id,
      v_task.credits_awarded,
      'task_completion',
      'Completed task: ' || v_task.title,
      p_task_id
    )
    ON CONFLICT (reference_id) WHERE reference_id IS NOT NULL DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'credits_awarded', v_task.credits_awarded, 'task_id', p_task_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke execute from public/anon, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.complete_student_task(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_student_task(UUID) TO authenticated;

-- ============================================================
-- BLOCK 9: Enable RLS & Configure Strict Policies
-- ============================================================
ALTER TABLE public.student_credits_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_imports ENABLE ROW LEVEL SECURITY;

-- student_credits_log: SELECT own rows only
DROP POLICY IF EXISTS "Students can view own credit logs" ON public.student_credits_log;
CREATE POLICY "Students can view own credit logs" ON public.student_credits_log
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- student_tasks: SELECT own tasks only
DROP POLICY IF EXISTS "Students can view own tasks" ON public.student_tasks;
CREATE POLICY "Students can view own tasks" ON public.student_tasks
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- question_imports: super_admin only
DROP POLICY IF EXISTS "Super admins can manage question imports" ON public.question_imports;
CREATE POLICY "Super admins can manage question imports" ON public.question_imports
  FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');
