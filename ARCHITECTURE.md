# NSWEIS MVP — Final Technical Architecture

**Version:** 1.0  
**Status:** CTO-approved build baseline  
**Date:** 2026-08-12

## 1. Architecture Decision

The MVP will be a server-rendered Astro application using Supabase for authentication, PostgreSQL data, Row Level Security, and storage where needed. It will deploy to Vercel.

Astro SSR is required because authenticated pages and server-side authorization are part of the product. The Vercel adapter is the deployment target; Supabase's current Astro guidance uses SSR support with `@supabase/ssr`, while Astro's current Vercel guidance supports on-demand/server rendering through `@astrojs/vercel`. The implementation should follow the current official package APIs rather than copying stale examples.

## 2. Stack

- Astro + TypeScript
- `@supabase/supabase-js`
- `@supabase/ssr`
- `@astrojs/vercel`
- Supabase Auth
- Supabase PostgreSQL
- PostgreSQL RLS
- Supabase Storage only if the MVP actually stores permitted voice-note files
- CSS design tokens + modular Astro components
- Client-side TypeScript islands/scripts only where interaction requires them
- Charting library only when a native SVG/CSS implementation is insufficient

Avoid adding React/Vue/Svelte unless a concrete requirement appears.

## 3. Rendering

Default:

`output: 'server'`

Deployment:

`@astrojs/vercel`

Authenticated dashboard pages should be server-rendered. Client-side JavaScript should be limited to interactive controls such as assessment selection, charts, navigation drawers, and form enhancement.

## 4. Application Layers

```text
Browser
  ↓
Astro Pages / Layouts
  ↓
UI Components
  ↓
Route/Server Logic
  ↓
Service Layer
  ↓
Supabase SSR Client
  ↓
PostgreSQL + RLS
```

Business logic must not be duplicated in pages.

## 5. Route Domains

### Public

- `/`
- `/login`
- `/privacy`

### Student

- `/student/dashboard`
- `/student/check-in`
- `/student/history`
- `/student/wellness`
- `/student/profile`

### College

- `/college/dashboard`
- `/college/insights`
- `/college/interventions`
- `/college/interventions/new`
- `/college/interventions/[id]`
- `/college/reports`

### Government

- `/admin/dashboard`
- `/admin/institutions`
- `/admin/institutions/[id]`
- `/admin/insights`
- `/admin/compliance`

### Super Admin

- `/superadmin/dashboard`
- `/superadmin/users`
- `/superadmin/institutions`
- `/superadmin/questions`
- `/superadmin/settings`

## 6. Core Roles

- `student`
- `college_officer`
- `government_admin`
- `super_admin`

Do not trust a role supplied by the browser. Authorization is enforced server-side and in database RLS.

## 7. Authentication

Use Supabase Auth with email/password for the MVP.

Profiles are linked directly to `auth.users.id`.

Use Astro middleware/server utilities to establish the Supabase SSR session.

Unauthenticated users are redirected to `/login`.

Authenticated users are routed to the dashboard corresponding to their role.

## 8. Database Model

### `profiles`

- `id uuid primary key references auth.users(id) on delete cascade`
- `full_name text`
- `role user_role`
- `institution_id uuid nullable`
- `department_id uuid nullable`
- `student_roll_no text nullable`
- `year_level int nullable`
- `avatar_url text nullable`
- `active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

Student identity fields are never included in aggregate analytics responses.

### `institutions`

- `id uuid`
- `name text`
- `code text unique`
- `district text`
- `state text`
- `institution_type text`
- `active boolean`
- timestamps

### `departments`

- `id uuid`
- `institution_id uuid`
- `name text`
- `code text`
- `active boolean`
- timestamps

### `assessment_cycles`

- `id uuid`
- `name text`
- `week_number int`
- `starts_at timestamptz`
- `ends_at timestamptz`
- `status text`
- timestamps

### `questions`

- `id uuid`
- `text text`
- `category wellness_category`
- `question_type question_type`
- `weight numeric`
- `active boolean`
- `order_index int`
- `is_base_question boolean`
- timestamps

### `question_options`

- `id uuid`
- `question_id uuid`
- `label text`
- `score numeric`
- `order_index int`

### `question_rules`

Controls adaptive follow-up selection.

- `id uuid`
- `trigger_question_id uuid`
- `operator text`
- `threshold numeric`
- `target_category wellness_category`
- `follow_up_question_id uuid`
- `priority int`
- `active boolean`

The MVP should use deterministic rules.

### `assessments`

- `id uuid`
- `student_id uuid`
- `cycle_id uuid`
- `status assessment_status`
- `started_at timestamptz`
- `completed_at timestamptz nullable`
- `overall_indicator numeric nullable`
- `overall_band wellness_band nullable`
- timestamps

Unique constraint:

`student_id + cycle_id`

This prevents duplicate weekly submissions.

### `assessment_responses`

- `id uuid`
- `assessment_id uuid`
- `question_id uuid`
- `selected_option_id uuid nullable`
- `text_response text nullable`
- `created_at timestamptz`

### `assessment_category_scores`

- `id uuid`
- `assessment_id uuid`
- `category wellness_category`
- `score numeric`
- `band wellness_band`
- timestamps

Unique constraint:

`assessment_id + category`

### `recommendations`

- `id uuid`
- `category wellness_category`
- `title text`
- `description text`
- `priority int`
- `active boolean`

### `assessment_recommendations`

- `id uuid`
- `assessment_id uuid`
- `recommendation_id uuid`

### `interventions`

- `id uuid`
- `institution_id uuid`
- `created_by uuid`
- `title text`
- `description text`
- `category wellness_category`
- `target_department_id uuid nullable`
- `target_year int nullable`
- `scheduled_at timestamptz`
- `location text`
- `capacity int nullable`
- `status intervention_status`
- timestamps

### `intervention_attendance`

- `id uuid`
- `intervention_id uuid`
- `student_id uuid`
- `attended_at timestamptz`

For the MVP, attendance is available to the relevant institutional workflow but must not become part of student wellness analytics.

### `intervention_feedback`

- `id uuid`
- `intervention_id uuid`
- `rating int`
- `anonymous_comment text`
- `created_at timestamptz`

### `audit_logs`

- `id uuid`
- `actor_id uuid`
- `action text`
- `entity_type text`
- `entity_id uuid nullable`
- `metadata jsonb`
- `created_at timestamptz`

## 9. Enumerations

### `user_role`

- student
- college_officer
- government_admin
- super_admin

### `wellness_category`

- academic
- sleep_rest
- emotional_wellbeing
- social_connection
- family_home
- financial
- career
- campus_experience
- physical_wellbeing

### `wellness_band`

- stable
- improving
- needs_attention
- elevated

These are product indicators, not clinical diagnoses.

### `assessment_status`

- not_started
- in_progress
- completed

### `intervention_status`

- draft
- scheduled
- ongoing
- completed
- cancelled

## 10. Privacy Model

### Student

Can access:

- own profile
- own assessments
- own responses
- own scores
- own recommendations
- own history

### College Officer

Can access:

- aggregate analytics for their institution
- intervention records for their institution
- aggregate intervention outcomes

Cannot access through normal application workflows:

- individual student responses
- individual wellness scores
- private reflections
- student voice content

### Government Admin

Can access:

- institution-level aggregate metrics
- permitted district/state aggregate metrics
- intervention activity
- compliance metrics

Cannot access individual student responses through normal workflows.

### Super Admin

Can manage system configuration and demo data. Production policy should later impose stronger separation of duties.

## 11. RLS Strategy

Enable RLS on every exposed public table.

Use Supabase Auth identity through `auth.uid()`.

Do not rely only on client-side route guards.

Use indexed ownership/institution columns.

For complex authorization, use carefully reviewed security-definer helper functions rather than recursive policy joins.

Aggregate queries should be designed so that the API response contains only permitted aggregate fields.

Avoid creating unrestricted views. If a view is used for aggregate analytics, explicitly account for RLS behavior and use an appropriate security-invoker approach where supported.

## 12. Analytics Strategy

Do not calculate institutional analytics by downloading all student rows to the browser.

Use database queries/functions to calculate:

- participation rate
- category averages
- weekly trends
- department trends
- intervention counts
- intervention attendance

Return aggregate results only.

For the MVP, simple SQL aggregation is sufficient.

## 13. Assessment Engine

The assessment service owns:

- loading the current cycle
- loading base questions
- saving responses
- calculating category scores
- selecting adaptive questions
- generating the final indicator
- generating recommendations
- completing the assessment

The UI does not own scoring rules.

## 14. Adaptive Question Algorithm

```text
Load base questions
↓
Student answers
↓
Calculate category signals
↓
Evaluate question_rules
↓
Select highest-priority follow-ups
↓
Remove already-answered questions
↓
Apply maximum follow-up limit
↓
Present follow-ups
↓
Recalculate final indicators
```

No LLM is required for MVP adaptive selection.

## 15. Scoring

Use a configurable deterministic scoring engine.

Response scores are normalized by question weight.

Category scores are calculated independently.

Overall indicator is a weighted aggregate of available category scores.

Map the result to the four non-clinical bands.

The exact weights and thresholds should live in configuration/data, not UI code.

## 16. Recommendations

Recommendations are selected from category + band.

Example:

Academic / Elevated:

- break large study tasks into smaller sessions
- schedule recovery breaks
- use available academic support resources

Recommendations must never claim to treat or diagnose a condition.

## 17. Intervention Workflow

```text
College officer
↓
Review aggregate insight
↓
Create intervention
↓
Select category/cohort
↓
Schedule
↓
Students are informed through permitted UI
↓
Session occurs
↓
Attendance recorded
↓
Anonymous feedback
↓
Outcome appears in aggregate reporting
```

## 18. Voice Notes

MVP should support the UI and data model for an optional voice reflection.

Do not implement emotion detection or psychiatric inference.

If actual audio storage is enabled, use Supabase Storage with strict access rules and keep the file private.

If time is limited, implement a non-functional/demo voice control and postpone storage.

## 19. Notifications

MVP uses in-app notification components.

Future integrations:

- email
- push
- SMS/WhatsApp

Do not add external messaging services during the first build unless required.

## 20. File Structure

```text
src/
  components/
    ui/
    navigation/
    wellness/
    assessment/
    analytics/
    interventions/
    privacy/
  layouts/
    PublicLayout.astro
    StudentLayout.astro
    CollegeLayout.astro
    AdminLayout.astro
    SuperAdminLayout.astro
  pages/
    index.astro
    login.astro
    privacy.astro
    student/
    college/
    admin/
    superadmin/
  lib/
    supabase/
    auth/
    permissions/
    scoring/
    validation/
  services/
    assessments.ts
    analytics.ts
    interventions.ts
    institutions.ts
    users.ts
  types/
    database.ts
    domain.ts
  middleware.ts
  styles/
    tokens.css
    globals.css
```

## 21. Design System

The approved Stitch foundation is the visual reference.

Implement:

- semantic color tokens
- typography tokens
- spacing tokens
- radius tokens
- elevation tokens
- responsive breakpoints
- component states

Do not hardcode page-specific colors.

## 22. Dependency Philosophy

Start lean.

Required:

- Astro
- Supabase JS
- Supabase SSR
- Vercel adapter

Add charting or other UI libraries only when necessary.

Do not install a large component framework just to reproduce the Stitch design.

## 23. Environment

Expected public variables:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only secret where required:

- `SUPABASE_SERVICE_ROLE_KEY`

Never expose the service-role key to client code or commit it to Git.

## 24. Demo Accounts

Create demo accounts in Supabase Auth and corresponding profiles:

- Student
- College Wellness Officer
- Government Admin
- Super Admin

Use fictional data only.

## 25. Build Order

1. Initialize Astro project.
2. Configure Vercel SSR.
3. Configure Supabase SSR.
4. Create environment template.
5. Create project directories.
6. Create database migration.
7. Enable RLS.
8. Create seed/demo data.
9. Implement auth/session middleware.
10. Implement role guards.
11. Implement design tokens.
12. Implement primitives.
13. Implement layouts/navigation.
14. Implement student workflow.
15. Implement assessment engine.
16. Implement college dashboard.
17. Implement intervention workflow.
18. Implement government dashboard.
19. Implement super-admin minimum features.
20. Add demo polish.
21. Run security/permission tests.
22. Run production build.
23. Deploy to Vercel.

## 26. Definition of Technical Done

The foundation is complete when:

- `npm run build` succeeds
- local dev works
- Supabase connection works
- authentication works
- session persists
- role routing works
- RLS prevents unauthorized reads
- student can complete an assessment
- adaptive questions work
- scoring works
- recommendations work
- college receives aggregate analytics
- government receives institution-level analytics
- intervention creation works
- mobile layout works
- desktop admin layout works
- no secrets are exposed
- no critical console errors remain
