-- NSWEIS SQL MIGRATION
-- ID: 05
-- Feature: Synthetic Regional Dataset & Department Interventions (Idempotent)
-- Purpose: Seed departments and sample interventions for Metropolitan College (Institution 2) referencing actual Auth user UUIDs
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

-- 2. Demo Interventions for Metropolitan College (Referencing Real Government Admin UUID 96ee2b52-1628-4e7e-b247-6cf37032dc16)
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
    '96ee2b52-1628-4e7e-b247-6cf37032dc16', -- Real Government Admin Auth User UUID
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
