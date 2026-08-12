# NSWEIS — Persistent Project Context & Source of Truth

**Product Name:** National Student Well-being Early Intervention System (NSWEIS)  
**Version:** 1.0.0 (Milestone 4 Baseline)  
**Status:** Milestone 4 — COMPLETED  
**Date:** August 12, 2026  

---

## A. Project Identity
- **Product Name:** NSWEIS (National Student Well-being Early Intervention System)
- **Product Purpose:** A privacy-conscious, non-clinical student well-being early-intervention ecosystem. It empowers students through self-reflection, provides higher education institutions with anonymized aggregate wellness insights, enables targeted preventative interventions, and equips government administrators with scoped regional institutional oversight.
- **Hackathon Context:** Multi-tenant early-intervention ecosystem demonstration.
- **Current MVP Scope:** Student Auth, Student Dashboard, Weekly Check-in, Base & Adaptive Questions Engine, Deterministic Category Scoring, Non-clinical Wellness Bands & Trend Calculation, Personalized Recommendations, Student Check-in History, Dynamic Historical Result Detail Routing, College Institutional Intelligence & Interventions, Government Regional Oversight & Scope Authorization (`government_admin_scopes`), Cross-institution Aggregate Intelligence, Anonymity Thresholding ($\ge 10$ students), Super Admin Ecosystem Control, Server-side Logout, and Lucide Icon System.

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

## E. Architecture
- **Rendering Architecture:** Server-Side Rendering (`output: 'server'`) with `@astrojs/vercel` adapter.
- **Database Authorization:** PostgreSQL Row Level Security (RLS) on all exposed tables.
- **Authentication & Middleware:** Cookie-based session management using `@supabase/ssr` inside [`src/middleware.ts`](file:///c:/Projects/YI/NSWEIS/src/middleware.ts), verifying user roles and enforcing route guards.
- **Government Scope Authorization Model:** Explicit institution assignment via `government_admin_scopes` table (`admin_profile_id` $\rightarrow$ `institution_id`). Super Admins have system-wide visibility.
- **Authentic Supabase Auth User UUID Mappings:**
  - **Government Admin:** `96ee2b52-1628-4e7e-b247-6cf37032dc16`
  - **Super Admin:** `d4068972-4be2-4b76-ae26-dd75022ffbe7`
- **Service Layer Pattern:** Business operations encapsulated in [`src/services/`](file:///c:/Projects/YI/NSWEIS/src/services/) (`assessments.ts`, `users.ts`, `institutions.ts`, `interventions.ts`, `analytics.ts`).
- **Scoring Engine:** Deterministic normalized category scoring engine in [`src/lib/scoring/engine.ts`](file:///c:/Projects/YI/NSWEIS/src/lib/scoring/engine.ts).
- **Validation Layer:** Input validation helpers in [`src/lib/validation/schemas.ts`](file:///c:/Projects/YI/NSWEIS/src/lib/validation/schemas.ts).

---

## F. Roles & Permission Boundaries

| Role | Scope Access | Route Guard | Data Access Level |
|---|---|---|---|
| **`student`** | Self only | `/student/*` | Own reflections, scores & history only |
| **`college_officer`** | Own Institution | `/college/*` | Anonymized aggregate institution metrics & interventions |
| **`government_admin`** | Assigned Institutions (`government_admin_scopes`) | `/admin/*` | Scoped regional aggregate metrics & intervention oversight |
| **`super_admin`** | System-wide / National | `/superadmin/*` | System configuration, institution directory & scope assignments |

---

## G. Current Implemented Routes

### Public Routes
- `/` — Landing Page
- `/login` — Multi-Role Demo Authentication Page
- `/logout` — Server-side Session Sign-out & Cookie Purge
- `/privacy` — Privacy & Safety Framework

### Student Domain
- `/student/dashboard` — Student Home Hub & Check-in Status Card
- `/student/check-in` — Weekly Check-in Form (Base + Adaptive)
- `/student/wellness` — Latest Wellness Summary & Recommendations
- `/student/wellness/[assessmentId]` — Authorized Historical Check-in Result Detail
- `/student/history` — Check-in History Timeline
- `/student/profile` — Student Profile Overview

### College Domain
- `/college/dashboard` — Institutional Overview (5 Core Questions & Privacy Threshold)
- `/college/insights` — Detailed Analytical Breakdown
- `/college/interventions` — Intervention Directory
- `/college/interventions/new` — Schedule New Intervention Form

### Government Domain (Milestone 4 Implemented)
- `/admin/dashboard` — Regional Intelligence & Scope Overview
- `/admin/institutions` — Authorized Institutions Directory
- `/admin/institutions/[institutionId]` — Single Institution Aggregate Oversight (Scope Enforced)
- `/admin/insights` — Cross-Institutional Category Breakdown & Trends
- `/admin/interventions` — Regional Intervention Program Oversight

### Super Admin Domain (Milestone 4 Implemented)
- `/superadmin/dashboard` — National Ecosystem System Overview
- `/superadmin/institutions` — Institution Management & Status Control
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

---

## I. Privacy & Anonymity Architecture
- **Minimum Reporting Threshold:** $\ge 10$ participating students required per department/institution. Groups under 10 return `is_suppressed = TRUE`, `average_score = NULL`, `dominant_band = NULL`, `participating_student_count = NULL` (zero count leakage), displaying `'Insufficient group size for anonymous reporting.'`.
- **Small-Group Participation Privacy (<10 Students):** When authorized participating population is below 10, exact participating student counts, eligible counts, participation rates, and reporting active institution counts are suppressed and displayed as `"Insufficient data"`.
- **Areas of Concern Semantic Control:** Suppressed analytics ($<10$ participants) return `"Insufficient data"` for Areas of Concern rather than zero (`0`). Unavailable data is never interpreted as zero concern.
- **Absolute Data Restrictions:** Government Admin and Super Admin APIs/services **never** query or expose individual student names, emails, roll numbers, reflections, or raw question responses.
- **RPC Security Hardening (`SECURITY DEFINER`):** Functions verify `auth.uid() IS NOT NULL`, enforce caller role eligibility (`government_admin` / `super_admin`), check caller ID equality (`auth.uid() = p_admin_id`), and explicitly `REVOKE` execution from `PUBLIC, anon` while `GRANT`ing only to `authenticated`.
- **Server-Side Authorization Scoping:** Government Admin authorized institutions are derived server-side via `get_government_authorized_institutions(admin_id)`. Manually supplied `institutionId` parameters are strictly checked against the authorized scope before returning data.

---

## J. Professional Icon System
- **Lucide Icon Library (`@lucide/astro`):** Emojis have been completely eliminated from navigation, metric cards, buttons, badges, and headers across Student, College, Government, and Super Admin portals.
- **Icon Standards:**
  - Dashboard $\rightarrow$ `LayoutDashboard`
  - Institutions $\rightarrow$ `Building2`
  - Insights $\rightarrow$ `ChartNoAxesCombined`
  - Interventions $\rightarrow$ `CalendarCheck`
  - Participation / Scope $\rightarrow$ `UsersRound` / `UserCog`
  - Well-being $\rightarrow$ `HeartPulse`
  - Privacy / Security $\rightarrow$ `ShieldCheck` / `LockKeyhole`
  - Trends $\rightarrow$ `TrendingUp` / `TrendingDown` / `Minus`

---

## K. Diagnostics & Build Verification
- **`npx astro check`**: Passed cleanly (`Result (80 files): 0 errors, 0 warnings, 6 hints`).
- **`npm run build`**: Production build succeeded in 5.94s with Vercel adapter compilation.

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
