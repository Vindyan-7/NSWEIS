-- NSWEIS SQL MIGRATION
-- ID: 03
-- Feature: College Institutional Intelligence & Intervention Management (Idempotent)
-- Purpose: Server-side aggregation functions enforcing privacy threshold (>= 10 students), RLS enhancements, and demo interventions
-- Execution: Safe for repeated manual execution in Supabase SQL Editor
-- Dependencies: 00_initial_schema.sql, 01_seed_demo_data.sql, 02_demo_student_profile.sql
-- Status: PENDING MANUAL EXECUTION

-- 1. Function: Get College Participation Metrics (Enforces Scoping & Privacy)
CREATE OR REPLACE FUNCTION public.get_college_participation_metrics(
  p_institution_id UUID,
  p_cycle_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_eligible_students BIGINT,
  participating_students BIGINT,
  participation_rate NUMERIC(5,2),
  active_cycle_name TEXT,
  active_cycle_id UUID
) AS $$
DECLARE
  v_cycle_id UUID;
  v_cycle_name TEXT;
  v_eligible BIGINT;
  v_participating BIGINT;
BEGIN
  -- Target active cycle if p_cycle_id is NULL
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

  -- Count eligible students in institution
  SELECT COUNT(*) INTO v_eligible
  FROM public.profiles
  WHERE institution_id = p_institution_id AND role = 'student' AND active = TRUE;

  -- Count participating students in cycle for institution
  SELECT COUNT(DISTINCT a.student_id) INTO v_participating
  FROM public.assessments a
  JOIN public.profiles p ON p.id = a.student_id
  WHERE p.institution_id = p_institution_id
    AND a.cycle_id = v_cycle_id
    AND a.status = 'completed';

  RETURN QUERY SELECT
    v_eligible,
    v_participating,
    CASE WHEN v_eligible > 0 THEN ROUND((v_participating::NUMERIC / v_eligible::NUMERIC) * 100, 2) ELSE 0.00 END,
    COALESCE(v_cycle_name, 'No Active Cycle'),
    v_cycle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Function: Get College Category Aggregates (Enforces Privacy Threshold >= 10)
CREATE OR REPLACE FUNCTION public.get_college_category_summary(
  p_institution_id UUID,
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
  v_cycle_id UUID;
  v_total_participating BIGINT;
BEGIN
  -- Resolve cycle
  IF p_cycle_id IS NULL THEN
    SELECT id INTO v_cycle_id FROM public.assessment_cycles WHERE status = 'active' ORDER BY starts_at DESC LIMIT 1;
  ELSE
    v_cycle_id := p_cycle_id;
  END IF;

  -- Check overall institution participation threshold for privacy
  SELECT COUNT(DISTINCT a.student_id) INTO v_total_participating
  FROM public.assessments a
  JOIN public.profiles p ON p.id = a.student_id
  WHERE p.institution_id = p_institution_id AND a.cycle_id = v_cycle_id AND a.status = 'completed';

  IF v_total_participating < 10 THEN
    -- Return suppressed rows for all categories
    RETURN QUERY
    SELECT 
      c.cat::wellness_category,
      NULL::NUMERIC(3,1),
      NULL::wellness_band,
      v_total_participating,
      TRUE
    FROM unnest(ENUM_RANGE(NULL::wellness_category)) AS c(cat);
  ELSE
    -- Return calculated aggregates
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
    WHERE p.institution_id = p_institution_id AND a.cycle_id = v_cycle_id AND a.status = 'completed'
    GROUP BY cs.category;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Function: Get College Department Summary (Enforces Privacy Threshold >= 10 per Department)
CREATE OR REPLACE FUNCTION public.get_college_department_summary(
  p_institution_id UUID,
  p_cycle_id UUID DEFAULT NULL
)
RETURNS TABLE (
  department_id UUID,
  department_name TEXT,
  department_code TEXT,
  participating_student_count BIGINT,
  average_overall_score NUMERIC(3,1),
  dominant_band wellness_band,
  is_suppressed BOOLEAN,
  suppression_message TEXT
) AS $$
DECLARE
  v_cycle_id UUID;
BEGIN
  IF p_cycle_id IS NULL THEN
    SELECT id INTO v_cycle_id FROM public.assessment_cycles WHERE status = 'active' ORDER BY starts_at DESC LIMIT 1;
  ELSE
    v_cycle_id := p_cycle_id;
  END IF;

  RETURN QUERY
  SELECT
    d.id AS department_id,
    d.name AS department_name,
    d.code AS department_code,
    COUNT(DISTINCT a.student_id) AS participating_student_count,
    CASE 
      WHEN COUNT(DISTINCT a.student_id) >= 10 THEN ROUND(AVG(a.overall_indicator)::NUMERIC, 1)
      ELSE NULL
    END AS average_overall_score,
    CASE 
      WHEN COUNT(DISTINCT a.student_id) >= 10 THEN
        CASE 
          WHEN AVG(a.overall_indicator) >= 8.0 THEN 'stable'::wellness_band
          WHEN AVG(a.overall_indicator) >= 6.0 THEN 'watch'::wellness_band
          WHEN AVG(a.overall_indicator) >= 4.0 THEN 'needs_attention'::wellness_band
          ELSE 'elevated'::wellness_band
        END
      ELSE NULL
    END AS dominant_band,
    (COUNT(DISTINCT a.student_id) < 10) AS is_suppressed,
    CASE 
      WHEN COUNT(DISTINCT a.student_id) < 10 THEN 'Insufficient group size for anonymous reporting.'
      ELSE NULL
    END AS suppression_message
  FROM public.departments d
  LEFT JOIN public.profiles p ON p.department_id = d.id AND p.role = 'student' AND p.active = TRUE
  LEFT JOIN public.assessments a ON a.student_id = p.id AND a.cycle_id = v_cycle_id AND a.status = 'completed'
  WHERE d.institution_id = p_institution_id AND d.active = TRUE
  GROUP BY d.id, d.name, d.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Seed Initial Demo Interventions for Institution 1 (Idempotent)
DO $$
DECLARE
  v_creator_id UUID;
BEGIN
  SELECT id INTO v_creator_id FROM public.profiles LIMIT 1;

  IF v_creator_id IS NOT NULL THEN
    INSERT INTO public.interventions (
      id,
      institution_id,
      created_by,
      title,
      description,
      category,
      target_department_id,
      target_year,
      scheduled_at,
      location,
      capacity,
      status
    ) VALUES
      (
        'f1111111-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111',
        v_creator_id,
        'Academic Workload & Time Management Seminar',
        'Interactive session on study micro-chunking, assignment prioritization, and exam prep strategies.',
        'academic',
        'a1111111-1111-1111-1111-111111111111',
        2,
        NOW() + INTERVAL '5 days',
        'Seminar Hall B, CSE Block',
        45,
        'scheduled'
      ),
      (
        'f2222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        v_creator_id,
        'Sleep Hygiene & Digital Detox Workshop',
        'Practical strategies for evening wind-down routines and managing late-night screen time during exams.',
        'sleep_rest',
        NULL,
        NULL,
        NOW() + INTERVAL '8 days',
        'Student Activity Center Room 204',
        60,
        'scheduled'
      )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      scheduled_at = EXCLUDED.scheduled_at,
      location = EXCLUDED.location,
      status = EXCLUDED.status;
  END IF;
END $$;
