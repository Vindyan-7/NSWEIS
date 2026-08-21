# NSWEIS — Persistent Project Context & Source of Truth

**Product Name:** National Student Well-being Early Intervention System (NSWEIS)  
**Version:** 4.1.0 (Phase 9 Pre-Flight Stabilization Baseline)  
**Status:** Phase 9 Pre-Flight Stabilization Pass (COMPLETED & VERIFIED)  
**Date:** August 21, 2026  

---

## A. Project Identity
- **Product Name:** NSWEIS (National Student Well-being Early Intervention System)
- **Product Purpose:** A privacy-conscious, non-clinical student well-being early-intervention companion and institutional platform. It empowers higher education students through weekly self-reflection, personalized well-being activities, task completion, and progress tracking, while providing institutions with anonymized aggregate wellness insights and targeted non-clinical interventions.
- **Product Pivot (Phase 8 & 9):** Transitioning from static weekly questionnaires to an adaptive weekly journey architecture. Master question library, configurable weekly cycles, question selection rules, deterministic adaptive selection engine, student question assignment history, longitudinal well-being journey experience, and evidence-based non-clinical Week 1 Question Architecture.
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
Master Question Library (reusable, cooldown_weeks, maximum_uses, adaptive_enabled)
        ↓
Super Admin Workspace (/superadmin/questions: Cycles, Library, Rules, CSV Import)
        ↓
Configurable Weekly Cycle (public.weekly_cycles: total, common, adaptive, duration)
        ↓
Adaptive Selection Engine (src/services/adaptive-question-selection.ts)
        ↓
Student Question Assignments (public.student_question_assignments)
        ↓
Student Weekly Reflection Session & 10-Min Session Gate (/student/check-in)
        ↓
Category-Level Support Signal Aggregation (0.0–10.0 Internal Support Signals)
        ↓
SECURITY DEFINER Generation RPC (public.generate_assessment_recommendations)
        ↓
Supportive Recommendations (Max 3 Category-Diverse Actions) & Generated Student Tasks (/student/wellness)
        ↓
SECURITY DEFINER RPC Task Completion & Ledger Award (+10 Credits) (/student/tasks)
        ↓
Longitudinal Well-being Journey View & Participation History (/student/progress)
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
| `06_hackathon_demo_dataset.sql` | Synthetic Baseline | Cleaned database baseline | `00..05` | **PENDING MANUAL EXECUTION** |
| `07_student_first_mvp_schema.sql` | Student-First MVP Schema | Section code, digital_balance category, credits ledger, student tasks, question targeting & task completion RPC (Hardened) | `00..06` | **PENDING MANUAL EXECUTION** |
| `08_question_management.sql` | Question Management RLS | RLS management policies for super_admin on questions, options, and imports | `00..07` | **PENDING MANUAL EXECUTION** |
| `09_recommendation_engine.sql` | Recommendation Security Hardening | Hardened `recommendation_rules` RLS (super_admin only), DB unique indexes on `assessment_recommendations` & `student_tasks`, SECURITY DEFINER `generate_assessment_recommendations` RPC returning BOOLEAN only | `00..08` | **PENDING MANUAL EXECUTION** |
| `10_adaptive_weekly_architecture.sql` | Adaptive Journey DB Foundation | `weekly_cycles` table, partial active index, `questions` metadata extensions, `question_selection_rules`, `student_question_assignments`, indexes & RLS policies | `00..09` | **EXECUTED SUCCESSFULLY** |
| `11_week1_question_library.sql` | Week 1 Question Architecture Seed | Seeds Week 1 active cycle (session_duration_minutes = 10), 7 common + 3 adaptive baseline questions (`W01-Q01`..`W01-Q10`), 5-option answer choices, and follow-up groups | `00..10` | **PENDING MANUAL EXECUTION** |

---

## F. Pre-Flight Stabilization & Check-in Persistence (Phase 9 Pre-Flight)

### 1. Root Cause Resolution & Immediate Response Persistence ([`src/pages/student/check-in.astro`](file:///c:/Projects/YI/NSWEIS/src/pages/student/check-in.astro))
- **Timer Reset Bug Fixed**: Server-side POST timer gate now immediately saves all answered questions into `assessment_responses` BEFORE checking completion conditions. If server time vs client timer gate differs slightly, selected options are NOT wiped out, remaining preserved on page reload.
- **10-Minute Cycle Duration**: Updated `session_duration_minutes` to 10 in `11_week1_question_library.sql` and `check-in.astro`.
- **Super Admin Testing Control**: Added server-verified `Admin Test Submit` control for `super_admin` role only. Server validates caller's server session (`profile?.role === 'super_admin'`) before bypassing minimum duration gate. Executes identical validation, persistence, scoring, recommendation, and task creation pipeline.

---

## G. Diagnostics & Build Verification
- **`npx tsx scratch/test_adaptive_selection_engine.mjs`**: PASSED (20/20 unit tests passed).
- **`npx astro check`**: Passed cleanly (`Result (92 files): 0 errors, 0 warnings, 23 hints`).
- **`npm run build`**: Production build succeeded in 4.61s with Vercel adapter compilation.
- **Phase 9 Pre-Flight Status**: Complete & Verified.
- **Git Execution Status**: Pushed to GitHub repository (`main` branch commit `3808fb8`).

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
