# NSWEIS — Codebase & Database Security / Architecture Audit

**Audited:** 26 August 2026 · Astro 7 (SSR, Vercel adapter) + Supabase Postgres
**Scope:** 110 source files, 17 SQL files, 4 role areas. Full `src/`, full `supabase/`.
**Status of this document:** findings only. Fixes are tracked in `BUILD_PLAN.md`.

---

## 0. Verdict

The system is well-organised for a prototype — clean service layer, real component
library, coherent domain types. But **the central privacy claim of NSWEIS is not
enforced by the architecture.** It is asserted in application code and, in two
places, contradicted by the database.

Three findings are release-blocking. Two of them are stated as facts on the public
homepage, which turns a security bug into a misrepresentation to the students whose
consent the platform depends on.

---

## 1. Architecture as built

```
Browser
  │
  ├── src/middleware.ts ......... session load + route guard  (DEFAULT-ALLOW — see C4)
  │
  ├── src/pages/<role>/ ......... student · college · admin · superadmin · government
  │        │                      (5 page trees, but only 4 roles exist — see H3)
  │        └── src/layouts/ ..... 6 layouts, one per area
  │
  ├── src/services/ ............. 13 modules, the real logic
  │        ├── analytics.ts ..... 34KB — aggregation + suppression  (IN APP CODE — C2)
  │        ├── assessments.ts ... uses SERVICE ROLE  (BYPASSES RLS — C2)
  │        └── adaptive-question-selection.ts + question-selection-rules.ts  (duplicated — M1)
  │
  └── Supabase Postgres ......... 24 tables, RLS enabled on 24, policies on 16
```

**Roles in code:** `student · college_officer · government_admin · super_admin`
(`src/types/domain.ts:1`). **There is no clinician / doctor role anywhere in the
codebase.** Question authoring is `super_admin`-only.

---

## 2. CRITICAL findings

### C1 — Any authenticated user can make themselves super_admin (two independent paths)

**Path A — the RLS policy.** `supabase/sql/00_initial_schema.sql:286`

```sql
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
```

There is no `WITH CHECK` and **no column restriction**. Postgres falls back to the
`USING` expression for the check, which only pins `id`. Every other column is
writable by the row's owner — including `role` and `institution_id`. Any logged-in
student can run:

```sql
update profiles set role = 'super_admin' where id = auth.uid();
```

…and then read every profile in the country (the SELECT policy grants
`super_admin` global read), author questions, and open every dashboard.

**Path B — role inferred from the email string.** `src/lib/auth/session.ts:38`

```js
const inferredRole = email.includes('super')  ? 'super_admin'
                   : email.includes('admin')  ? 'government_admin'
                   : email.includes('college')? 'college_officer'
                   : 'student';
```

If a profile row is missing, one is created with a role derived from a **substring
match on the user's own email address**. `superb.student@svce.edu.in` →
`super_admin`. If Supabase self-signup is enabled on this project, this is a remote
privilege escalation with no exploit required beyond choosing an email.

The same block hardcodes `institution_id: '11111111-1111-1111-1111-111111111111'`,
so every auto-created user is silently attached to the demo institution.

> **Severity: CRITICAL.** Either path alone defeats the entire access model.

---

### C2 — The privacy boundary is not in the database; the aggregation layer bypasses RLS

The only policy on `assessments` is student-scoped:

```sql
CREATE POLICY "Students can manage own assessments" ON public.assessments
  FOR ALL TO authenticated USING (student_id = auth.uid());
```

There is **no policy granting a college officer or government admin any read at
all.** So the dashboards cannot work through RLS — and they don't. They run on the
service-role key, which bypasses RLS entirely:

- `src/services/assessments.ts:306` — `createSupabaseAdminClient()`
- `src/services/analytics.ts:176` and `:676` — `SUPABASE_SERVICE_ROLE_KEY`

**Consequence:** every guarantee about what a college officer can and cannot see is
enforced by hand-written filters in `analytics.ts`, in application code, at
runtime. One missed `.eq('institution_id', …)` in a 34KB file and a college officer
reads another college's data — or an individual's. The database will not stop it.

This is the exact claim the homepage makes and the exact claim that is false:

> *"Individual student responses are strictly protected by database-level
> PostgreSQL Row Level Security (RLS). No officer or administrator can access
> individual check-in logs."* — `src/pages/index.astro:128`

RLS is enabled on the table. It is also bypassed on every path that reads it.

> **Severity: CRITICAL.** This is the finding a technical judge will find, and it
> is the one that matters most, because the whole policy argument rests on it.

---

### C3 — Suppression is institution-wide, not per-cell → re-identification via filters

`src/services/analytics.ts:268` computes **one** flag for the whole institution:

```js
const isSuppressed = completedCount < PRIVACY_THRESHOLD_MIN_STUDENTS;  // 10
```

Every breakdown then reuses that single flag, guarded per cell only by
`data.count > 0` (`:383`):

```js
average_score: !isSuppressed && data.count > 0 ? Math.round(...) : null,
```

**So:** an institution with 12 completed check-ins is un-suppressed. A college
officer then filters to *Year 3 → CSE → Section B*, which has **3** respondents,
and is shown that cohort's average score and dominant band. In a section of five,
that is individual-level inference.

The homepage states the opposite:

> *"Groups with fewer than 10 participating students automatically suppress
> category scores…"* — `src/pages/index.astro:145`

Groups are not checked. Only the institution total is.

> **Severity: CRITICAL.** Directly defeats the anonymity promise, and the fix is
> small (per-cell threshold), so there is no reason to ship without it.

---

## 3. HIGH findings

### H1 — Public homepage leaks backend internals and a live table name

`src/pages/index.astro:120–147` publishes, to anonymous visitors:

| Leak | Line |
|---|---|
| Backend named: "database-level PostgreSQL Row Level Security (RLS)" | 128 |
| **A real database table name in a `<code>` tag: `government_admin_scopes`** | 140 |
| The exact suppression threshold (≥ 10) — tells an adversary the cohort size that evades it | 145 |
| The internal four-tier operational hierarchy | 132–140 |

Also present on the public/student surface:
`src/components/privacy/FiveStagePrivacyFlow.astro` and
`ClosedLoopDataFlow.astro` render the internal five-stage pipeline and data-flow
diagram — pitch-deck material, not product UI.

> Publishing your own control names and thresholds gives an attacker the map. It is
> also unnecessary: students need to know *what is protected*, not *which Postgres
> feature does it*.

### H2 — Every authenticated student can read the entire question bank, including option scores

From `00_initial_schema.sql`, all of these are `FOR SELECT TO authenticated USING (true)`:
`questions`, `question_options`, `question_rules`, `recommendations`,
`interventions`, `institutions`, `departments`, `assessment_cycles`.

A student can read `question_options` and see the score attached to each choice —
then answer to produce whatever score they want. **Instrument validity is gone**,
and with it the meaning of every aggregate above it. Students can also enumerate
every intervention at every institution.

### H3 — `/government/*` has no route guard

`src/lib/permissions/roles.ts:18` matches only `/student/`, `/college/`, `/admin/`,
`/superadmin/`, then:

```js
return true; // Public routes
```

**Default-allow.** `src/pages/government/dashboard.astro` (21KB) matches no prefix,
so **any authenticated user — including a student — can load the government
dashboard.** `ROLE_DASHBOARDS` maps `government_admin → /admin/dashboard`, so
`/government/` is an orphaned duplicate tree that nothing routes to and nothing
protects.

### H4 — The clinician / doctor side does not exist

No `clinician` value in `UserRole`. No clinician pages, layout, or service. Question
authoring is gated to `super_admin` (`sql/08_question_management.sql`). There is no
`clinical_reviewed_by`, no `activated_by`, no peer-review constraint, no flag table.

Per the agreed design, the chain must be **author (clinician) → clinical review
(second clinician, never the author) → activation (regional admin) → flag-only
(college officer)**. None of it is present.

### H5 — Audit trail is inert

`audit_logs` has RLS **enabled with zero policies** — so no insert and no read
succeeds through the anon client. Any write that does land goes through the
service-role path, unattributable to a real actor. `intervention_attendance` and
`intervention_feedback` are in the same state: RLS on, no policies, dead tables.

For a system whose defence is "every privileged read is logged," there is currently
no usable log.

### H6 — Two divergent schema sources of truth

`supabase/sql/00_initial_schema.sql` (15,241 B) and
`supabase/migrations/20260812000000_initial_schema.sql` (12,812 B) both define the
same 16 tables and 16 policies, and differ by 2.4KB. `sql/` then continues with
`01`–`11` while `migrations/` stops. **Nobody can say which schema is deployed.**
Fixing a policy in the wrong file is a fix that silently does nothing.

---

## 4. MEDIUM findings

- **M1 — Duplicated selection logic.** `services/adaptive-question-selection.ts`
  (19KB) and `services/question-selection-rules.ts` (5KB) overlap; two routing
  implementations invite drift. Consolidate to one, keep it rule-table driven.
- **M2 — Demo data mixed into schema.** `01`, `02`, `05`, `06` are seed/demo files
  living beside real DDL. `06_hackathon_demo_dataset.sql` will get deployed to
  production by accident.
- **M3 — 60 loose scripts in `scratch/`** including `search_passwords.mjs`,
  `check_admin_pass.mjs`, `check_env_keys.mjs`. **Confirmed gitignored** (`scratch/`
  is in `.gitignore`), so not a repository leak — but they read live credentials and
  should not persist on disk.
- **M4 — `super_admin` is over-powerful.** It can read every profile nationally,
  author every question, and enter college *and* admin trees
  (`roles.ts:11–17`). No separation of duty; one compromised account is total.
- **M5 — Orphaned page trees.** `/admin/dashboard.astro` is 106 bytes (a stub) while
  `/government/dashboard.astro` is 21KB. The naming of `admin` vs `government` vs
  `superadmin` does not match the four roles, and one tree is dead.

---

## 5. What is genuinely good — do not rewrite

- **Service layer separation** is clean and testable. Keep it.
- **`lib/scoring/engine.ts`** is pure, deterministic, side-effect free. Correct
  design. It should move server-side-only and never be shipped to the client.
- **The UI component library** (17 components) with `tokens.css` is a real design
  system, not ad-hoc markup.
- **Suppression was thought about at all** — the flag, the notice copy, the
  threshold constant. The logic is in the wrong place and the wrong granularity,
  but the intent is there and the fix is an extension, not a rebuild.
- **`get_user_role()` is `SECURITY DEFINER` with a pinned `search_path`** — that is
  the correct way to write it, and it is done right.

---

## 6. Priority order

| # | Finding | Severity | Effort |
|---|---|---|---|
| 1 | C1 — privilege escalation (both paths) | CRITICAL | Small |
| 2 | C3 — per-cell suppression | CRITICAL | Small |
| 3 | H3 — `/government/*` unguarded, default-allow router | HIGH | Small |
| 4 | H1 — scrub public-facing internals | HIGH | Small |
| 5 | H2 — hide option scores from students | HIGH | Small |
| 6 | H6 — collapse to one schema source | HIGH | Medium |
| 7 | C2 — move the privacy boundary into the DB | CRITICAL | **Large** |
| 8 | H4 — build the clinician side | HIGH | **Large** |
| 9 | H5 — make the audit trail work | HIGH | Medium |

Items 1–5 are each a small, surgical, independently shippable change. Item 7 is the
one that actually makes the pitch true, and it is a day of work, not an hour.
