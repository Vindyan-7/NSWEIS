# NSWEIS — Implementation & Build Plan

Companion to `AUDIT.md`. Ordered by impact-per-hour, and sequenced so the project
is never left in a broken state: every phase ends somewhere shippable.

## Session 3 (26 Aug 2026) — Phase 4 DONE ✅

Built the full clinical review chain UI. New: `src/services/clinician.ts`,
`src/layouts/ClinicianLayout.astro`, `/clinician/dashboard`,
`/clinician/questions/new` (author), `/clinician/review/[id]` (peer review —
doubles as the author's own revision-after-feedback screen, since BUILD_PLAN's
"approve / request change" needs somewhere for the author to act on feedback,
and there was no such screen specified), `/clinician/flags`, `/admin/questions`
(regional activation — see note below on why `/admin/` not `/government/`),
`/college/questions` (flag-only affordance, no edit control anywhere).

New migration `supabase/sql/14_clinician_workflow_extras.sql` — two columns
the H4 migration didn't add: `questions.review_notes` (a reviewer had no way
to leave feedback — the schema had no column for it) and `questions.depth_level`
(BUILD_PLAN's authoring screen spec calls for it; nothing existed).

**Deviated from BUILD_PLAN's literal `/government/questions` path.** The
government_admin nav (`GovernmentLayout`) actually links `/admin/*` routes —
`/government/*` is the orphaned tree per AUDIT.md M5. Adding a third
`/government/` page would have been unreachable from the sidebar like
`/government/dashboard.astro` already is. Built it at `/admin/questions`
instead, where it's actually linked. Also fixed in passing: `ROLE_DASHBOARDS`
sends government_admin to `/government/dashboard` (changed in this session's
Session 2 predecessor's Phase 0), but `GovernmentLayout`'s own sidebar
"Dashboard" link still pointed at the `/admin/dashboard` stub — a dead link
introduced by that earlier change and never reconciled. Fixed both the nav
href and `/government/dashboard.astro`'s hardcoded `activePath`.

**super_admin's question-authoring UI is now broken by design, not by
accident.** `12_security_hardening.sql` dropped the super_admin write
policies on `questions`/`question_options` without replacing them — correct
per H4 (no single person, including super_admin, should be able to publish a
question unreviewed), but it left `/superadmin/questions.astro`'s create/
edit/archive/CSV-import forms submitting into an RLS wall with a raw
Postgres error as the only feedback. Replaced those broken forms with a
plain notice pointing at the new workflow; the page is view-only now for the
question library. Cycles and selection-rules tabs are untouched (different
tables, unaffected).

**No UI exists anywhere in this app to provision a new profile row** — not
just for clinician, this was already true for every role (see
`supabase/sql/02_demo_student_profile.sql`'s own "PENDING MANUAL EXECUTION"
comment). To test any of this, provision two clinician profiles and reuse an
existing government_admin, via SQL, same as you've been doing all session.
See the message accompanying this build for the exact insert statements.

**Ground rule carried through all phases:** do not rewrite the service layer, the
scoring engine, or the UI component library. They are sound. Everything below is
additive or surgical.

---

## Phase 0 — DONE IN THIS SESSION ✅

| Change | File | Fixes |
|---|---|---|
| Removed email-substring role inference; a session no longer provisions its own profile | `src/lib/auth/session.ts` | **C1b** |
| Router is now **default-deny**; `/government/*` and `/clinician/*` explicitly gated; `super_admin` no longer a wildcard | `src/lib/permissions/roles.ts` | **H3, M4** |
| Null-profile users routed to a dead end instead of being guessed into a tier | `src/middleware.ts` | **C1b** |
| New `/no-access` page | `src/pages/no-access.astro` | — |
| `clinician` added to the role union | `src/types/domain.ts` | **H4** |
| Backend internals scrubbed from the public homepage — RLS naming, the `government_admin_scopes` table name, and every suppression-threshold number replaced with plain-language student-facing copy | `src/pages/index.astro` | **H1** |
| Migration: role self-escalation trigger, option-score view, clinical review chain, working audit policies, `suppress_cell()` | `supabase/sql/12_security_hardening.sql` | **C1a, H2, H4, H5** |

> ⚠️ `12_security_hardening.sql` is written but **not yet applied**. Step 0 of that
> file (the enum value) must be run and committed on its own first. Nothing in
> Phase 1+ works until it is applied.

---

## Session 2 (26 Aug 2026) — DONE ✅

Per the handoff's own priority order: verified the build, confirmed and closed
the crisis-path gap (Phase 5), then did Phase 2.

| Change | File | Fixes |
|---|---|---|
| Fixed the one real build error (`Button` doesn't take `href`) | `src/pages/no-access.astro` | build |
| Confirmed crisis handling was genuinely absent; built the full path — full-screen non-dismissible interstitial on an `elevated`-band result, Tele-MANAS 14416, optional per-institution counsellor line, student-triggered "connect me" | `src/pages/student/check-in.astro`, `src/services/crisis.ts` | **Phase 5** |
| New table `crisis_escalations` + nullable `institutions.counsellor_name/phone`, RLS, column-guard trigger. **NOT YET APPLIED.** | `supabase/sql/13_crisis_support.sql` | Phase 5 |
| Closed a **second, live copy** of the C1b email-substring role-inference bug found while reading `check-in.astro` in full — it auto-provisioned profiles the same way `session.ts` used to, independent of that fix | `src/pages/student/check-in.astro` | **C1b (again)** |
| Per-cell suppression (AUDIT.md C3): category summaries, department summaries (RPC-mapping layer), government category summaries (RPC returns one institution-wide flag reused per category — re-derived per row instead), recommendation distribution (had **no suppression check at all** — fixed) | `src/services/analytics.ts` | **Phase 2 / C3** |
| Fixed `categorySummaries[0].is_suppressed` being read as an institution-wide flag — after the per-cell fix that's just one category's state | `src/pages/college/insights.astro` | Phase 2 follow-on |
| Replaced fabricated constant `7.2` / `'stable'` shown to every unsuppressed institution with the real computed average and band | `src/services/analytics.ts` (`getGovernmentInstitutionSummaries`) | correctness |

**Not done, deliberately deferred:** the differencing-attack mitigation BUILD_PLAN
flagged as "minimum viable... document the choice" (suppressing a second-smallest
sibling cell) was not implemented — noted here as a known gap, not silently
dropped. Phase 3 (DB boundary) and Phase 4 (clinician UI) were not started —
both are full-day, large-surface changes; see the note at the end of this file.

> ⚠️ `13_crisis_support.sql` is written but **not yet applied**, same as
> `12_security_hardening.sql`. Both are additive/idempotent and can be run in
> either order relative to each other, but each needs its own file run in full.

---

## Phase 1 — Apply and verify the migration  ·  ~30 min

1. Run **Step 0 only** (`ALTER TYPE … ADD VALUE 'clinician'`), commit.
2. Run the remainder of the file.
3. Work the **VERIFY** block at the bottom of the migration, as each role. Every
   assertion must behave as commented. In particular:
   - student `update profiles set role='super_admin'` → **silently reverted**
   - student `select * from question_options` → **0 rows**
   - clinician reviewing own item → **constraint violation**
   - college officer `update questions` → **denied**
4. Re-point the app off the service role wherever the new policies now suffice.

**Blocker for everything after this.** Do not build UI on unverified policies.

---

## Phase 2 — Per-cell suppression  ·  ~1 hr  ·  fixes C3

`src/services/analytics.ts` currently derives one institution-wide `isSuppressed`
(line 268) and reuses it for every breakdown, guarding cells only with
`data.count > 0` (line 383).

**Change:** suppress per cell, independently of the institution total.

```ts
// BEFORE  (line 383)
average_score: !isSuppressed && data.count > 0 ? round(data.sum / data.count) : null,

// AFTER
const cellSuppressed = data.count < PRIVACY_THRESHOLD_MIN_STUDENTS;
average_score: cellSuppressed ? null : round(data.sum / data.count),
dominant_band: cellSuppressed ? null : dominantBand,
participating_count: cellSuppressed ? null : data.count,   // count itself leaks
```

Apply the same treatment to every breakdown in the file — department, year,
section, category, and the recommendation distribution. Audit each `data.count`
site; there are several.

**Also:** suppress the *count* too, not just the score. "Section B: 3 respondents"
is itself disclosive in a small section.

**Also:** guard against differencing. If Year 3 total is shown and Year 3 has
exactly one suppressed section, the suppressed cell is recoverable by subtraction.
Minimum viable mitigation: when any child cell in a grouping is suppressed,
suppress a second-smallest cell as well. Document the choice.

---

## Phase 3 — Move the boundary into the database  ·  ~1 day  ·  fixes C2

The most important phase. Today every dashboard reads through the service-role key,
so RLS is bypassed and all separation lives in TypeScript filters.

1. Write a `SECURITY DEFINER` aggregate function, e.g.
   `institution_wellbeing_summary(p_institution uuid, p_filters jsonb)`, that:
   - resolves the caller with `auth.uid()` **inside** the function,
   - refuses unless the caller's `institution_id` matches (or caller is
     `government_admin` with that institution in scope),
   - applies `suppress_cell()` per returned row,
   - returns **only** aggregates. Never a `student_id`. Never reflection text.
2. Add RLS policies letting `college_officer` / `government_admin` read only what
   they legitimately need — nothing that exposes a row per student.
3. Replace the `createSupabaseAdminClient()` call in `assessments.ts:306` and the
   two `SUPABASE_SERVICE_ROLE_KEY` uses in `analytics.ts` with RPC calls to that
   function, running as the *user's* client.
4. Target state: **the service-role key is used by migrations and provisioning
   only, and by no request-path code.** Grep for it in `src/` and expect nothing.

When this is done, "a college officer cannot see an individual" stops being a
promise about code review and becomes a property of the database. That is the
claim the pitch rests on, so this is the phase that makes the pitch true.

---

## Phase 4 — Build the clinician side  ·  ~1 day  ·  fixes H4

Schema and policies land in Phase 1. This phase is the interface. Four screens.

```
/clinician/dashboard      queue: my drafts · awaiting my review · flagged · active
/clinician/questions/new  author: domain, text, options + score each, depth level
/clinician/review/[id]    peer review: approve / request change  (own items hidden)
/clinician/flags          flags raised by colleges, with resolve action
```

**Rules the UI must reflect, because the database already enforces them:**

- The review queue **must exclude the clinician's own authored items.** The
  `no_self_review` constraint will reject it anyway; the UI should never offer it.
- A clinician sees **no student data anywhere.** No cohort counts, no campus names,
  no response volumes. They see the instrument. Nothing else. This is worth
  stating in the layout chrome, so it reads as deliberate.
- Activation is **not** a clinician action. Show state (`approved — awaiting
  regional activation`) but no button.

**Then add the regional-tier activation screen:**

```
/government/questions     reviewed items awaiting activation, with author +
                          reviewer shown, and an Activate action
```

**And the college-officer flag affordance:**

On the college side, an active question can be **flagged with a reason** — and
nothing else. No edit control anywhere in that UI, because there is no policy that
would permit it. If a judge asks, the demo is: log in as the officer, look for an
edit button, and find there isn't one.

---

## Phase 5 — Crisis safety path  ·  ~3 hrs  ·  NOT YET AUDITED IN FULL

I did not finish reading `check-in.astro` (30KB) before the session limit, so this
is flagged rather than confirmed: **I found no crisis-handling code anywhere in my
grep of the student flow** — no Tele-MANAS number, no `14416`, no helpline
interstitial, no escalation on an acute response.

If that holds, it is the most serious *product* gap in the system, independent of
security. A weekly instrument that can detect acute distress and does nothing with
it is worse than no instrument.

**Required:** on an acute-band response, a full-screen non-dismissible interstitial
before any other content — Tele-MANAS **14416**, the campus counsellor's direct
line, and one button, *"Connect me to my campus counsellor,"* which is the student's
own choice and notifies nobody unless pressed. Anonymity is preserved because the
student holds the trigger.

**Verify this finding first.** Read `check-in.astro` end to end.

---

## Phase 6 — Schema consolidation  ·  ~2 hrs  ·  fixes H6, M2

1. Determine which of `sql/00_initial_schema.sql` / `migrations/2026…_initial_schema.sql`
   is actually deployed. Diff them; they differ by 2.4KB.
2. Keep **`supabase/migrations/` as the single source of truth.** Renumber
   `sql/01`–`12` into timestamped migrations.
3. Move `01`, `02`, `05`, `06` (demo/seed) into `supabase/seed/`, clearly separated,
   so `06_hackathon_demo_dataset.sql` can never reach production.
4. Delete `supabase/sql/` once migrated. Two sources of truth is how a security fix
   gets applied to the wrong file and silently does nothing.

---

## Phase 7 — Consolidation and polish  ·  ~half day

- **M1** Merge `adaptive-question-selection.ts` (19KB) and
  `question-selection-rules.ts` (5KB) into one rule-table-driven module.
- **M5** Resolve the `/admin/` vs `/government/` duplication. `/admin/dashboard.astro`
  is a 106-byte stub; `/government/dashboard.astro` is 21KB. Pick one tree
  (recommend `/government/`), delete the other, update `ROLE_DASHBOARDS`.
- **M3** Clear `scratch/` of the 60 credential-reading scripts. Gitignored, so not
  a repo leak — but they read live keys off disk.
- Move `lib/scoring/engine.ts` to a server-only path so option weights never ship
  in a client bundle. Pairs with H2: hiding scores in the DB is pointless if the
  scoring table ships to the browser.
- Student-facing score display: show **bands and direction**, not raw numerics.
  Exact numbers teach a student how to move the number.

---

## Not doing, deliberately

- **No ML routing.** The rule table is the honest answer and the better one. A
  model that decides what to ask a distressed nineteen-year-old, trained on nothing
  and reviewed by no one, is the most attackable thing that could be added.
- **No framework migration.** Astro + Supabase is the right size for this.
- **No redesign of the component library.** It works.

---

## Dependency graph

```
Phase 1 (migration)  ─┬─→ Phase 2 (suppression)
                      ├─→ Phase 3 (DB boundary)  ─→ Phase 7 (scoring server-only)
                      └─→ Phase 4 (clinician UI)
Phase 5 (crisis)  ── independent, do it early, it is a safety issue
Phase 6 (schema)  ── independent, but do it before writing many more migrations
```

**If time is short, the order is: 1 → 5 → 2 → 3.** Phases 4, 6, 7 are the ones to
defer. A demo with a working clinician panel but no crisis path is the wrong
trade.
