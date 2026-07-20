-- Fix payslips RLS: replace has_role() (checks user_roles table) with app_role check
-- on profiles, which is the authoritative role source in this system.

-- ── payslips ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Supervisors manage payslips" ON public.payslips;
CREATE POLICY "Supervisors manage payslips"
  ON public.payslips FOR ALL TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND (SELECT app_role FROM public.profiles WHERE user_id = auth.uid()) = 'supervisor'
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND (SELECT app_role FROM public.profiles WHERE user_id = auth.uid()) = 'supervisor'
  );

-- ── payslip_versions ────────────────────────────────────────
DROP POLICY IF EXISTS "Supervisors manage versions" ON public.payslip_versions;
CREATE POLICY "Supervisors manage versions"
  ON public.payslip_versions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payslips p
    JOIN public.profiles pr ON pr.user_id = auth.uid()
    WHERE p.id = payslip_id
      AND p.company_id = pr.company_id
      AND pr.app_role = 'supervisor'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payslips p
    JOIN public.profiles pr ON pr.user_id = auth.uid()
    WHERE p.id = payslip_id
      AND p.company_id = pr.company_id
      AND pr.app_role = 'supervisor'
  ));

-- ── storage: payslips bucket ────────────────────────────────
DROP POLICY IF EXISTS "Supervisors upload payslips" ON storage.objects;
CREATE POLICY "Supervisors upload payslips"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payslips'
    AND (SELECT app_role FROM public.profiles WHERE user_id = auth.uid()) = 'supervisor'
  );
