-- ============================================================================
-- NSWEIS · 13_crisis_support.sql
-- Fixes AUDIT.md / BUILD_PLAN.md Phase 5 — the crisis safety path was
-- completely absent from the student check-in flow. This migration adds the
-- one table the interstitial needs to log a trigger, an acknowledgement, and
-- an optional student-initiated request to be contacted.
--
-- INDEPENDENT of 12_security_hardening.sql — this only needs the base schema
-- (00_initial_schema.sql, specifically get_user_role() and public.profiles).
-- Safe to run before or after 12, but run it after for one clean batch.
-- Every statement is idempotent. Safe to re-run.
-- ============================================================================

-- Optional per-institution contact info for the interstitial. Nullable —
-- the UI falls back to generic guidance when an institution hasn't set
-- these yet. Nothing here is fabricated; it must be filled in by whoever
-- administers the institution.
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS counsellor_name  text,
  ADD COLUMN IF NOT EXISTS counsellor_phone text;

-- ============================================================================
-- crisis_escalations — one row per assessment that lands in the most
-- severe band. Logs that the interstitial was shown, whether the student
-- acknowledged it, and whether they asked to be connected to their campus
-- counsellor. The student holds the trigger: "requested_contact" is only
-- ever set true by the student's own button press.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crisis_escalations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id         uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution_id        uuid NOT NULL REFERENCES public.institutions(id),
  triggered_band        text NOT NULL,
  requested_contact     boolean NOT NULL DEFAULT false,
  requested_contact_at  timestamptz,
  acknowledged_at       timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  resolved_by           uuid REFERENCES public.profiles(id),
  resolved_at           timestamptz,
  resolution_notes      text
);

-- One escalation record per assessment — the app upserts on this.
CREATE UNIQUE INDEX IF NOT EXISTS uq_crisis_escalations_assessment
  ON public.crisis_escalations(assessment_id);

CREATE INDEX IF NOT EXISTS idx_crisis_escalations_institution
  ON public.crisis_escalations(institution_id);

ALTER TABLE public.crisis_escalations ENABLE ROW LEVEL SECURITY;

-- The student's own client inserts the trigger record (best-effort, from
-- the check-in page, the moment the acute band is computed).
DROP POLICY IF EXISTS "Students create own crisis record" ON public.crisis_escalations;
CREATE POLICY "Students create own crisis record" ON public.crisis_escalations
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
  );

-- Readable by the student themselves, their college officer, and the
-- regional/national tiers. NOT readable by clinician — per BUILD_PLAN
-- Phase 4, a clinician sees no student data, ever.
DROP POLICY IF EXISTS "Crisis record read access" ON public.crisis_escalations;
CREATE POLICY "Crisis record read access" ON public.crisis_escalations
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR (
      public.get_user_role() = 'college_officer'
      AND institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    )
    OR public.get_user_role() IN ('government_admin', 'super_admin')
  );

-- Both the student (acknowledge / request contact) and oversight tiers
-- (resolve) can UPDATE — but column-level enforcement is a trigger below,
-- because Postgres RLS cannot restrict columns on its own.
DROP POLICY IF EXISTS "Crisis record update access" ON public.crisis_escalations;
CREATE POLICY "Crisis record update access" ON public.crisis_escalations
  FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid()
    OR (
      public.get_user_role() = 'college_officer'
      AND institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    )
    OR public.get_user_role() IN ('government_admin', 'super_admin')
  )
  WITH CHECK (true);

-- No DELETE policy: append/update only, same as audit_logs.

CREATE OR REPLACE FUNCTION public.guard_crisis_escalation_columns()
RETURNS trigger AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF NEW.student_id = auth.uid() THEN
    -- The student may only ever set their own acknowledgement and contact
    -- request. They cannot rewrite what band triggered it or resolve it.
    NEW.assessment_id     := OLD.assessment_id;
    NEW.student_id        := OLD.student_id;
    NEW.institution_id    := OLD.institution_id;
    NEW.triggered_band    := OLD.triggered_band;
    NEW.resolved_by       := OLD.resolved_by;
    NEW.resolved_at       := OLD.resolved_at;
    NEW.resolution_notes  := OLD.resolution_notes;
  ELSIF caller_role IN ('college_officer', 'government_admin', 'super_admin') THEN
    -- Oversight tiers may only resolve; they cannot touch the student's
    -- own acknowledgement or contact-request state.
    NEW.assessment_id        := OLD.assessment_id;
    NEW.student_id           := OLD.student_id;
    NEW.institution_id       := OLD.institution_id;
    NEW.triggered_band       := OLD.triggered_band;
    NEW.requested_contact    := OLD.requested_contact;
    NEW.requested_contact_at := OLD.requested_contact_at;
    NEW.acknowledged_at      := OLD.acknowledged_at;
    NEW.resolved_by          := auth.uid();
    NEW.resolved_at          := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_crisis_escalation_columns ON public.crisis_escalations;
CREATE TRIGGER trg_guard_crisis_escalation_columns
  BEFORE UPDATE ON public.crisis_escalations
  FOR EACH ROW EXECUTE FUNCTION public.guard_crisis_escalation_columns();

-- ============================================================================
-- VERIFY — run these after applying.
-- ============================================================================
-- As a student, after completing an assessment that scores 'elevated':
--   insert into crisis_escalations (assessment_id, student_id, institution_id, triggered_band)
--     values (<own assessment id>, auth.uid(), <own institution_id>, 'elevated');
--     -> OK, one row
--   update crisis_escalations set resolved_by = auth.uid() where student_id = auth.uid();
--     -> resolved_by silently stays NULL (trigger reverts it)
--   update crisis_escalations set acknowledged_at = now() where student_id = auth.uid();
--     -> OK, acknowledged_at is set
--
-- As a clinician:
--   select * from crisis_escalations;             -> 0 rows (no policy grants it)
--
-- As a college_officer (own institution):
--   select * from crisis_escalations;              -> rows for their institution only
--   update crisis_escalations set resolution_notes='followed up' where id = <id>;
--     -> resolved_by/resolved_at auto-set to this officer, notes saved
--   update crisis_escalations set triggered_band='stable' where id = <id>;
--     -> triggered_band silently unchanged (trigger reverts it)
