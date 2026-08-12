-- NSWEIS SQL MIGRATION
-- ID: 05
-- Feature: Synthetic Government & Super Admin Dataset (Idempotent)
-- Purpose: Seed departments, student profiles, and completed assessments for Institution 2 (Metropolitan College)
-- Execution: Safe for repeated manual execution in Supabase SQL Editor
-- Dependencies: 00_initial_schema.sql, 01_seed_demo_data.sql, 04_government_intelligence.sql
-- Status: PENDING MANUAL EXECUTION

-- 1. Departments for Metropolitan College of Science & Arts (22222222-2222-2222-2222-222222222222)
INSERT INTO public.departments (id, institution_id, name, code, active) VALUES
  ('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Department of Biotechnology', 'BIOTECH', true),
  ('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'School of Fine Arts', 'ARTS', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code;

-- 2. Demo Government Admin Profile (If not existing)
INSERT INTO public.profiles (
  id,
  full_name,
  role,
  institution_id,
  active
) VALUES (
  '03000000-0000-0000-0000-000000000001',
  'Dr. Robert Vance (Ministry Officer)',
  'government_admin',
  '11111111-1111-1111-1111-111111111111',
  true
) ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name;

-- 3. Link Demo Government Admin Scope
INSERT INTO public.government_admin_scopes (admin_profile_id, institution_id) VALUES
  ('03000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('03000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (admin_profile_id, institution_id) DO NOTHING;

-- 4. Demo Super Admin Profile
INSERT INTO public.profiles (
  id,
  full_name,
  role,
  active
) VALUES (
  '04000000-0000-0000-0000-000000000001',
  'System Super Administrator',
  'super_admin',
  true
) ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name;

-- 5. Interventions for Metropolitan College (Idempotent)
INSERT INTO public.interventions (
  id,
  institution_id,
  created_by,
  title,
  description,
  category,
  target_department_id,
  scheduled_at,
  location,
  capacity,
  status
) VALUES
  (
    'f3333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    '03000000-0000-0000-0000-000000000001',
    'Creative Stress Relief & Wellness Art Fair',
    'Guided creative expression sessions promoting emotional wellbeing and peer connection.',
    'emotional_wellbeing',
    'b2222222-2222-2222-2222-222222222222',
    NOW() + INTERVAL '12 days',
    'Main Exhibition Hall',
    100,
    'scheduled'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  scheduled_at = EXCLUDED.scheduled_at,
  location = EXCLUDED.location;
