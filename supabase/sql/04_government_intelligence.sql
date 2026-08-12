-- NSWEIS SQL MIGRATION
-- ID: 04
-- Feature: Government Intelligence & Scope Authorization (Idempotent)
-- Purpose: Create government_admin_scopes table, RPC aggregation functions with unbypassable auth.uid() authorization and REVOKE/GRANT security controls
-- Execution: Safe for repeated manual execution in Supabase SQL Editor
-- Dependencies: 00_initial_schema.sql, 01_seed_demo_data.sql, 02_demo_student_profile.sql, 03_college_institutional_intelligence.sql
-- Status: PENDING MANUAL EXECUTION

-- 1. Table: government_admin_scopes
CREATE TABLE IF NOT EXISTS public.government_admin_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_admin_institution UNIQUE (admin_profile_id, institution_id)
);

ALTER TABLE public.government_admin_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Government admins read own scopes" ON public.government_admin_scopes;
CREATE POLICY "Government admins read own scopes"
  ON public.government_admin_scopes
  FOR SELECT
  USING (
    admin_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins manage scopes" ON public.government_admin_scopes;
CREATE POLICY "Super admins manage scopes"
  ON public.government_admin_scopes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- 2. Function: Get Authorized Institutions for Government Admin / Super Admin (Caller Authorized)
CREATE OR REPLACE FUNCTION public.get_government_authorized_institutions(
  p_admin_id UUID
)
RETURNS TABLE (
  institution_id UUID,
  institution_name TEXT,
  institution_code TEXT,
  state TEXT
) AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role user_role;
  v_target_role user_role;
BEGIN
  -- Unbypassable RPC Caller Authorization Verification
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('government_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: caller is unauthorized for government aggregation.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_id != p_admin_id THEN
    RAISE EXCEPTION 'Access denied: cannot query scope of another administrator.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_admin_id;

  IF v_target_role = 'super_admin' THEN
    RETURN QUERY
    SELECT i.id, i.name, i.code, i.state
    FROM public.institutions i
    WHERE i.active = TRUE;
  ELSIF v_target_role = 'government_admin' THEN
    RETURN QUERY
    SELECT i.id, i.name, i.code, i.state
    FROM public.institutions i
    JOIN public.government_admin_scopes gas ON gas.institution_id = i.id
    WHERE gas.admin_profile_id = p_admin_id AND i.active = TRUE;
  ELSE
    RETURN QUERY
    SELECT i.id, i.name, i.code, i.state
    FROM public.institutions i
    WHERE 1 = 0;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Function: Government Scope Participation Metrics (Caller Authorized)
CREATE OR REPLACE FUNCTION public.get_government_participation_metrics(
  p_admin_id UUID,
  p_cycle_id UUID DEFAULT NULL
)
RETURNS TABLE (
  authorized_institutions_count BIGINT,
  active_reporting_institutions_count BIGINT,
  total_eligible_students BIGINT,
  participating_students BIGINT,
  participation_rate NUMERIC(5,2),
  active_cycle_name TEXT
) AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role user_role;
  v_cycle_id UUID;
  v_cycle_name TEXT;
  v_auth_inst_count BIGINT;
  v_reporting_inst_count BIGINT;
  v_eligible BIGINT;
  v_participating BIGINT;
BEGIN
  -- Unbypassable RPC Caller Authorization Verification
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('government_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: caller is unauthorized for government aggregation.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_id != p_admin_id THEN
    RAISE EXCEPTION 'Access denied: cannot query scope of another administrator.' USING ERRCODE = '42501';
  END IF;

  IF p_cycle_id IS NULL THEN
    SELECT id, name INTO v_cycle_id, v_cycle_name
    FROM public.assessment_cycles
    WHERE status = 'active'
    ORDER BY starts_at DESC LIMIT 1;
  ELSE
    SELECT id, name INTO v_cycle_id, v_cycle_name
    FROM public.assessment_cycles
    WHERE id = p_cycle_id;
  END IF;

  SELECT COUNT(*) INTO v_auth_inst_count
  FROM public.get_government_authorized_institutions(p_admin_id);

  SELECT COUNT(*) INTO v_eligible
  FROM public.profiles p
  JOIN public.get_government_authorized_institutions(p_admin_id) ai ON ai.institution_id = p.institution_id
  WHERE p.role = 'student' AND p.active = TRUE;

  SELECT 
    COUNT(DISTINCT a.student_id),
    COUNT(DISTINCT p.institution_id)
  INTO v_participating, v_reporting_inst_count
  FROM public.assessments a
  JOIN public.profiles p ON p.id = a.student_id
  JOIN public.get_government_authorized_institutions(p_admin_id) ai ON ai.institution_id = p.institution_id
  WHERE a.cycle_id = v_cycle_id AND a.status = 'completed';

  RETURN QUERY SELECT
    v_auth_inst_count,
    v_reporting_inst_count,
    v_eligible,
    v_participating,
    CASE WHEN v_eligible > 0 THEN ROUND((v_participating::NUMERIC / v_eligible::NUMERIC) * 100, 2) ELSE 0.00 END,
    COALESCE(v_cycle_name, 'No Active Cycle');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Function: Government Category Summary Across Authorized Scope (Privacy Threshold >= 10, Zero Info Leakage)
CREATE OR REPLACE FUNCTION public.get_government_category_summary(
  p_admin_id UUID,
  p_cycle_id UUID DEFAULT NULL
)
RETURNS TABLE (
  category wellness_category,
  average_score NUMERIC(3,1),
  dominant_band wellness_band,
  participating_student_count BIGINT,
  is_suppressed BOOLEAN
) AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role user_role;
  v_cycle_id UUID;
  v_total_participating BIGINT;
BEGIN
  -- Unbypassable RPC Caller Authorization Verification
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('government_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: caller is unauthorized for government aggregation.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_id != p_admin_id THEN
    RAISE EXCEPTION 'Access denied: cannot query scope of another administrator.' USING ERRCODE = '42501';
  END IF;

  IF p_cycle_id IS NULL THEN
    SELECT id INTO v_cycle_id FROM public.assessment_cycles WHERE status = 'active' ORDER BY starts_at DESC LIMIT 1;
  ELSE
    v_cycle_id := p_cycle_id;
  END IF;

  SELECT COUNT(DISTINCT a.student_id) INTO v_total_participating
  FROM public.assessments a
  JOIN public.profiles p ON p.id = a.student_id
  JOIN public.get_government_authorized_institutions(p_admin_id) ai ON ai.institution_id = p.institution_id
  WHERE a.cycle_id = v_cycle_id AND a.status = 'completed';

  IF v_total_participating < 10 THEN
    -- Return suppressed rows with NULL count to eliminate information leakage
    RETURN QUERY
    SELECT 
      c.cat::wellness_category,
      NULL::NUMERIC(3,1),
      NULL::wellness_band,
      NULL::BIGINT, -- Count set to NULL for strict anonymity
      TRUE
    FROM unnest(ENUM_RANGE(NULL::wellness_category)) AS c(cat);
  ELSE
    RETURN QUERY
    SELECT
      cs.category,
      ROUND(AVG(cs.score)::NUMERIC, 1) AS average_score,
      CASE 
        WHEN AVG(cs.score) >= 8.0 THEN 'stable'::wellness_band
        WHEN AVG(cs.score) >= 6.0 THEN 'watch'::wellness_band
        WHEN AVG(cs.score) >= 4.0 THEN 'needs_attention'::wellness_band
        ELSE 'elevated'::wellness_band
      END AS dominant_band,
      COUNT(DISTINCT a.student_id) AS participating_student_count,
      FALSE AS is_suppressed
    FROM public.assessment_category_scores cs
    JOIN public.assessments a ON a.id = cs.assessment_id
    JOIN public.profiles p ON p.id = a.student_id
    JOIN public.get_government_authorized_institutions(p_admin_id) ai ON ai.institution_id = p.institution_id
    WHERE a.cycle_id = v_cycle_id AND a.status = 'completed'
    GROUP BY cs.category;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Revoke Execution from PUBLIC and anon, Grant to authenticated
REVOKE EXECUTE ON FUNCTION public.get_government_authorized_institutions(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_government_participation_metrics(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_government_category_summary(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_government_authorized_institutions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_government_participation_metrics(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_government_category_summary(UUID, UUID) TO authenticated;

-- 6. Scope Assignment for Existing Demo Government Admin (96ee2b52-1628-4e7e-b247-6cf37032dc16)
INSERT INTO public.government_admin_scopes (admin_profile_id, institution_id)
VALUES
  ('96ee2b52-1628-4e7e-b247-6cf37032dc16', '11111111-1111-1111-1111-111111111111'),
  ('96ee2b52-1628-4e7e-b247-6cf37032dc16', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (admin_profile_id, institution_id) DO NOTHING;
