-- NSWEIS Seed Data for Local & Staging Environment

-- 1. Seed Institutions
INSERT INTO public.institutions (id, name, code, district, state, institution_type) VALUES
  ('11111111-1111-1111-1111-111111111111', 'National Institute of Technology, Apex', 'NITA01', 'Central', 'State North', 'Engineering'),
  ('22222222-2222-2222-2222-222222222222', 'Metropolitan College of Science & Arts', 'MCSA02', 'Metropolitan', 'State South', 'University')
ON CONFLICT (code) DO NOTHING;

-- 2. Seed Departments
INSERT INTO public.departments (id, institution_id, name, code) VALUES
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Computer Science & Engineering', 'CSE'),
  ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Electronics & Communication', 'ECE'),
  ('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Humanities & Social Sciences', 'HSS')
ON CONFLICT DO NOTHING;

-- 3. Seed Active Assessment Cycle
INSERT INTO public.assessment_cycles (id, name, week_number, starts_at, ends_at, status) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Fall Semester - Week 4 Check-in', 4, NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days', 'active')
ON CONFLICT DO NOTHING;

-- 4. Seed Questions (Base & Adaptive Follow-up)
INSERT INTO public.questions (id, text, category, question_type, weight, order_index, is_base_question) VALUES
  ('q1111111-1111-1111-1111-111111111111', 'How manageable have your coursework and study demands felt this week?', 'academic', 'single_choice', 1.0, 1, true),
  ('q2222222-2222-2222-2222-222222222222', 'How consistent and restful has your sleep been over the past 7 days?', 'sleep_rest', 'single_choice', 1.0, 2, true),
  ('q3333333-3333-3333-3333-333333333333', 'How connected do you feel with peers, friends, or campus activities?', 'social_connection', 'single_choice', 1.0, 3, true),
  ('q4444444-4444-4444-4444-444444444444', 'How balanced and steady has your overall emotional state felt this week?', 'emotional_wellbeing', 'single_choice', 1.0, 4, true),
  ('q5555555-5555-5555-5555-555555555555', 'Which specific factor contributed most to your academic workload pressure?', 'academic', 'single_choice', 1.0, 5, false),
  ('q6666666-6666-6666-6666-666666666666', 'What primary challenge impacted your sleep routine consistency?', 'sleep_rest', 'single_choice', 1.0, 6, false)
ON CONFLICT DO NOTHING;

-- 5. Seed Question Options
INSERT INTO public.question_options (id, question_id, label, score, order_index) VALUES
  -- Q1 Options
  ('opt-q1-1', 'q1111111-1111-1111-1111-111111111111', 'Very manageable and clear', 10.0, 1),
  ('opt-q1-2', 'q1111111-1111-1111-1111-111111111111', 'Mostly manageable with light pressure', 7.5, 2),
  ('opt-q1-3', 'q1111111-1111-1111-1111-111111111111', 'Challenging with occasional overload', 5.0, 3),
  ('opt-q1-4', 'q1111111-1111-1111-1111-111111111111', 'Extremely overwhelming', 2.5, 4),

  -- Q2 Options
  ('opt-q2-1', 'q2222222-2222-2222-2222-222222222222', 'Deep, restful sleep (7+ hours daily)', 10.0, 1),
  ('opt-q2-2', 'q2222222-2222-2222-2222-222222222222', 'Fairly regular sleep', 7.5, 2),
  ('opt-q2-3', 'q2222222-2222-2222-2222-222222222222', 'Irregular sleep and frequent tiredness', 5.0, 3),
  ('opt-q2-4', 'q2222222-2222-2222-2222-222222222222', 'Severe sleep deficiency or disruption', 2.5, 4),

  -- Q3 Options
  ('opt-q3-1', 'q3333333-3333-3333-3333-333333333333', 'Highly connected and engaged', 10.0, 1),
  ('opt-q3-2', 'q3333333-3333-3333-3333-333333333333', 'Moderately connected', 7.5, 2),
  ('opt-q3-3', 'q3333333-3333-3333-3333-333333333333', 'Somewhat isolated', 5.0, 3),
  ('opt-q3-4', 'q3333333-3333-3333-3333-333333333333', 'Very disconnected from campus life', 2.5, 4),

  -- Q4 Options
  ('opt-q4-1', 'q4444444-4444-4444-4444-444444444444', 'Steady and positive', 10.0, 1),
  ('opt-q4-2', 'q4444444-4444-4444-4444-444444444444', 'Generally balanced', 7.5, 2),
  ('opt-q4-3', 'q4444444-4444-4444-4444-444444444444', 'Noticeable strain or stress', 5.0, 3),
  ('opt-q4-4', 'q4444444-4444-4444-4444-444444444444', 'Significant emotional strain', 2.5, 4),

  -- Q5 Follow-up Options
  ('opt-q5-1', 'q5555555-5555-5555-5555-555555555555', 'Upcoming exam & assessment deadlines', 5.0, 1),
  ('opt-q5-2', 'q5555555-5555-5555-5555-555555555555', 'Volume of reading and lab assignments', 5.0, 2),
  ('opt-q5-3', 'q5555555-5555-5555-5555-555555555555', 'Difficulty managing study schedule', 4.0, 3),

  -- Q6 Follow-up Options
  ('opt-q6-1', 'q6666666-6666-6666-6666-666666666666', 'Late-night study or exam preparation', 5.0, 1),
  ('opt-q6-2', 'q6666666-6666-6666-6666-666666666666', 'Screen time / social media prior to bed', 5.0, 2),
  ('opt-q6-3', 'q6666666-6666-6666-6666-666666666666', 'Irregular daily routine & meal times', 4.0, 3)
ON CONFLICT DO NOTHING;

-- 6. Seed Adaptive Rules
INSERT INTO public.question_rules (id, trigger_question_id, operator, threshold, target_category, follow_up_question_id, priority) VALUES
  ('rule-1', 'q1111111-1111-1111-1111-111111111111', 'less_than_or_equal', 5.0, 'academic', 'q5555555-5555-5555-5555-555555555555', 1),
  ('rule-2', 'q2222222-2222-2222-2222-222222222222', 'less_than_or_equal', 5.0, 'sleep_rest', 'q6666666-6666-6666-6666-666666666666', 1)
ON CONFLICT DO NOTHING;

-- 7. Seed Recommendations
INSERT INTO public.recommendations (id, category, title, description, priority) VALUES
  ('r1111111-1111-1111-1111-111111111111', 'academic', 'Study Micro-chunking', 'Break assignment milestones into 25-minute focused blocks with scheduled 5-minute recovery breaks.', 1),
  ('r2222222-2222-2222-2222-222222222222', 'sleep_rest', 'Digital Wind-Down Routine', 'Disconnect electronic screens 45 minutes prior to sleep to improve natural sleep cycle recovery.', 1),
  ('r3333333-3333-3333-3333-333333333333', 'social_connection', 'Peer Community Support', 'Participate in campus peer study groups or student welfare society gatherings.', 1),
  ('r4444444-4444-4444-4444-444444444444', 'emotional_wellbeing', 'Mindful Reflection Breaks', 'Take 5 minutes daily for quiet, unstructured self-reflection to recharge mental focus.', 1)
ON CONFLICT DO NOTHING;

