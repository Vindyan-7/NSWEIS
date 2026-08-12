# NSWEIS — Persistent Project Context & Source of Truth

**Product Name:** National Student Well-being Early Intervention System (NSWEIS)  
**Version:** 1.0.0 (Milestone 2 Baseline)  
**Status:** Milestone 2 — LOCKED & TEST READY  
**Date:** August 12, 2026  

---

## A. Project Identity
- **Product Name:** NSWEIS (National Student Well-being Early Intervention System)
- **Product Purpose:** A privacy-conscious, non-clinical student well-being early-intervention ecosystem. It empowers students through self-reflection, provides higher education institutions with anonymized aggregate wellness insights, and enables targeted preventative interventions with government oversight.
- **Hackathon Context:** MVP demonstration of an early-intervention ecosystem.
- **Current MVP Scope:** Student Auth, Student Dashboard, Weekly Check-in, Base & Adaptive Questions Engine, Deterministic Category Scoring, Non-clinical Wellness Bands & Trend Calculation, Personalized Recommendations, Student Check-in History, and Dynamic Historical Result Detail Routing.

---

## B. Team Structure
```text
Project Manager → User
CTO / Architecture Authority → ChatGPT
Implementation Developer → Antigravity
```

---

## C. Product Vision
```text
Student weekly check-in
        ↓
Personalized wellness insight
        ↓
Privacy-preserving aggregate institutional insight
        ↓
Targeted wellness intervention
        ↓
Government/district oversight
```
> [!IMPORTANT]
> **Safety & Boundary Guarantee:** NSWEIS is a student well-being and early-intervention platform. It is **not** a clinical diagnostic system, does not evaluate psychiatric conditions, and does not replace professional medical or counselling services.

---

## D. Technology Stack
Dependencies sourced directly from [`package.json`](file:///c:/Projects/YI/NSWEIS/package.json):
- **Framework:** Astro `^7.2.1` (SSR mode)
- **Language:** TypeScript `^6.0.3`
- **Deployment Adapter:** `@astrojs/vercel` `^11.0.5`
- **Database & Auth:** Supabase PostgreSQL & Supabase Auth (`@supabase/supabase-js` `^2.112.3`, `@supabase/ssr` `^0.12.4`)
- **Diagnostics:** `@astrojs/check` `^0.9.10`

---

## E. Architecture
- **Rendering Architecture:** Server-Side Rendering (`output: 'server'`) with `@astrojs/vercel` adapter.
- **Database Authorization:** PostgreSQL Row Level Security (RLS) on all exposed tables.
- **Authentication & Middleware:** Cookie-based session management using `@supabase/ssr` inside [`src/middleware.ts`](file:///c:/Projects/YI/NSWEIS/src/middleware.ts), verifying user roles and enforcing route guards.
- **Service Layer Pattern:** Business operations encapsulated in [`src/services/`](file:///c:/Projects/YI/NSWEIS/src/services/) (`assessments.ts`, `users.ts`, `institutions.ts`, `interventions.ts`, `analytics.ts`).
- **Scoring Engine:** Deterministic normalized category scoring engine in [`src/lib/scoring/engine.ts`](file:///c:/Projects/YI/NSWEIS/src/lib/scoring/engine.ts).
- **Validation Layer:** Input validation helpers in [`src/lib/validation/schemas.ts`](file:///c:/Projects/YI/NSWEIS/src/lib/validation/schemas.ts).

---

## F. Folder Structure
```text
NSWEIS/
├── .env.example
├── .gitignore
├── AGENTS.md
├── ARCHITECTURE.md
├── astro.config.mjs
├── package.json
├── PROJECT_CONTEXT.md
├── tsconfig.json
├── src/
│   ├── components/
│   │   ├── analytics/
│   │   │   └── ChartCard.astro
│   │   ├── assessment/
│   │   │   ├── AssessmentNavigation.astro
│   │   │   ├── AssessmentProgress.astro
│   │   │   ├── ChoiceOption.astro
│   │   │   ├── QuestionCard.astro
│   │   │   └── ReflectionBox.astro
│   │   ├── interventions/
│   │   │   └── InterventionCard.astro
│   │   ├── navigation/
│   │   │   ├── Header.astro
│   │   │   ├── MobileNav.astro
│   │   │   ├── PageHeader.astro
│   │   │   └── Sidebar.astro
│   │   ├── privacy/
│   │   │   └── PrivacyNotice.astro
│   │   ├── ui/
│   │   │   ├── Alert.astro
│   │   │   ├── Avatar.astro
│   │   │   ├── Badge.astro
│   │   │   ├── Button.astro
│   │   │   ├── Card.astro
│   │   │   ├── DataTable.astro
│   │   │   ├── EmptyState.astro
│   │   │   ├── ErrorState.astro
│   │   │   ├── FilterBar.astro
│   │   │   ├── Input.astro
│   │   │   ├── LoadingState.astro
│   │   │   ├── MetricCard.astro
│   │   │   ├── Modal.astro
│   │   │   ├── Progress.astro
│   │   │   ├── SearchField.astro
│   │   │   ├── Select.astro
│   │   │   ├── Textarea.astro
│   │   │   └── Toast.astro
│   │   └── wellness/
│   │       ├── CategoryIndicator.astro
│   │       ├── WellnessIndicator.astro
│   │       ├── WellnessSnapshot.astro
│   │       └── WellnessTrend.astro
│   ├── env.d.ts
│   ├── layouts/
│   │   ├── AdminLayout.astro
│   │   ├── CollegeLayout.astro
│   │   ├── PublicLayout.astro
│   │   ├── StudentLayout.astro
│   │   └── SuperAdminLayout.astro
│   ├── lib/
│   │   ├── auth/
│   │   │   └── session.ts
│   │   ├── permissions/
│   │   │   └── roles.ts
│   │   ├── scoring/
│   │   │   └── engine.ts
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── validation/
│   │       └── schemas.ts
│   ├── middleware.ts
│   ├── pages/
│   │   ├── admin/
│   │   │   └── dashboard.astro
│   │   ├── college/
│   │   │   └── dashboard.astro
│   │   ├── index.astro
│   │   ├── login.astro
│   │   ├── privacy.astro
│   │   ├── student/
│   │   │   ├── check-in.astro
│   │   │   ├── dashboard.astro
│   │   │   ├── history.astro
│   │   │   ├── profile.astro
│   │   │   └── wellness/
│   │   │       ├── [assessmentId].astro
│   │   │       └── index.astro
│   │   └── superadmin/
│   │       └── dashboard.astro
│   ├── services/
│   │   ├── analytics.ts
│   │   ├── assessments.ts
│   │   ├── institutions.ts
│   │   ├── interventions.ts
│   │   └── users.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.css
│   └── types/
│       ├── database.ts
│       └── domain.ts
└── supabase/
    ├── migrations/
    │   └── 20260812000000_initial_schema.sql
    └── seed.sql
```

---

## G. Roles & Permission Boundaries
1. **`student`**: Access to own profile, active check-in, personal wellness summary, check-in history, and own historical result details. Isolated from all other students' PII.
2. **`college_officer`**: Access to institution-level aggregate insights and intervention management. Restricted from viewing individual student raw responses.
3. **`government_admin`**: Access to state/district level aggregate adoption metrics and institutional compliance. Restricted from raw student response PII.
4. **`super_admin`**: System configuration and tenant management.

---

## H. Current Routes
### Public Routes (Implemented)
- `/` — Landing Page
- `/login` — Demo Authentication Page
- `/privacy` — Privacy & Safety Framework

### Student Domain (Implemented — Milestone 2 Scope)
- `/student/dashboard` — Student Home Hub & Check-in Status Card
- `/student/check-in` — Weekly Check-in Form (Base + Adaptive)
- `/student/wellness` — Latest Wellness Summary & Recommendations
- `/student/wellness/[assessmentId]` — Authorized Historical Check-in Result Detail
- `/student/history` — Check-in History Timeline
- `/student/profile` — Student Profile Overview

### College Domain (Placeholder Layouts — Planned Milestone 3)
- `/college/dashboard` — Institutional Overview Placeholder

### Government Domain (Placeholder Layouts — Planned Milestone 4)
- `/admin/dashboard` — National Overview Placeholder

### Super Admin Domain (Placeholder Layouts — Planned Milestone 5)
- `/superadmin/dashboard` — System Control Placeholder

---

## I. Database Tables
- `profiles`: Linked to `auth.users.id`. Stores user role, institution, department, and student details.
- `institutions`: Higher education campus entities.
- `departments`: Academic departments per institution.
- `assessment_cycles`: Weekly check-in cycles.
- `questions`: Base & follow-up questions with category, weight, and order index.
- `question_options`: Choice options with numeric score values.
- `question_rules`: Adaptive follow-up selection rules based on category indicator thresholds.
- `assessments`: Student check-in session records with unique constraint `(student_id, cycle_id)`.
- `assessment_responses`: Student responses with unique constraint `(assessment_id, question_id)` for idempotent updates.
- `assessment_category_scores`: Calculated normalized category scores and bands.
- `recommendations`: Non-clinical self-care recommendations.
- `assessment_recommendations`: Recommended items linked to specific assessment completed sessions.
- `interventions`: Institution-managed wellness intervention events.
- `intervention_attendance`: Attendance tracking for interventions.
- `intervention_feedback`: Anonymous student intervention feedback.
- `audit_logs`: System activity audit records.

---

## J. Assessment Engine
1. **Cycle Check**: Loads current active cycle from `assessment_cycles`.
2. **Session Initialization**: Creates or retrieves `in_progress` record in `assessments`.
3. **Base Questions**: Loads active base questions from `questions` and `question_options`.
4. **Normalized Adaptive Rules**: Evaluates `question_rules` against base response category signals normalized to 0–10. Triggers targeted follow-up questions if category indicator $\le 5.0$.
5. **Response Persistence**: Atomic upsert to `assessment_responses`.
6. **Scoring & Completion**: Calculates normalized category scores, maps overall indicator, assigns current band, matches recommendations, and sets `status = 'completed'`.

---

## K. Current Wellness Model

### Current Wellness Band
Calculated from the current completed assessment score:
- **`8.0 – 10.0`** $\rightarrow$ `stable`
- **`6.0 – <8.0`** $\rightarrow$ `watch`
- **`4.0 – <6.0`** $\rightarrow$ `needs_attention`
- **`0.0 – <4.0`** $\rightarrow$ `elevated`

### Trend Calculation
Calculated by comparing the current completed assessment overall indicator against the previous completed check-in:
- $\Delta > +0.3 \longrightarrow \mathbf{improving}$
- $|\Delta| \le 0.3 \longrightarrow \mathbf{stable}$
- $\Delta < -0.3 \longrightarrow \mathbf{declining}$
- No previous assessment $\longrightarrow \mathbf{first\_check\_in}$

---

## L. Privacy Model
- **Row Level Security (RLS):** Enabled on all public tables.
- **Student Data Isolation:** Policies enforce `student_id = auth.uid()`.
- **Raw Response Isolation:** College officers and government admins cannot query individual student response rows.
- **Service Role Protection:** `SUPABASE_SERVICE_ROLE_KEY` is restricted to server environments and never exposed to the client.
- **Security Definer Functions:** All privileged database helper functions specify `SECURITY DEFINER SET search_path = public`.

---

## M. Design System
- **Visual Reference:** Google Stitch visual language (light/white background, calm indigo/purple primary `#6366f1`, soft blue secondary `#0284c7`, Inter font, subtle elevation, moderate radius).
- **Component Architecture:** Reusable Astro UI primitives in [`src/components/ui/`](file:///c:/Projects/YI/NSWEIS/src/components/ui/).
- **Design Tokens:** Centralized CSS variables in [`src/styles/tokens.css`](file:///c:/Projects/YI/NSWEIS/src/styles/tokens.css).

---

## N. Completed Milestones
- **Milestone 1 — Foundation:** Project initialization, Astro SSR, Vercel adapter, Supabase SSR client, design system tokens, initial database migration, RLS baseline, and core UI components. (COMPLETED)
- **Milestone 2 — Student Product Flow & Assessment Engine:** Full Student Vertical Slice, Student Dashboard, Check-in Form, Base + Adaptive Questions, Response Persistence, Deterministic Scoring, Current Band vs Trend calculation, Personalized Recommendations, Check-in History, and Authorized Historical Detail Routing. (LOCKED)

---

## O. Current Test Readiness
Ready for end-to-end testing of the complete Student Product Flow:
1. Authentication (Login / Logout)
2. Student Dashboard Status Card (`Not Started` / `In Progress` / `Completed`)
3. Weekly Check-in Execution (Base Questions + Adaptive Follow-ups + Reflection)
4. Result Submission & Scoring
5. Wellness Summary & Recommendation display
6. Check-in History & Historical Detail Routing (`/student/wellness/[assessmentId]`)

---

## P. Known Issues
- None. `npx astro check` passes with 0 errors and `npm run build` succeeds cleanly.

---

## Q. Next Milestone
**Milestone 3 — College Institutional Intelligence**  
*(Status: NOT started. Standing by for CTO instruction.)*

---

## R. CTO Rules
1. Do not redesign architecture without CTO approval.
2. Do not add features outside the current milestone.
3. Do not weaken RLS to simplify implementation.
4. Do not expose service-role secrets.
5. Do not put business logic into UI components.
6. Do not create giant page files.
7. Do not hardcode database data into production UI.
8. Do not introduce AI without explicit CTO approval.
9. Do not introduce clinical claims.
10. Update `PROJECT_CONTEXT.md` after every milestone.
