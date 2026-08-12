-- NSWEIS SQL MIGRATION
-- ID: 01
-- Feature: Demo Application Seed Data (Idempotent)
-- Purpose: Populate initial institutions, departments, assessment cycles, questions, options, adaptive rules, and recommendations
-- Execution: Safe for repeated manual execution in Supabase SQL Editor
-- Dependencies: 00_initial_schema.sql
-- Status: PENDING MANUAL EXECUTION

-- 1. Seed Institutions
INSERT INTO public.institutions (id, name, code, district, state, institution_type) VALUES
  ('11111111-1111-1111-1111-111111111111', 'National Institute of Technology, Apex', 'NITA01', 'Central', 'State North', 'Engineering'),
  ('22222222-2222-2222-2222-222222222222', 'Metropolitan College of Science & Arts', 'MCSA02', 'Metropolitan', 'State South', 'University')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  district = EXCLUDED.district,
  state = EXCLUDED.state,
  institution_type = EXCLUDED.institution_type;

-- 2. Seed Departments
INSERT INTO public.departments (id, institution_id, name, code) VALUES
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Computer Science & Engineering', 'CSE'),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Electronics & Communication', 'ECE'),
  ('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Humanities & Social Sciences', 'HSS')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  institution_id = EXCLUDED.institution_id;

-- 3. Seed Active Assessment Cycle
INSERT INTO public.assessment_cycles (id, name, week_number, starts_at, ends_at, status) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Fall Semester - Week 4 Check-in', 4, NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days', 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  week_number = EXCLUDED.week_number,
  status = EXCLUDED.status;

-- 4. Seed Questions (Base & Adaptive Follow-up)
INSERT INTO public.questions (id, text, category, question_type, weight, order_index, is_base_question) VALUES
  ('10000000-0000-0000-0000-000000000001', 'How manageable have your coursework and study demands felt this week?', 'academic', 'single_choice', 1.0, 1, true),
  ('10000000-0000-0000-0000-000000000002', 'How consistent and restful has your sleep been over the past 7 days?', 'sleep_rest', 'single_choice', 1.0, 2, true),
  ('10000000-0000-0000-0000-000000000003', 'How connected do you feel with peers, friends, or campus activities?', 'social_connection', 'single_choice', 1.0, 3, true),
  ('10000000-0000-0000-0000-000000000004', 'How balanced and steady has your overall emotional state felt this week?', 'emotional_wellbeing', 'single_choice', 1.0, 4, true),
  ('10000000-0000-0000-0000-000000000005', 'Which specific factor contributed most to your academic workload pressure?', 'academic', 'single_choice', 1.0, 5, false),
  ('10000000-0000-0000-0000-000000000006', 'What primary challenge impacted your sleep routine consistency?', 'sleep_rest', 'single_choice', 1.0, 6, false)
ON CONFLICT (id) DO UPDATE SET
  text = EXCLUDED.text,
  category = EXCLUDED.category,
  weight = EXCLUDED.weight,
  order_index = EXCLUDED.order_index,
  is_base_question = EXCLUDED.is_base_question;

-- 5. Seed Question Options
INSERT INTO public.question_options (id, question_id, label, score, order_index) VALUES
  -- Q1 Options
  ('01000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Very manageable and clear', 10.0, 1),
  ('01000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Mostly manageable with light pressure', 7.5, 2),
  ('01000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Challenging with occasional overload', 5.0, 3),
  ('01000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Extremely overwhelming', 2.5, 4),

  -- Q2 Options
  ('02000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Deep, restful sleep (7+ hours daily)', 10.0, 1),
  ('02000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Fairly regular sleep', 7.5, 2),
  ('02000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Irregular sleep and frequent tiredness', 5.0, 3),
  ('02000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Severe sleep deficiency or disruption', 2.5, 4),

  -- Q3 Options
  ('03000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'Highly connected and engaged', 10.0, 1),
  ('03000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'Moderately connected', 7.5, 2),
  ('03000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Somewhat isolated', 5.0, 3),
  ('03000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 'Very disconnected from campus life', 2.5, 4),

  -- Q4 Options
  ('04000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'Steady and positive', 10.0, 1),
  ('04000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'Generally balanced', 7.5, 2),
  ('04000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', 'Noticeable strain or stress', 5.0, 3),
  ('04000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'Significant emotional strain', 2.5, 4),

  -- Q5 Follow-up Options
  ('05000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'Upcoming exam & assessment deadlines', 5.0, 1),
  ('05000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'Volume of reading and lab assignments', 5.0, 2),
  ('05000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000005', 'Difficulty managing study schedule', 4.0, 3),

  -- Q6 Follow-up Options
  ('06000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'Late-night study or exam preparation', 5.0, 1),
  ('06000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006', 'Screen time / social media prior to bed', 5.0, 2),
  ('06000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000006', 'Irregular daily routine & meal times', 4.0, 3)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  score = EXCLUDED.score,
  order_index = EXCLUDED.order_index;

-- 6. Seed Adaptive Rules
INSERT INTO public.question_rules (id, trigger_question_id, operator, threshold, target_category, follow_up_question_id, priority) VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'less_than_or_equal', 5.0, 'academic', '10000000-0000-0000-0000-000000000005', 1),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'less_than_or_equal', 5.0, 'sleep_rest', '10000000-0000-0000-0000-000000000006', 1)
ON CONFLICT (id) DO UPDATE SET
  operator = EXCLUDED.operator,
  threshold = EXCLUDED.threshold,
  target_category = EXCLUDED.target_category,
  priority = EXCLUDED.priority;

-- 7. Seed Recommendations
INSERT INTO public.recommendations (id, category, title, description, priority) VALUES
  ('e1111111-1111-1111-1111-111111111111', 'academic', 'Study Micro-chunking', 'Break assignment milestones into 25-minute focused blocks with scheduled 5-minute recovery breaks.', 1),
  ('e2222222-2222-2222-2222-222222222222', 'sleep_rest', 'Digital Wind-Down Routine', 'Disconnect electronic screens 45 minutes prior to sleep to improve natural sleep cycle recovery.', 1),
  ('e3333333-3333-3333-3333-333333333333', 'social_connection', 'Peer Community Support', 'Participate in campus peer study groups or student welfare society gatherings.', 1),
  ('e4444444-4444-4444-4444-444444444444', 'emotional_wellbeing', 'Mindful Reflection Breaks', 'Take 5 minutes daily for quiet, unstructured self-reflection to recharge mental focus.', 1)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority;
