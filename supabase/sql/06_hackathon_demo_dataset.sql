-- NSWEIS SQL MIGRATION
-- ID: 06
-- Feature: Hackathon Controlled Demo Dataset for Scenario B (>= 10 Participating Students)
-- Purpose: Seed profiles, completed assessments, responses, and category scores for 10 real Supabase Auth users to demonstrate Scenario B (>= 10 participants, full aggregate intelligence & trends)
-- Execution: Safe for repeated manual execution in Supabase SQL Editor
-- Dependencies: 00_initial_schema.sql, 01_seed_demo_data.sql, 02_demo_student_profile.sql, 03_college_institutional_intelligence.sql, 04_government_intelligence.sql, 05_demo_government_dataset.sql
-- Status: PENDING MANUAL EXECUTION

DO $$
DECLARE
  -- AUTHORITATIVE SUPABASE AUTH USER UUIDs
  v_s1_id  UUID := 'c029c4e1-5dd0-4142-8f08-64b009e06b29'; -- Aarav Sharma
  v_s2_id  UUID := 'f8c6e520-872a-479f-bd63-334c04c162b9'; -- Diya Patel
  v_s3_id  UUID := '3536852c-e27d-4f78-942b-3c99b0d8d379'; -- Arjun Mehta
  v_s4_id  UUID := 'aeb67caa-1cdb-4dc4-a42a-a490638d2081'; -- Ananya Rao
  v_s5_id  UUID := '04cced84-7862-4ef6-8ff4-401fdc663d96'; -- Rohan Kumar
  v_s6_id  UUID := 'a1158b32-1ef7-40a1-a312-76638009f667'; -- Meera Nair
  v_s7_id  UUID := '249945f3-a67c-4ae6-82f3-205d85d3ba29'; -- Aditya Singh
  v_s8_id  UUID := '5f66f2d3-c805-48f4-a0a5-4fe08ab2ed4f'; -- Kavya Reddy
  v_s9_id  UUID := '00f9f541-407f-4419-a296-94d96ba57e7e'; -- Ishaan Verma
  v_s10_id UUID := '56ebed91-105b-4223-ba3e-5c2aae90e2db'; -- Neha Iyer

  v_inst_id UUID := '11111111-1111-1111-1111-111111111111'; -- National Institute of Technology, Apex
  v_dept_cse UUID := 'a1111111-1111-1111-1111-111111111111';
  v_dept_ece UUID := 'a2222222-2222-2222-2222-222222222222';
  v_dept_mech UUID := 'a3333333-3333-3333-3333-333333333333';

  v_cycle_id UUID := '01000000-0000-0000-0000-000000000001'; -- Active Cycle 2026-W32
  v_student_ids UUID[] := ARRAY[v_s1_id, v_s2_id, v_s3_id, v_s4_id, v_s5_id, v_s6_id, v_s7_id, v_s8_id, v_s9_id, v_s10_id];
  v_uid UUID;
  v_idx INT;
  v_exists BOOLEAN;
  v_assessment_id UUID;
BEGIN
  -- 1. VALIDATION: Check that all 10 Auth UIDs exist in auth.users before mutation
  FOR v_idx IN 1..10 LOOP
    v_uid := v_student_ids[v_idx];

    SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid) INTO v_exists;
    IF NOT v_exists THEN
      RAISE EXCEPTION 'Validation error: Auth user UUID % for Student % does not exist in auth.users. Please verify Supabase Authentication user creation.', v_uid, v_idx;
    END IF;
  END FOR;

  -- 2. SEED PROFILES (Idempotent)
  -- Map real Auth user UUIDs to student profiles in NIT Apex departments
  INSERT INTO public.profiles (id, full_name, role, institution_id, department_id, active)
  VALUES
    (v_s1_id,  'Aarav Sharma',  'student', v_inst_id, v_dept_cse, true),
    (v_s2_id,  'Diya Patel',    'student', v_inst_id, v_dept_cse, true),
    (v_s3_id,  'Arjun Mehta',   'student', v_inst_id, v_dept_cse, true),
    (v_s4_id,  'Ananya Rao',    'student', v_inst_id, v_dept_cse, true),
    (v_s5_id,  'Rohan Kumar',   'student', v_inst_id, v_dept_cse, true),
    (v_s6_id,  'Meera Nair',    'student', v_inst_id, v_dept_ece, true),
    (v_s7_id,  'Aditya Singh',  'student', v_inst_id, v_dept_ece, true),
    (v_s8_id,  'Kavya Reddy',   'student', v_inst_id, v_dept_ece, true),
    (v_s9_id,  'Ishaan Verma',  'student', v_inst_id, v_dept_ece, true),
    (v_s10_id, 'Neha Iyer',     'student', v_inst_id, v_dept_mech, true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'student',
    institution_id = EXCLUDED.institution_id,
    department_id = EXCLUDED.department_id,
    active = true;

  -- 3. SEED COMPLETED ASSESSMENTS & CATEGORY SCORES (Idempotent)
  FOR v_idx IN 1..10 LOOP
    v_uid := v_student_ids[v_idx];

    -- Insert or update completed assessment record for active cycle
    INSERT INTO public.assessments (
      id,
      student_id,
      cycle_id,
      status,
      overall_indicator,
      overall_band,
      started_at,
      completed_at
    ) VALUES (
      gen_random_uuid(),
      v_uid,
      v_cycle_id,
      'completed',
      CASE v_idx
        WHEN 1 THEN 7.8 WHEN 2 THEN 8.2 WHEN 3 THEN 6.5 WHEN 4 THEN 7.4 WHEN 5 THEN 8.8
        WHEN 6 THEN 5.2 WHEN 7 THEN 7.9 WHEN 8 THEN 8.4 WHEN 9 THEN 6.8 ELSE 7.1
      END,
      CASE WHEN v_idx = 6 THEN 'needs_attention'::wellness_band ELSE 'watch'::wellness_band END,
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '2 days'
    )
    ON CONFLICT (student_id, cycle_id) DO UPDATE SET
      status = 'completed',
      overall_indicator = EXCLUDED.overall_indicator,
      overall_band = EXCLUDED.overall_band,
      completed_at = EXCLUDED.completed_at
    RETURNING id INTO v_assessment_id;

    -- Insert realistic category scores for each category
    INSERT INTO public.assessment_category_scores (id, assessment_id, category, score, band) VALUES
      (gen_random_uuid(), v_assessment_id, 'academic',            CASE WHEN v_idx = 6 THEN 4.5 ELSE 7.5 END, CASE WHEN v_idx = 6 THEN 'needs_attention'::wellness_band ELSE 'watch'::wellness_band END),
      (gen_random_uuid(), v_assessment_id, 'sleep_rest',          CASE WHEN v_idx = 6 THEN 5.0 ELSE 6.8 END, CASE WHEN v_idx = 6 THEN 'needs_attention'::wellness_band ELSE 'watch'::wellness_band END),
      (gen_random_uuid(), v_assessment_id, 'emotional_wellbeing', CASE WHEN v_idx = 6 THEN 5.5 ELSE 7.2 END, CASE WHEN v_idx = 6 THEN 'needs_attention'::wellness_band ELSE 'watch'::wellness_band END),
      (gen_random_uuid(), v_assessment_id, 'social_connection',   8.0, 'stable'::wellness_band),
      (gen_random_uuid(), v_assessment_id, 'family_home',         8.5, 'stable'::wellness_band),
      (gen_random_uuid(), v_assessment_id, 'financial',           7.0, 'watch'::wellness_band),
      (gen_random_uuid(), v_assessment_id, 'career',              7.2, 'watch'::wellness_band),
      (gen_random_uuid(), v_assessment_id, 'campus_experience',   8.1, 'stable'::wellness_band),
      (gen_random_uuid(), v_assessment_id, 'physical_wellbeing', 7.4, 'watch'::wellness_band)
    ON CONFLICT (assessment_id, category) DO UPDATE SET
      score = EXCLUDED.score,
      band = EXCLUDED.band;
  END FOR;

  RAISE NOTICE 'Successfully configured Scenario B dataset with 10 real Auth UUIDs for NIT Apex.';
END $$;
