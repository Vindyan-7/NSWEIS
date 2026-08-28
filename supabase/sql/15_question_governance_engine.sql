-- ============================================================================
-- NSWEIS · 15_question_governance_engine.sql
-- PHASE 11 / FEATURE 7: Clinical Question Governance & Weekly Delivery Engine
-- Idempotent, safe to re-run.
-- ============================================================================

-- 1. Extend public.questions for explicit lifecycle states, versioning & supportive recommendations
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS status text CHECK (status IN (
    'draft',
    'peer_review',
    'revision_requested',
    'peer_approved',
    'regional_review',
    'regional_revision_requested',
    'regionally_approved',
    'active',
    'archived'
  )) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_question_id uuid REFERENCES public.questions(id),
  ADD COLUMN IF NOT EXISTS region_id text DEFAULT 'national',
  ADD COLUMN IF NOT EXISTS recommendation_title text,
  ADD COLUMN IF NOT EXISTS recommendation_description text,
  ADD COLUMN IF NOT EXISTS task_title text,
  ADD COLUMN IF NOT EXISTS task_description text,
  ADD COLUMN IF NOT EXISTS estimated_minutes integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS credits_awarded integer DEFAULT 10;

-- 2. Audit table for question governance event timeline
CREATE TABLE IF NOT EXISTS public.question_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on question_audit_logs
ALTER TABLE public.question_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY question_audit_logs_read_policy ON public.question_audit_logs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY question_audit_logs_insert_policy ON public.question_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. Weekly Question Pools table
CREATE TABLE IF NOT EXISTS public.weekly_question_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id text NOT NULL DEFAULT 'national',
  week_number integer NOT NULL DEFAULT 1,
  cycle_id uuid REFERENCES public.assessment_cycles(id),
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'peer_approved', 'regional_review', 'active', 'archived')) DEFAULT 'draft',
  activated_by uuid REFERENCES public.profiles(id),
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on weekly_question_pools
ALTER TABLE public.weekly_question_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY weekly_pools_read_policy ON public.weekly_question_pools
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY weekly_pools_write_policy ON public.weekly_question_pools
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.question_audit_logs IS
  'Governance event history for clinician authoring, peer review, and regional activation.';

COMMENT ON TABLE public.weekly_question_pools IS
  'Regional weekly question pools grouping common and adaptive candidates for active cycles.';
