# NSWEIS — Persistent Project Context & Source of Truth

**Product Name:** National Student Well-being Early Intervention System (NSWEIS)  
**Version:** 2.5.2 (Phase 7 Slice 5 Final Security Correction Baseline)  
**Status:** Phase 7 Slice 5 Final Security Correction — Recommendation Engine RPC Security & Database Hardening (COMPLETED)  
**Date:** August 20, 2026  

---

## A. Project Identity
- **Product Name:** NSWEIS (National Student Well-being Early Intervention System)
- **Product Purpose:** A privacy-conscious, non-clinical student well-being early-intervention companion and institutional platform. It empowers higher education students through weekly self-reflection, personalized well-being activities, task completion, and progress tracking, while providing institutions with anonymized aggregate wellness insights and targeted non-clinical interventions.
- **Product Pivot (Phase 7):** Transitioning from hackathon-dashboard-first implementation into a student-first viable MVP. Preserving existing Astro SSR, Supabase Auth, PostgreSQL database baseline, and RLS security model.
- **Safety & Boundary Guarantee:** NSWEIS is a non-clinical well-being companion. It is **not** a psychiatric diagnostic tool, does **not** generate clinical/medical risk scores, and does **not** replace professional medical/counselling services.

---

## B. Team Structure
```text
Project Manager → User
CTO / Architecture Authority → ChatGPT
Senior Developer → Antigravity
```

---

## C. Target Student-First Architecture Vision
```text
Weekly Assessment Cycle (Week 1..N)
        ↓
Targeted Question Set (Base + Department/Branch + Adaptive)
        ↓
Super Admin Question Bank & Dual CSV Importer (/superadmin/questions)
        ↓
Student Weekly Check-in Session & Server-Authoritative 20-min Timer Gate (/student/check-in)
        ↓
Category-Level Support Signal Aggregation (0.0–10.0 Internal Support Signals)
        ↓
SECURITY DEFINER Generation RPC (public.generate_assessment_recommendations(UUID) -> BOOLEAN)
        ↓
Supportive Recommendations (Max 3 Category-Diverse Actions) & Generated Student Tasks (/student/wellness)
        ↓
SECURITY DEFINER RPC Task Completion & Ledger Award (+10 Credits) (/student/tasks)
        ↓
Longitudinal Progress View & Participation History (/student/progress)
```

---

## D. Technology Stack
Dependencies sourced directly from [`package.json`](file:///c:/Projects/YI/NSWEIS/package.json):
- **Framework:** Astro `^7.2.1` (SSR mode)
- **Language:** TypeScript `^6.0.3`
- **Icon Library:** `@lucide/astro` `^0.556.0` (Stroke SVG icons across all roles)
- **Deployment Adapter:** `@astrojs/vercel` `^11.0.5`
- **Database & Auth:** Supabase PostgreSQL & Supabase Auth (`@supabase/supabase-js` `^2.112.3`, `@supabase/ssr` `^0.12.4`)
- **Diagnostics:** `@astrojs/check` `^0.9.10`

---

## E. Database Architecture & Manual SQL Workflow

### Manual SQL Change Registry
The remote Supabase database is **MANUALLY ADMINISTERED** by the Project Manager using the Supabase Dashboard SQL Editor. Antigravity never connects directly to PostgreSQL or requests database credentials.

| SQL File | Feature | Purpose | Dependency | Execution Status |
|---|---|---|---|---|
| `00_initial_schema.sql` | Initial Schema | Create enums, tables, FKs, indexes, RLS & functions | None | **PENDING MANUAL EXECUTION** |
| `01_seed_demo_data.sql` | Demo Seed Data | Seed institutions, departments, cycle, questions, rules, recs | `00` | **PENDING MANUAL EXECUTION** |
| `02_demo_student_profile.sql` | Demo Student Link | Link Auth user UUID to public.profiles | `00`, `01` | **PENDING MANUAL EXECUTION** |
| `03_college_institutional_intelligence.sql` | College Analytics | Aggregation functions (>=10 threshold), RLS & interventions seed | `00..02` | **PENDING MANUAL EXECUTION** |
| `04_government_intelligence.sql` | Government Scope & Aggregation | `government_admin_scopes` table, RPC functions with >=10 threshold | `00..03` | **PENDING MANUAL EXECUTION** |
| `05_demo_government_dataset.sql` | Synthetic Regional Dataset | Seed Institution 2, departments, gov admin & super admin profiles | `00..04` | **PENDING MANUAL EXECUTION** |
| `06_hackathon_demo_dataset.sql` | Scenario B Demo Dataset | Seed 10 student check-ins for NIT Apex (Configured with 10 real Auth UIDs) | `00..05` | **PENDING MANUAL EXECUTION** |
| `07_student_first_mvp_schema.sql` | Student-First MVP Schema | Section code, digital_balance category, credits ledger, student tasks, question targeting & task completion RPC (Hardened) | `00..06` | **PENDING MANUAL EXECUTION** |
| `08_question_management.sql` | Question Management RLS | RLS management policies for super_admin on questions, options, and imports | `00..07` | **PENDING MANUAL EXECUTION** |
| `09_recommendation_engine.sql` | Recommendation Security Hardening | Hardened `recommendation_rules` RLS (super_admin only), DB unique indexes on `assessment_recommendations` & `student_tasks`, SECURITY DEFINER `generate_assessment_recommendations` RPC returning BOOLEAN only | `00..08` | **PENDING MANUAL EXECUTION** |

---

## F. Security & Database Boundary Verification (Final Security Correction)

### 1. `recommendation_rules` Table Boundary & RPC Leak Fix
- Removed direct student `SELECT` access policy on `public.recommendation_rules`.
- Dropped/removed unsafe `public.get_active_recommendation_rules()` RPC which returned rule thresholds to `authenticated` users.
- Implemented `public.generate_assessment_recommendations(p_assessment_id UUID)` RPC returning ONLY `BOOLEAN` status (`true`/`false`). Rule thresholds (`minimum_signal`, `maximum_signal`, `priority`) are evaluated entirely server-side inside PostgreSQL and are NEVER exposed to browser JavaScript.

### 2. Database Uniqueness & Idempotency
- Unique Index `idx_assessment_recs_unique` on `public.assessment_recommendations(assessment_id, recommendation_id)`.
- Partial Unique Index `idx_student_tasks_assessment_title_unique` on `public.student_tasks(student_id, assessment_id, title) WHERE assessment_id IS NOT NULL`.

---

## G. Diagnostics & Build Verification
- **`npx astro check`**: Passed cleanly (`Result (87 files): 0 errors, 0 warnings, 17 hints`).
- **`npm run build`**: Production build succeeded in 3.59s with Vercel adapter compilation.
- **Phase 7 Slice 5 Final Security Correction Status**: Complete.
- **Git Execution Status**: Local changes remain uncommitted and unpushed as directed.

---

## H. CTO Rules & Directives
1. Do not redesign architecture without CTO approval.
2. Do not add features outside the current milestone.
3. Do not weaken RLS to simplify implementation.
4. Do not expose service-role secrets.
5. Do not put business logic into UI components.
6. Do not create giant page files.
7. Do not hardcode database data into production UI.
8. Do not introduce AI without explicit CTO approval.
9. Do not introduce clinical claims or diagnostic scores.
10. Update `PROJECT_CONTEXT.md` and `PROJECT_HANDOFF.md` after every milestone/slice.
