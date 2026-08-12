# NSWEIS — Persistent Project Context & Source of Truth

**Product Name:** National Student Well-being Early Intervention System (NSWEIS)  
**Version:** 1.0.0 (Milestone 5 Baseline)  
**Status:** Milestone 5 — COMPLETED (End-to-End Product Integrated & Hackathon Demo Ready)  
**Date:** August 12, 2026  

---

## A. Project Identity
- **Product Name:** NSWEIS (National Student Well-being Early Intervention System)
- **Product Purpose:** A privacy-conscious, non-clinical student well-being early-intervention ecosystem. It empowers students through self-reflection, provides higher education institutions with anonymized aggregate wellness insights, enables targeted preventative interventions, and equips government administrators with scoped regional institutional oversight.
- **Hackathon Context:** Multi-tenant early-intervention ecosystem demonstration.
- **Current Scope (Milestone 5 Complete):** Complete End-to-End Integrated System across Student, College Officer, Government Admin, and Super Admin portals. Features real Supabase Auth, base & adaptive assessment scoring engine, non-clinical wellness indicators & trends, privacy thresholding ($\ge 10$ students), scoped government administration (`government_admin_scopes`), Super Admin ecosystem management, server-side session sign-out, mobile-first responsive student flow, and `@lucide/astro` icon integration.

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
Government regional scope oversight & policy coordination
```
> [!IMPORTANT]
> **Safety & Boundary Guarantee:** NSWEIS is a student well-being and early-intervention platform. It is **not** a clinical diagnostic system, does not evaluate psychiatric conditions, and does not replace professional medical or counselling services.

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

## E. Architecture & Real Demo Auth User Mapping

### Server-Side Architecture
- **Rendering Architecture:** Server-Side Rendering (`output: 'server'`) with `@astrojs/vercel` adapter.
- **Database Authorization:** PostgreSQL Row Level Security (RLS) on all exposed tables.
- **Authentication & Middleware:** Cookie-based session management using `@supabase/ssr` inside [`src/middleware.ts`](file:///c:/Projects/YI/NSWEIS/src/middleware.ts), verifying user roles and enforcing route guards.
- **Government Scope Authorization Model:** Explicit institution assignment via `government_admin_scopes` table (`admin_profile_id` $\rightarrow$ `institution_id`). Super Admins have system-wide visibility.

### Real Demo Accounts

| Role | Email Credentials | Profile ID | Assigned Scope |
|---|---|---|---|
| **Student** | `student@demo.nsweis.gov.in` | Supabase Auth Managed | Institution 1 (NIT Apex) |
| **College Officer** | `college@demo.nsweis.gov.in` | Supabase Auth Managed | Institution 1 (NIT Apex) |
| **Government Admin** | `admin@demo.nsweis.gov.in` | `96ee2b52-1628-4e7e-b247-6cf37032dc16` | Institutions 1 & 2 (NITA01, MCSA02) |
| **Super Admin** | `super@demo.nsweis.gov.in` | `d4068972-4be2-4b76-ae26-dd75022ffbe7` | System-wide / National Scope |

---

## F. Roles & Permission Boundaries

| Role | Scope Access | Route Guard | Data Access Level |
|---|---|---|---|
| **`student`** | Self only | `/student/*` | Own reflections, scores & history only |
| **`college_officer`** | Own Institution | `/college/*` | Anonymized aggregate institution metrics & interventions |
| **`government_admin`** | Assigned Institutions (`government_admin_scopes`) | `/admin/*` | Scoped regional aggregate metrics & intervention oversight |
| **`super_admin`** | System-wide / National | `/superadmin/*` | System configuration, institution directory & scope assignments |

---

## G. Complete Implemented Routes

### Public Routes
- `/` — Landing Page
- `/login` — Multi-Role Demo Authentication Page
- `/logout` — Server-side Session Sign-out & Cookie Purge
- `/privacy` — Privacy & Safety Framework

### Student Domain (Mobile-First)
- `/student/dashboard` — Student Home Hub & Check-in Status Card
- `/student/check-in` — Weekly Check-in Form (Base + Adaptive Questions + Reflection)
- `/student/wellness` — Latest Wellness Summary & Recommendations
- `/student/wellness/[assessmentId]` — Authorized Historical Check-in Result Detail (Ownership Enforced)
- `/student/history` — Check-in History Timeline
- `/student/profile` — Student Profile Overview

### College Domain
- `/college/dashboard` — Institutional Overview (5 Core Questions & Privacy Threshold)
- `/college/insights` — Detailed Analytical Breakdown
- `/college/interventions` — Intervention Directory
- `/college/interventions/new` — Schedule New Intervention Form

### Government Domain
- `/admin/dashboard` — Regional Intelligence & Scope Overview
- `/admin/institutions` — Authorized Institutions Directory
- `/admin/institutions/[institutionId]` — Single Institution Aggregate Oversight (Scope Enforced)
- `/admin/insights` — Cross-Institutional Category Breakdown & Trends
- `/admin/interventions` — Regional Intervention Program Oversight (Read-Only)

### Super Admin Domain
- `/superadmin/dashboard` — National Ecosystem System Overview
- `/superadmin/institutions` — Institution Management & Status Control (Non-Destructive)
- `/superadmin/scopes` — Government Admin Scope Authorization Control
- `/superadmin/cycles` — National Assessment Cycles Overview

---

## H. Database Architecture & Manual SQL Workflow

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

---

## I. Privacy & Security Testing Results
- **Minimum Reporting Threshold ($\ge 10$ Students):** Enforced database-side and view-model side. When participating students $< 10$, category scores return `NULL` with `is_suppressed = TRUE`. Metrics, participation rates, and Areas of Concern render `"Insufficient data"`.
- **Zero Information Leakage:** Suppressed population counts return `NULL::BIGINT` in SQL payloads to prevent reverse-inference of small group sizes.
- **Cross-Student Assessment Isolation:** Route `/student/wellness/[assessmentId]` queries `student_id = user.id` (backed by RLS `student_id = auth.uid()`). Accessing another student's ID redirects safely without data exposure.
- **Government Scope Authorization:** Route `/admin/institutions/[institutionId]` verifies that the requested `institutionId` is present in the admin's `government_admin_scopes`. Unauthorized attempts redirect safely to `/admin/institutions`.
- **RPC Security Hardening (`SECURITY DEFINER`):** Government RPCs verify `auth.uid() IS NOT NULL`, enforce caller role eligibility (`government_admin` / `super_admin`), check caller ID equality (`auth.uid() = p_admin_id`), and explicitly `REVOKE` execution from `PUBLIC, anon` while `GRANT`ing only to `authenticated`.

---

## J. Professional Icon System
- **Lucide Icon Library (`@lucide/astro`):** Emojis have been completely eliminated from navigation, metric cards, buttons, badges, and headers across Student, College, Government, and Super Admin portals.

---

## K. Diagnostics & Build Verification
- **`npx astro check`**: Passed cleanly (`Result (80 files): 0 errors, 0 warnings, 6 hints`).
- **`npm run build`**: Production build succeeded in 4.56s with Vercel adapter compilation.
- **Slice 1 (Form Error Alerting):** Implemented persistent inline `<Alert variant="error">` in `/college/interventions/new` (with form value retention) and `/student/check-in` using safe, non-technical human-readable error messages.
- **Slice 2 (Mobile Touch & Question Card Polish):** Enforced 48px min-height touch targets in `ChoiceOption.astro`, flex-shrink radio alignment on multi-line text, keyboard focus ring (`:focus-within`), and responsive line-height / gap tuning in `QuestionCard.astro`.
- **Slice 3 (Super Admin Scope Assignment Status Badge):** Displayed positive active status badge (`variant="stable"`, `size="sm"`) with `@lucide/astro` `<Check>` icon in `/superadmin/scopes` table for active Government Admin scope assignments.
- **Phase 6 Slice 1 (Demo Journey Audit):** Performed comprehensive end-to-end audit of all 4 stakeholder flows, demo dataset, privacy guarantees, live presentation risk matrix (P0-P3), 5-7 min demo script, and click count (~25 clicks).
- **Phase 6 Slice 2 (Landing Experience & Presentation UX):** Redesigned `/` landing page with professional civic tech aesthetic, 5-stage early-intervention architecture flow, prominent privacy architecture grid (&ge; 10 suppression), stakeholder value section, and explicit non-clinical boundary banner using `@lucide/astro` icons (no emojis).
- **Phase 6 Slice 3 (Pre-Demo Reliability Audit):** Conducted rigorous read-only pre-demo audit across environment variables, build integrity (`0 errors, 0 warnings`), 19 application routes, middleware authorization matrix, demo dataset structures (Scenario A & B), security invariants (0 service-role keys in client code), live demo risk register (P0-P3), and PM pre-demo checklist.
- **Git Execution Status**: Local changes remain uncommitted and unpushed as directed.

---

## L. CTO Rules & Directives
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
