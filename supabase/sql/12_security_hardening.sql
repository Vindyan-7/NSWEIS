-- ============================================================================
-- NSWEIS · 12_security_hardening.sql
-- Fixes AUDIT.md findings C1, H2, H4 (schema), H5.
--
-- RUN ORDER MATTERS. Step 0 must be run and COMMITTED on its own before the
-- rest, because Postgres will not let a new enum value be used in the same
-- transaction that adds it.
--
-- Every statement is idempotent. Safe to re-run.
-- ============================================================================


-- ============================================================================
-- STEP 0 — RUN THIS ALONE, COMMIT, THEN RUN THE REST
-- ============================================================================
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'clinician';

-- ^^^ STOP. Commit. Then continue below. ^^^


-- ============================================================================
-- FIX C1(a) — Stop role / institution self-escalation via profiles UPDATE
--
-- The old policy was  USING (id = auth.uid())  with no WITH CHECK and no
-- column restriction, so a student could set their own role to super_admin.
-- Postgres cannot restrict columns inside a policy, so we pin the privileged
-- columns with a trigger and keep the policy for row scoping.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  -- service_role / SECURITY DEFINER admin paths bypass this guard deliberately
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  -- Only a super_admin may ever change a role, institution, or active flag.
  IF caller_role IS DISTINCT FROM 'super_admin' THEN
    NEW.role           := OLD.role;
    NEW.institution_id := OLD.institution_id;
    NEW.active         := OLD.active;
    NEW.id             := OLD.id;
  END IF;

  -- Nobody, including a super_admin, may escalate THEMSELVES.
  IF NEW.id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'A user may not change their own role';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- Re-state the policy with an explicit WITH CHECK so intent is readable.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING      (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Block self-insert of a profile row entirely. Profiles are provisioned by the
-- hierarchy, never by the user. (Closes the session.ts auto-create path — see
-- fix C1(b), which is the application-side half of this.)
DROP POLICY IF EXISTS "No self-provisioning of profiles" ON public.profiles;
CREATE POLICY "No self-provisioning of profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('super_admin', 'government_admin'));


-- ============================================================================
-- FIX H2 — Students must not be able to read option scores
--
-- question_options was  FOR SELECT TO authenticated USING (true),  which let any
-- student read the score attached to every choice and answer to order.
-- Students now read a view that does not carry the score column at all.
-- ============================================================================

DROP POLICY IF EXISTS "Question options read access" ON public.question_options;
CREATE POLICY "Only authors and reviewers read raw options" ON public.question_options
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('clinician', 'super_admin'));

-- security_invoker = false (the deliberate choice here, not the default
-- Supabase advises): this view exists PRECISELY to let an authenticated
-- user read option rows despite the policy above denying them the base
-- table. If it ran as invoker, the same policy would deny the view too and
-- every student would get zero rows back — the whole point is that the view
-- runs with elevated privilege but can only ever expose the two columns in
-- its SELECT list. There is no score column to leak no matter who queries
-- it, so bypassing row-level access here is safe by construction.
CREATE OR REPLACE VIEW public.student_question_options
WITH (security_invoker = false) AS
  SELECT id, question_id, label, order_index
  FROM public.question_options;

GRANT SELECT ON public.student_question_options TO authenticated;

-- Questions themselves: readable, but only ones actually in service.
-- (questions has no status column — only active BOOLEAN.)
DROP POLICY IF EXISTS "Questions read access" ON public.questions;
CREATE POLICY "Active questions readable" ON public.questions
  FOR SELECT TO authenticated
  USING (active = true OR public.get_user_role() IN ('clinician', 'super_admin'));

-- Routing rules are internal logic. Students must not be able to read the
-- table that decides what they are asked next.
DROP POLICY IF EXISTS "Question rules read access" ON public.question_rules;
CREATE POLICY "Question rules internal only" ON public.question_rules
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('clinician', 'super_admin'));

-- Interventions were globally readable across every institution.
DROP POLICY IF EXISTS "Interventions read access" ON public.interventions;
CREATE POLICY "Interventions scoped to own institution" ON public.interventions
  FOR SELECT TO authenticated
  USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR public.get_user_role() IN ('government_admin', 'super_admin')
  );


-- ============================================================================
-- FIX H4 — The clinical review chain
--
--   author (clinician)
--     -> clinical review (a DIFFERENT clinician)
--        -> activation (government_admin = the regional tier)
--           -> flag only (college_officer)
--
-- No single person can put a question in front of a student.
-- ============================================================================

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS authored_by           uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS clinical_reviewed_by  uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS clinical_reviewed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by          uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS activated_at          timestamptz;

-- An author may never approve their own item.
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS no_self_review;
ALTER TABLE public.questions ADD CONSTRAINT no_self_review
  CHECK (clinical_reviewed_by IS NULL OR clinical_reviewed_by <> authored_by);

-- Nothing reaches a student without clinical review first.
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS review_before_activation;
ALTER TABLE public.questions ADD CONSTRAINT review_before_activation
  CHECK (activated_at IS NULL OR clinical_reviewed_at IS NOT NULL);

-- College officer feedback: flag only. No edit, no approve, no deactivate.
CREATE TABLE IF NOT EXISTS public.question_flags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  raised_by       uuid NOT NULL REFERENCES public.profiles(id),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id),
  reason          text NOT NULL,
  raised_at       timestamptz NOT NULL DEFAULT now(),
  resolved_by     uuid REFERENCES public.profiles(id),
  resolved_at     timestamptz,
  resolution      text CHECK (resolution IN ('upheld','amended','retired'))
);

ALTER TABLE public.question_flags ENABLE ROW LEVEL SECURITY;

-- Replace the super_admin-only authoring policy from sql/08.
DROP POLICY IF EXISTS "Super admins can manage questions" ON public.questions;
DROP POLICY IF EXISTS "Super admins can manage question options" ON public.question_options;

-- Clinicians author. authored_by must be themselves.
DROP POLICY IF EXISTS "Clinicians author questions" ON public.questions;
CREATE POLICY "Clinicians author questions" ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'clinician' AND authored_by = auth.uid());

-- Clinicians review — but never their own item. The constraint above is the
-- backstop; this policy is the gate.
DROP POLICY IF EXISTS "Clinicians review others questions" ON public.questions;
CREATE POLICY "Clinicians review others questions" ON public.questions
  FOR UPDATE TO authenticated
  USING      (public.get_user_role() = 'clinician' AND authored_by <> auth.uid())
  WITH CHECK (public.get_user_role() = 'clinician' AND authored_by <> auth.uid());

-- Regional tier activates, and only post-review.
DROP POLICY IF EXISTS "Regional tier activates reviewed questions" ON public.questions;
CREATE POLICY "Regional tier activates reviewed questions" ON public.questions
  FOR UPDATE TO authenticated
  USING      (public.get_user_role() = 'government_admin' AND clinical_reviewed_at IS NOT NULL)
  WITH CHECK (public.get_user_role() = 'government_admin' AND clinical_reviewed_at IS NOT NULL);

-- Clinicians manage the options on their own drafts.
DROP POLICY IF EXISTS "Clinicians manage options on own drafts" ON public.question_options;
CREATE POLICY "Clinicians manage options on own drafts" ON public.question_options
  FOR ALL TO authenticated
  USING (
    public.get_user_role() = 'clinician'
    AND EXISTS (SELECT 1 FROM public.questions q
                WHERE q.id = question_id AND q.authored_by = auth.uid())
  )
  WITH CHECK (
    public.get_user_role() = 'clinician'
    AND EXISTS (SELECT 1 FROM public.questions q
                WHERE q.id = question_id AND q.authored_by = auth.uid())
  );

-- College officer: raise a flag. That is the entire write surface.
-- NOTE: there is deliberately NO update/delete policy on questions for
-- college_officer. Trying to edit an item must fail at the database.
DROP POLICY IF EXISTS "Officers raise question flags" ON public.question_flags;
CREATE POLICY "Officers raise question flags" ON public.question_flags
  FOR INSERT TO authenticated
  WITH CHECK (
    raised_by = auth.uid()
    AND public.get_user_role() = 'college_officer'
    AND institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Flags visible to raiser clinicians and regional" ON public.question_flags;
CREATE POLICY "Flags visible to raiser clinicians and regional" ON public.question_flags
  FOR SELECT TO authenticated
  USING (
    raised_by = auth.uid()
    OR public.get_user_role() IN ('clinician', 'government_admin', 'super_admin')
  );

DROP POLICY IF EXISTS "Clinicians resolve flags" ON public.question_flags;
CREATE POLICY "Clinicians resolve flags" ON public.question_flags
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'clinician');

CREATE INDEX IF NOT EXISTS idx_question_flags_question ON public.question_flags(question_id);
CREATE INDEX IF NOT EXISTS idx_questions_active         ON public.questions(active);
CREATE INDEX IF NOT EXISTS idx_questions_authored_by   ON public.questions(authored_by);


-- ============================================================================
-- FIX H5 — Make the audit trail actually work
--
-- audit_logs had RLS enabled and ZERO policies, so nothing could read or write
-- it through the anon client. The log was inert.
-- ============================================================================

DROP POLICY IF EXISTS "Actors can append their own audit rows" ON public.audit_logs;
CREATE POLICY "Actors can append their own audit rows" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

DROP POLICY IF EXISTS "Audit log readable by oversight tiers" ON public.audit_logs;
CREATE POLICY "Audit log readable by oversight tiers" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('government_admin', 'super_admin'));

-- Append-only: no UPDATE or DELETE policy exists, by design.


-- ============================================================================
-- FIX C3 (database half) — per-cell suppression as a function, so the rule
-- lives in one place instead of being re-derived in TypeScript per breakdown.
-- The application must call this rather than comparing counts itself.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.suppress_cell(cell_count integer)
RETURNS boolean AS $$
  SELECT cell_count IS NULL OR cell_count < 10;
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION public.suppress_cell(integer) IS
  'Single source of truth for k-anonymity. A cell with fewer than 10 '
  'respondents is suppressed regardless of the institution total. '
  'See AUDIT.md finding C3.';


-- ============================================================================
-- VERIFY — run these after applying. Every one must behave as commented.
-- ============================================================================
-- As a student:
--   update profiles set role='super_admin' where id=auth.uid();
--     -> role silently unchanged (trigger reverts it)
--   select * from question_options;              -> 0 rows (policy denies)
--   select * from student_question_options;      -> rows, NO score column
--   select * from question_rules;                -> 0 rows
--
-- As clinician A:
--   insert a question with authored_by = self          -> OK
--   update own question set clinical_reviewed_by=self  -> constraint violation
--
-- As government_admin:
--   activate a question with clinical_reviewed_at NULL -> policy denies
--
-- As college_officer:
--   update questions set text='x'                       -> 0 rows / denied
--   insert into question_flags (...)                   -> OK
--
-- NOTE ON APP-SIDE CHANGES THIS SQL REQUIRES: applying the question_options
-- policy above means the STUDENT's own client can no longer read that table
-- at all — including through the app's own server-side check-in flow, which
-- previously fetched options (label + score together) with the student's
-- session client to render the form and grade the submission. That has
-- already been patched this session (getBaseQuestions, generateStudent-
-- QuestionAssignment, getStudentQuestionAssignments in
-- adaptive-question-selection.ts, and the fallback path in
-- recommendations.ts now read question_options via the admin/service-role
-- client — server-only, score never reaches the browser). If you deploy
-- this migration against a commit that predates those app changes, the
-- check-in form will render with no answer choices at all.
