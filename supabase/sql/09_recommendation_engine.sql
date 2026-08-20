-- NSWEIS SQL MIGRATION
-- ID: 09
-- Feature: Recommendation Engine & Hardened Security Architecture
-- Purpose: Secure recommendation rules table (super_admin only), DB-level unique indexes, and SECURITY DEFINER recommendation generation RPC returning only boolean status.
-- Execution: Safe for repeated manual execution in Supabase SQL Editor
-- Dependencies: 00_initial_schema.sql, 07_student_first_mvp_schema.sql, 08_question_management.sql
-- Status: PENDING MANUAL EXECUTION

-- ============================================================
-- BLOCK 1: Recommendation Rules Configurable Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recommendation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category wellness_category NOT NULL,
  minimum_signal NUMERIC(3,1) NOT NULL DEFAULT 0.0,
  maximum_signal NUMERIC(3,1) NOT NULL DEFAULT 10.0,
  priority INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  task_title TEXT NOT NULL,
  task_description TEXT NOT NULL,
  estimated_minutes INT NOT NULL DEFAULT 15,
  credits_awarded INT NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_rules_cat ON public.recommendation_rules(category, active, priority);

-- ============================================================
-- BLOCK 2: Hardened Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.recommendation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recommendation rules read access" ON public.recommendation_rules;
DROP POLICY IF EXISTS "Super admins can manage recommendation rules" ON public.recommendation_rules;

-- ONLY Super Admins can query or manage recommendation_rules directly.
-- Ordinary students HAVE NO SELECT ACCESS to recommendation_rules.
CREATE POLICY "Super admins can manage recommendation rules" ON public.recommendation_rules
  FOR ALL TO authenticated USING (public.get_user_role() = 'super_admin');

-- Remove any old unsafe RPC if it exists
DROP FUNCTION IF EXISTS public.get_active_recommendation_rules();

-- ============================================================
-- BLOCK 3: Database Uniqueness Constraints
-- ============================================================
-- Prevent duplicate assessment recommendation links
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_recs_unique 
  ON public.assessment_recommendations(assessment_id, recommendation_id);

-- Prevent duplicate generated student tasks for the same assessment
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_tasks_assessment_title_unique 
  ON public.student_tasks (student_id, assessment_id, title) 
  WHERE assessment_id IS NOT NULL;

-- ============================================================
-- BLOCK 4: Secure SECURITY DEFINER Generation RPC (Returns Boolean Only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_assessment_recommendations(p_assessment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_student_id UUID;
  v_status assessment_status;
  v_rec_id UUID;
  v_cycle_end TIMESTAMPTZ;
  r RECORD;
BEGIN
  -- 1. Authentication check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Verify assessment ownership and status
  SELECT student_id, status INTO v_student_id, v_status
  FROM public.assessments
  WHERE id = p_assessment_id;

  IF v_student_id IS NULL OR v_student_id != auth.uid() THEN
    RAISE EXCEPTION 'Assessment not found or unauthorized';
  END IF;

  IF v_status != 'completed' THEN
    RAISE EXCEPTION 'Assessment is not completed';
  END IF;

  -- 3. Idempotency check: if tasks/recs already generated, return TRUE immediately
  IF EXISTS (SELECT 1 FROM public.assessment_recommendations WHERE assessment_id = p_assessment_id) THEN
    RETURN TRUE;
  END IF;

  -- Get cycle end date fallback
  SELECT c.ends_at INTO v_cycle_end
  FROM public.assessments a
  JOIN public.assessment_cycles c ON c.id = a.cycle_id
  WHERE a.id = p_assessment_id;

  IF v_cycle_end IS NULL THEN
    v_cycle_end := NOW() + INTERVAL '7 days';
  END IF;

  -- 4. Evaluate rules server-side and create max 3 recommendations/tasks
  FOR r IN (
    WITH category_signals AS (
      SELECT 
        q.category,
        ROUND(AVG(COALESCE(qo.signal_value, qo.score))::numeric, 1) AS avg_signal
      FROM public.assessment_responses ar
      JOIN public.questions q ON q.id = ar.question_id
      JOIN public.question_options qo ON qo.id = ar.selected_option_id
      WHERE ar.assessment_id = p_assessment_id
      GROUP BY q.category
    ),
    matching_rules AS (
      SELECT 
        rr.*,
        ROW_NUMBER() OVER (PARTITION BY rr.category ORDER BY rr.priority DESC) AS category_rank
      FROM public.recommendation_rules rr
      JOIN category_signals cs ON cs.category = rr.category
      WHERE rr.active = TRUE
        AND cs.avg_signal >= rr.minimum_signal
        AND cs.avg_signal <= rr.maximum_signal
    )
    SELECT *
    FROM matching_rules
    WHERE category_rank = 1
    ORDER BY priority DESC
    LIMIT 3
  ) LOOP
    -- Get or create recommendation entry
    SELECT id INTO v_rec_id
    FROM public.recommendations
    WHERE category = r.category AND title = r.title;

    IF v_rec_id IS NULL THEN
      INSERT INTO public.recommendations (category, title, description, priority, active)
      VALUES (r.category, r.title, r.description, r.priority, TRUE)
      RETURNING id INTO v_rec_id;
    END IF;

    -- Link recommendation to assessment
    INSERT INTO public.assessment_recommendations (assessment_id, recommendation_id)
    VALUES (p_assessment_id, v_rec_id)
    ON CONFLICT DO NOTHING;

    -- Insert generated task into student_tasks
    INSERT INTO public.student_tasks (
      student_id, assessment_id, category, title, description,
      estimated_minutes, task_type, due_date, status, credits_awarded, source_reason
    ) VALUES (
      v_student_id, p_assessment_id, r.category, r.task_title, r.task_description,
      r.estimated_minutes, 'action', v_cycle_end, 'pending', r.credits_awarded, 'recommendation_engine'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.generate_assessment_recommendations(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_assessment_recommendations(UUID) TO authenticated;

-- ============================================================
-- BLOCK 5: Seed Non-Clinical Default Recommendation Rules
-- ============================================================
INSERT INTO public.recommendation_rules (
  category, minimum_signal, maximum_signal, priority,
  title, description, task_title, task_description, estimated_minutes, credits_awarded
) VALUES
-- Academic Balance
('academic', 0.0, 6.0, 10,
 'Try one focused study block this week',
 'Breaking academic work into a single distraction-free focus block can make studying feel far more manageable.',
 'Complete one 25-minute distraction-free study session',
 'Set a timer for 25 minutes, put away notifications, and focus on one academic assignment.', 25, 10),

('academic', 0.0, 5.0, 8,
 'Break an upcoming task into a smaller first step',
 'Organizing a large project into smaller steps reduces friction when starting.',
 'Create a 3-step action plan for one upcoming task',
 'Write down the next three small steps needed to begin an upcoming coursework or project.', 15, 10),

-- Sleep & Rest
('sleep_rest', 0.0, 6.0, 10,
 'Try keeping a consistent wind-down period',
 'Giving yourself 20 minutes to transition away from screens before bed helps improve sleep quality.',
 'Complete one screen-free wind-down session before sleep',
 'Turn off screens 20 minutes before sleeping and engage in light reading or relaxation.', 20, 10),

-- Digital Balance
('digital_balance', 0.0, 6.0, 9,
 'Create one phone-free focus period this week',
 'Short breaks from digital notifications help clear mental fatigue and improve concentration.',
 'Complete one 25-minute phone-free focus activity',
 'Place your phone in another room or on Do Not Disturb while engaging in study or relaxation.', 25, 10),

-- Physical Activity
('physical_wellbeing', 0.0, 6.0, 7,
 'Add a short movement break to your day',
 'A quick walk or stretch helps recharge your energy and focus.',
 'Complete a 10-minute movement break',
 'Take a 10-minute walk or do a quick stretching routine during a study break.', 10, 10),

-- Social Connection
('social_connection', 0.0, 6.0, 8,
 'Make time for one positive social connection this week',
 'Connecting with friends, family, or classmates builds encouragement and mutual support.',
 'Reach out to someone you trust',
 'Spend 15 minutes chatting with a friend, classmate, or family member.', 15, 10),

-- Routine & Self-Management
('family_home', 0.0, 6.0, 6,
 'Organize your weekly routine space',
 'Tidying your workspace or preparing your schedule for the week creates clarity.',
 'Set up your weekly schedule & workspace',
 'Spend 15 minutes organizing your study area and reviewing key dates for the week.', 15, 10),

-- Career & Future Confidence
('career', 0.0, 6.0, 7,
 'Explore one practical step toward your future goals',
 'Reviewing career resources or skills step-by-step builds long-term confidence.',
 'Review one career or skill resource',
 'Spend 20 minutes exploring an internship listing, resume tip, or skill tutorial.', 20, 10)

ON CONFLICT DO NOTHING;
