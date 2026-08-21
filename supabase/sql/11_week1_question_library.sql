-- NSWEIS SQL MIGRATION
-- ID: 11
-- Feature: Week 1 Question Architecture Seed
-- Purpose: Seed Week 1 Active Cycle (7 common + 3 adaptive baseline questions) and options into the master question library.
-- Execution: Safe for repeated manual execution in Supabase SQL Editor
-- Dependencies: 00_initial_schema.sql through 10_adaptive_weekly_architecture.sql
-- Status: PENDING MANUAL EXECUTION

DO $$
DECLARE
  v_cycle_id UUID;
  v_q1_id UUID;
  v_q2_id UUID;
  v_q3_id UUID;
  v_q4_id UUID;
  v_q5_id UUID;
  v_q6_id UUID;
  v_q7_id UUID;
  v_q8_id UUID;
  v_q9_id UUID;
  v_q10_id UUID;
BEGIN
  -- ============================================================
  -- BLOCK 1: Create or Activate Week 1 Weekly Cycle
  -- ============================================================
  SELECT id INTO v_cycle_id FROM public.weekly_cycles WHERE week_number = 1 LIMIT 1;

  IF v_cycle_id IS NULL THEN
    INSERT INTO public.weekly_cycles (
      week_number,
      name,
      description,
      starts_at,
      ends_at,
      status,
      total_questions,
      common_questions,
      adaptive_questions,
      session_duration_minutes,
      reflection_required,
      adaptive_questions_enabled
    ) VALUES (
      1,
      'Week 1 Reflection',
      'Baseline well-being reflection and adaptive priority assessment.',
      NOW(),
      NOW() + INTERVAL '7 days',
      'active',
      10,
      7,
      3,
      10,
      TRUE,
      TRUE
    ) RETURNING id INTO v_cycle_id;
  ELSE
    UPDATE public.weekly_cycles
    SET status = 'active',
        total_questions = 10,
        common_questions = 7,
        adaptive_questions = 3,
        session_duration_minutes = 10,
        reflection_required = TRUE
    WHERE id = v_cycle_id;
  END IF;

  -- ============================================================
  -- BLOCK 2: Seed Questions (W01-Q01 to W01-Q10)
  -- ============================================================

  -- 1. W01-Q01 (Daily Energy & Functioning)
  INSERT INTO public.questions (
    question_code, text, category, question_type, weight, active, order_index,
    is_base_question, week_number, target_department, reusable, cooldown_weeks, adaptive_enabled
  ) VALUES (
    'W01-Q01',
    'How has your energy been during most of your day this week?',
    'physical_wellbeing', 'single_choice', 1.0, TRUE, 1,
    TRUE, 1, 'ALL', TRUE, 0, TRUE
  ) ON CONFLICT (question_code) DO UPDATE
    SET text = EXCLUDED.text, category = EXCLUDED.category
  RETURNING id INTO v_q1_id;

  DELETE FROM public.question_options WHERE question_id = v_q1_id;
  INSERT INTO public.question_options (question_id, label, score, order_index, option_code, signal_value, follow_up_group) VALUES
    (v_q1_id, 'I usually had plenty of energy', 10.0, 1, 'A', 10.0, 'energy_support'),
    (v_q1_id, 'I generally had enough energy', 8.0, 2, 'B', 8.0, 'energy_support'),
    (v_q1_id, 'My energy was up and down', 6.0, 3, 'C', 6.0, 'energy_support'),
    (v_q1_id, 'I often felt low on energy', 4.0, 4, 'D', 4.0, 'energy_support'),
    (v_q1_id, 'I struggled to get through many parts of the day', 2.0, 5, 'E', 2.0, 'energy_support');

  -- 2. W01-Q02 (Sleep & Rest)
  INSERT INTO public.questions (
    question_code, text, category, question_type, weight, active, order_index,
    is_base_question, week_number, target_department, reusable, cooldown_weeks, adaptive_enabled
  ) VALUES (
    'W01-Q02',
    'How well has your sleep routine supported you this week?',
    'sleep_rest', 'single_choice', 1.0, TRUE, 2,
    TRUE, 1, 'ALL', TRUE, 0, TRUE
  ) ON CONFLICT (question_code) DO UPDATE
    SET text = EXCLUDED.text, category = EXCLUDED.category
  RETURNING id INTO v_q2_id;

  DELETE FROM public.question_options WHERE question_id = v_q2_id;
  INSERT INTO public.question_options (question_id, label, score, order_index, option_code, signal_value, follow_up_group) VALUES
    (v_q2_id, 'It supported me very well', 10.0, 1, 'A', 10.0, 'sleep_support'),
    (v_q2_id, 'It was mostly good', 8.0, 2, 'B', 8.0, 'sleep_support'),
    (v_q2_id, 'It was inconsistent', 6.0, 3, 'C', 6.0, 'sleep_support'),
    (v_q2_id, 'It often made my days harder', 4.0, 4, 'D', 4.0, 'sleep_support'),
    (v_q2_id, 'I struggled to get enough or restful sleep', 2.0, 5, 'E', 2.0, 'sleep_support');

  -- 3. W01-Q03 (Academic Routine)
  INSERT INTO public.questions (
    question_code, text, category, question_type, weight, active, order_index,
    is_base_question, week_number, target_department, reusable, cooldown_weeks, adaptive_enabled
  ) VALUES (
    'W01-Q03',
    'How manageable did your study routine feel this week?',
    'academic', 'single_choice', 1.0, TRUE, 3,
    TRUE, 1, 'ALL', TRUE, 0, TRUE
  ) ON CONFLICT (question_code) DO UPDATE
    SET text = EXCLUDED.text, category = EXCLUDED.category
  RETURNING id INTO v_q3_id;

  DELETE FROM public.question_options WHERE question_id = v_q3_id;
  INSERT INTO public.question_options (question_id, label, score, order_index, option_code, signal_value, follow_up_group) VALUES
    (v_q3_id, 'Very manageable', 10.0, 1, 'A', 10.0, 'academic_routine'),
    (v_q3_id, 'Mostly manageable', 8.0, 2, 'B', 8.0, 'academic_routine'),
    (v_q3_id, 'Somewhat difficult', 6.0, 3, 'C', 6.0, 'academic_routine'),
    (v_q3_id, 'Difficult', 4.0, 4, 'D', 4.0, 'academic_routine'),
    (v_q3_id, 'I wasn''t able to maintain a routine', 2.0, 5, 'E', 2.0, 'academic_routine');

  -- 4. W01-Q04 (Focus & Digital Balance)
  INSERT INTO public.questions (
    question_code, text, category, question_type, weight, active, order_index,
    is_base_question, week_number, target_department, reusable, cooldown_weeks, adaptive_enabled
  ) VALUES (
    'W01-Q04',
    'When you wanted to focus on something important, how easy was it to stay away from distractions?',
    'digital_balance', 'single_choice', 1.0, TRUE, 4,
    TRUE, 1, 'ALL', TRUE, 0, TRUE
  ) ON CONFLICT (question_code) DO UPDATE
    SET text = EXCLUDED.text, category = EXCLUDED.category
  RETURNING id INTO v_q4_id;

  DELETE FROM public.question_options WHERE question_id = v_q4_id;
  INSERT INTO public.question_options (question_id, label, score, order_index, option_code, signal_value, follow_up_group) VALUES
    (v_q4_id, 'Very easy', 10.0, 1, 'A', 10.0, 'focus_support'),
    (v_q4_id, 'Mostly easy', 8.0, 2, 'B', 8.0, 'focus_support'),
    (v_q4_id, 'It depended on the situation', 6.0, 3, 'C', 6.0, 'focus_support'),
    (v_q4_id, 'Often difficult', 4.0, 4, 'D', 4.0, 'focus_support'),
    (v_q4_id, 'Very difficult', 2.0, 5, 'E', 2.0, 'focus_support');

  -- 5. W01-Q05 (Physical Activity)
  INSERT INTO public.questions (
    question_code, text, category, question_type, weight, active, order_index,
    is_base_question, week_number, target_department, reusable, cooldown_weeks, adaptive_enabled
  ) VALUES (
    'W01-Q05',
    'How often did you make time for some physical movement this week?',
    'physical_wellbeing', 'single_choice', 1.0, TRUE, 5,
    TRUE, 1, 'ALL', TRUE, 0, TRUE
  ) ON CONFLICT (question_code) DO UPDATE
    SET text = EXCLUDED.text, category = EXCLUDED.category
  RETURNING id INTO v_q5_id;

  DELETE FROM public.question_options WHERE question_id = v_q5_id;
  INSERT INTO public.question_options (question_id, label, score, order_index, option_code, signal_value, follow_up_group) VALUES
    (v_q5_id, 'Almost every day', 10.0, 1, 'A', 10.0, 'movement_support'),
    (v_q5_id, 'Several days', 8.0, 2, 'B', 8.0, 'movement_support'),
    (v_q5_id, 'A few days', 6.0, 3, 'C', 6.0, 'movement_support'),
    (v_q5_id, 'Once', 4.0, 4, 'D', 4.0, 'movement_support'),
    (v_q5_id, 'I didn''t really make time for it', 2.0, 5, 'E', 2.0, 'movement_support');

  -- 6. W01-Q06 (Social Connection)
  INSERT INTO public.questions (
    question_code, text, category, question_type, weight, active, order_index,
    is_base_question, week_number, target_department, reusable, cooldown_weeks, adaptive_enabled
  ) VALUES (
    'W01-Q06',
    'How connected did you feel with people you could comfortably spend time or talk with this week?',
    'social_connection', 'single_choice', 1.0, TRUE, 6,
    TRUE, 1, 'ALL', TRUE, 0, TRUE
  ) ON CONFLICT (question_code) DO UPDATE
    SET text = EXCLUDED.text, category = EXCLUDED.category
  RETURNING id INTO v_q6_id;

  DELETE FROM public.question_options WHERE question_id = v_q6_id;
  INSERT INTO public.question_options (question_id, label, score, order_index, option_code, signal_value, follow_up_group) VALUES
    (v_q6_id, 'Very connected', 10.0, 1, 'A', 10.0, 'connection_support'),
    (v_q6_id, 'Mostly connected', 8.0, 2, 'B', 8.0, 'connection_support'),
    (v_q6_id, 'It varied', 6.0, 3, 'C', 6.0, 'connection_support'),
    (v_q6_id, 'Less connected than I would like', 4.0, 4, 'D', 4.0, 'connection_support'),
    (v_q6_id, 'I felt quite disconnected', 2.0, 5, 'E', 2.0, 'connection_support');

  -- 7. W01-Q07 (Personal Balance)
  INSERT INTO public.questions (
    question_code, text, category, question_type, weight, active, order_index,
    is_base_question, week_number, target_department, reusable, cooldown_weeks, adaptive_enabled
  ) VALUES (
    'W01-Q07',
    'How well did you feel you were able to handle the different parts of your week?',
    'emotional_wellbeing', 'single_choice', 1.0, TRUE, 7,
    TRUE, 1, 'ALL', TRUE, 0, TRUE
  ) ON CONFLICT (question_code) DO UPDATE
    SET text = EXCLUDED.text, category = EXCLUDED.category
  RETURNING id INTO v_q7_id;

  DELETE FROM public.question_options WHERE question_id = v_q7_id;
  INSERT INTO public.question_options (question_id, label, score, order_index, option_code, signal_value, follow_up_group) VALUES
    (v_q7_id, 'I handled them comfortably', 10.0, 1, 'A', 10.0, 'balance_support'),
    (v_q7_id, 'I managed most things well', 8.0, 2, 'B', 8.0, 'balance_support'),
    (v_q7_id, 'Some parts were difficult', 6.0, 3, 'C', 6.0, 'balance_support'),
    (v_q7_id, 'Several things felt hard to manage', 4.0, 4, 'D', 4.0, 'balance_support'),
    (v_q7_id, 'I often felt overwhelmed by what I had to handle', 2.0, 5, 'E', 2.0, 'balance_support');

  -- 8. W01-Q08 (Adaptive Baseline — Academic/Future)
  INSERT INTO public.questions (
    question_code, text, category, question_type, weight, active, order_index,
    is_base_question, week_number, target_department, reusable, cooldown_weeks, adaptive_enabled
  ) VALUES (
    'W01-Q08',
    'Which part of your studies or future plans would you most like to make easier right now?',
    'career', 'single_choice', 1.0, TRUE, 8,
    FALSE, 1, 'ALL', TRUE, 0, TRUE
  ) ON CONFLICT (question_code) DO UPDATE
    SET text = EXCLUDED.text, category = EXCLUDED.category
  RETURNING id INTO v_q8_id;

  DELETE FROM public.question_options WHERE question_id = v_q8_id;
  INSERT INTO public.question_options (question_id, label, score, order_index, option_code, signal_value, follow_up_group) VALUES
    (v_q8_id, 'Staying consistent', 10.0, 1, 'A', 10.0, 'academic_future'),
    (v_q8_id, 'Managing my time', 8.0, 2, 'B', 8.0, 'academic_future'),
    (v_q8_id, 'Staying focused', 6.0, 3, 'C', 6.0, 'academic_future'),
    (v_q8_id, 'Understanding what I should work toward', 4.0, 4, 'D', 4.0, 'academic_future'),
    (v_q8_id, 'I feel reasonably comfortable with this right now', 2.0, 5, 'E', 2.0, 'academic_future');

  -- 9. W01-Q09 (Adaptive Baseline — Personal Routine)
  INSERT INTO public.questions (
    question_code, text, category, question_type, weight, active, order_index,
    is_base_question, week_number, target_department, reusable, cooldown_weeks, adaptive_enabled
  ) VALUES (
    'W01-Q09',
    'Which part of your daily routine would you most like to improve?',
    'family_home', 'single_choice', 1.0, TRUE, 9,
    FALSE, 1, 'ALL', TRUE, 0, TRUE
  ) ON CONFLICT (question_code) DO UPDATE
    SET text = EXCLUDED.text, category = EXCLUDED.category
  RETURNING id INTO v_q9_id;

  DELETE FROM public.question_options WHERE question_id = v_q9_id;
  INSERT INTO public.question_options (question_id, label, score, order_index, option_code, signal_value, follow_up_group) VALUES
    (v_q9_id, 'Sleep and rest', 10.0, 1, 'A', 10.0, 'routine_support'),
    (v_q9_id, 'Study routine', 8.0, 2, 'B', 8.0, 'routine_support'),
    (v_q9_id, 'Physical activity', 6.0, 3, 'C', 6.0, 'routine_support'),
    (v_q9_id, 'Time away from screens', 4.0, 4, 'D', 4.0, 'routine_support'),
    (v_q9_id, 'Keeping a balanced daily routine', 2.0, 5, 'E', 2.0, 'routine_support');

  -- 10. W01-Q10 (Adaptive Baseline — Student-Defined Priority)
  INSERT INTO public.questions (
    question_code, text, category, question_type, weight, active, order_index,
    is_base_question, week_number, target_department, reusable, cooldown_weeks, adaptive_enabled
  ) VALUES (
    'W01-Q10',
    'If you could make one small change to your week, what would you choose?',
    'emotional_wellbeing', 'single_choice', 1.0, TRUE, 10,
    FALSE, 1, 'ALL', TRUE, 0, TRUE
  ) ON CONFLICT (question_code) DO UPDATE
    SET text = EXCLUDED.text, category = EXCLUDED.category
  RETURNING id INTO v_q10_id;

  DELETE FROM public.question_options WHERE question_id = v_q10_id;
  INSERT INTO public.question_options (question_id, label, score, order_index, option_code, signal_value, follow_up_group) VALUES
    (v_q10_id, 'Have a more consistent routine', 10.0, 1, 'A', 10.0, 'personal_priority'),
    (v_q10_id, 'Get better rest', 8.0, 2, 'B', 8.0, 'personal_priority'),
    (v_q10_id, 'Spend more time on things that matter to me', 6.0, 3, 'C', 6.0, 'personal_priority'),
    (v_q10_id, 'Make more time for people or activities I enjoy', 4.0, 4, 'D', 4.0, 'personal_priority'),
    (v_q10_id, 'Reduce distractions and feel more organized', 2.0, 5, 'E', 2.0, 'personal_priority');

END $$;
