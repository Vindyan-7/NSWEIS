-- ============================================================================
-- NSWEIS · 14_clinician_workflow_extras.sql
-- BUILD_PLAN.md Phase 4 (clinician UI) needs two small columns that
-- 12_security_hardening.sql didn't add:
--
--   review_notes  — a reviewing clinician has no way to leave feedback when
--                   requesting a change instead of approving. There was no
--                   column for it at all; without one, "approve / request
--                   change" degrades to "approve / do nothing."
--   depth_level   — the authoring screen BUILD_PLAN specifies asks for a
--                   depth level (how probing/personal the question is);
--                   no such field exists anywhere in the schema yet.
--
-- No RLS or policy changes. The existing UPDATE policies on `questions` from
-- 12_security_hardening.sql already have no column-level restriction (Postgres
-- RLS can't do that without a trigger), so a reviewing clinician can already
-- write to review_notes once the column exists — no new grant needed.
--
-- Independent of 12/13. Idempotent. Safe to re-run.
-- ============================================================================

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS depth_level  text CHECK (depth_level IN ('light', 'moderate', 'deep'));

COMMENT ON COLUMN public.questions.review_notes IS
  'Feedback from a reviewing clinician when requesting a change instead of '
  'approving. The author clears it on their next save. Not a workflow-state '
  'column by itself — clinical_reviewed_at / activated_at still govern the '
  'lifecycle (see 12_security_hardening.sql FIX H4).';

COMMENT ON COLUMN public.questions.depth_level IS
  'How probing/personal the question is, set by the authoring clinician: '
  'light | moderate | deep. Informational only — nothing currently reads it '
  'for routing.';

-- ============================================================================
-- VERIFY — run after applying.
-- ============================================================================
-- As a clinician reviewing someone else's draft:
--   update questions set review_notes = 'tighten the wording on option C'
--     where id = <id> and authored_by <> auth.uid();
--     -> OK, saved, clinical_reviewed_at stays NULL (still not approved)
--
-- As the author, once you've revised:
--   update questions set text = '...', review_notes = null where id = <id>;
--     -> OK
