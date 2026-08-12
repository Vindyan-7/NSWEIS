-- NSWEIS SQL MIGRATION
-- ID: 02
-- Feature: Demo Student Profile Linking
-- Purpose: Link the Supabase Auth user (student@demo.nsweis.gov.in) to the public.profiles record
-- Execution: Manual Supabase SQL Editor
-- Dependencies: 00_initial_schema.sql, 01_seed_demo_data.sql
-- Status: PENDING MANUAL EXECUTION
--
-- INSTRUCTIONS FOR PROJECT MANAGER:
-- 1. Create the Auth user in Supabase Dashboard -> Authentication -> Users:
--    Email: student@demo.nsweis.gov.in
--    Auto-Confirm User: Checked / Enabled
-- 2. Copy the generated User UID from the Authentication table.
-- 3. Replace 'REPLACE_WITH_AUTH_USER_UUID' below with that actual Auth User UID before running.

INSERT INTO public.profiles (
  id,
  full_name,
  role,
  institution_id,
  department_id,
  student_roll_no,
  year_level,
  active
) VALUES (
  'REPLACE_WITH_AUTH_USER_UUID',
  'Alex Student',
  'student',
  '11111111-1111-1111-1111-111111111111',
  'a1111111-1111-1111-1111-111111111111',
  'STU-2026-0842',
  2,
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  institution_id = EXCLUDED.institution_id,
  department_id = EXCLUDED.department_id,
  student_roll_no = EXCLUDED.student_roll_no,
  year_level = EXCLUDED.year_level,
  active = EXCLUDED.active;
