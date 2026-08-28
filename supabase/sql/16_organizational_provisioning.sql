-- ============================================================================
-- NSWEIS · 16_organizational_provisioning.sql
-- PHASE 12: Organizational Account Provisioning & Role Hierarchy
-- Idempotent, safe to re-run.
-- ============================================================================

-- 1. Ensure 'regional_officer' enum value exists on user_role
DO $$
BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'regional_officer';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Regions Table
CREATE TABLE IF NOT EXISTS public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Regions are readable by authenticated users" ON public.regions;
CREATE POLICY "Regions are readable by authenticated users" ON public.regions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Regions manage by government and super admin" ON public.regions;
CREATE POLICY "Regions manage by government and super admin" ON public.regions
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('government_admin', 'super_admin'))
  WITH CHECK (public.get_user_role() IN ('government_admin', 'super_admin'));

-- Seed default initial regions if empty
INSERT INTO public.regions (name, code, status)
VALUES
  ('National Jurisdiction', 'NAT01', 'active'),
  ('Northern Region', 'NORTH01', 'active'),
  ('Southern Region', 'SOUTH01', 'active'),
  ('Western Region', 'WEST01', 'active'),
  ('Eastern Region', 'EAST01', 'active')
ON CONFLICT (code) DO NOTHING;

-- 3. Extend public.institutions with region linkage
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES public.regions(id),
  ADD COLUMN IF NOT EXISTS region_code TEXT DEFAULT 'NAT01';

-- Update existing institutions to default region if not set
UPDATE public.institutions
SET region_id = (SELECT id FROM public.regions WHERE code = 'NAT01' LIMIT 1)
WHERE region_id IS NULL;

-- 4. Extend public.profiles with regional scope and administrative management ownership
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES public.regions(id),
  ADD COLUMN IF NOT EXISTS region_code TEXT DEFAULT 'NAT01',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- 5. Academic Structure Tables (Configured by College Officers)

-- Academic Years
CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  year_level INT NOT NULL,
  label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, year_level)
);

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Academic years readable by all authenticated" ON public.academic_years;
CREATE POLICY "Academic years readable by all authenticated" ON public.academic_years
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "College officers manage own institution academic years" ON public.academic_years;
CREATE POLICY "College officers manage own institution academic years" ON public.academic_years
  FOR ALL TO authenticated
  USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR public.get_user_role() IN ('super_admin', 'government_admin')
  )
  WITH CHECK (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR public.get_user_role() IN ('super_admin', 'government_admin')
  );

-- Academic Sections
CREATE TABLE IF NOT EXISTS public.academic_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  year_level INT,
  section_code TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, department_id, year_level, section_code)
);

ALTER TABLE public.academic_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Academic sections readable by all authenticated" ON public.academic_sections;
CREATE POLICY "Academic sections readable by all authenticated" ON public.academic_sections
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "College officers manage own institution academic sections" ON public.academic_sections;
CREATE POLICY "College officers manage own institution academic sections" ON public.academic_sections
  FOR ALL TO authenticated
  USING (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR public.get_user_role() IN ('super_admin', 'government_admin')
  )
  WITH CHECK (
    institution_id = (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    OR public.get_user_role() IN ('super_admin', 'government_admin')
  );

-- 6. Provisioning Audit Logs
CREATE TABLE IF NOT EXISTS public.account_provisioning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  target_user_id UUID NOT NULL REFERENCES public.profiles(id),
  target_email TEXT NOT NULL,
  target_role public.user_role NOT NULL,
  institution_id UUID REFERENCES public.institutions(id),
  region_id UUID REFERENCES public.regions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_provisioning_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Provisioning logs visible to administrators" ON public.account_provisioning_logs;
CREATE POLICY "Provisioning logs visible to administrators" ON public.account_provisioning_logs
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'government_admin', 'regional_officer'));

DROP POLICY IF EXISTS "Provisioning logs insertable by creator" ON public.account_provisioning_logs;
CREATE POLICY "Provisioning logs insertable by creator" ON public.account_provisioning_logs
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

COMMENT ON TABLE public.regions IS 'Geographic and jurisdictional administrative regions for NSWEIS.';
COMMENT ON TABLE public.academic_years IS 'Institution-specific configured academic year levels.';
COMMENT ON TABLE public.academic_sections IS 'Institution-specific configured academic sections by department and year.';
COMMENT ON TABLE public.account_provisioning_logs IS 'Audit record of organizational account creation by authorized parent roles.';
