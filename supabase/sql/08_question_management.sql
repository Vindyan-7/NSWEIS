-- NSWEIS SQL MIGRATION
-- ID: 08
-- Feature: Question Management & CSV Import RLS Policies
-- Purpose: Configures RLS policies granting super_admin full management capabilities over questions, question_options, and question_imports tables.
-- Execution: Safe for repeated manual execution in Supabase SQL Editor
-- Dependencies: 00_initial_schema.sql, 07_student_first_mvp_schema.sql
-- Status: PENDING MANUAL EXECUTION

-- ============================================================
-- BLOCK 1: Super Admin Management RLS Policies for Questions
-- ============================================================
DROP POLICY IF EXISTS "Super admins can manage questions" ON public.questions;
CREATE POLICY "Super admins can manage questions" ON public.questions
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- ============================================================
-- BLOCK 2: Super Admin Management RLS Policies for Question Options
-- ============================================================
DROP POLICY IF EXISTS "Super admins can manage question options" ON public.question_options;
CREATE POLICY "Super admins can manage question options" ON public.question_options
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- ============================================================
-- BLOCK 3: Super Admin Management RLS Policies for Question Imports
-- ============================================================
DROP POLICY IF EXISTS "Super admins can manage question imports" ON public.question_imports;
CREATE POLICY "Super admins can manage question imports" ON public.question_imports
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');
