-- Fix payslips RLS: add explicit WITH CHECK so INSERT is clearly allowed for supervisors.
-- The previous policy used FOR ALL with only USING, which PostgreSQL applies as WITH CHECK
-- for INSERT too — but only evaluates correctly if has_role() returns true.
-- This rewrite is explicit and also fixes payslip_versions WITH CHECK.

-- ── payslips ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Supervisors manage payslips" ON public.payslips;
CREATE POLICY "Supervisors manage payslips"
  ON public.payslips FOR ALL TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'supervisor')
  );

-- ── payslip_versions ────────────────────────────────────────
DROP POLICY IF EXISTS "Supervisors manage versions" ON public.payslip_versions;
CREATE POLICY "Supervisors manage versions"
  ON public.payslip_versions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payslips p
    WHERE p.id = payslip_id
      AND p.company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
      AND public.has_role(auth.uid(), 'supervisor')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payslips p
    WHERE p.id = payslip_id
      AND p.company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
      AND public.has_role(auth.uid(), 'supervisor')
  ));

-- ── Ensure the supervisor user has the supervisor role in user_roles ────
-- If the supervisor was created before the role system existed, they won't be in user_roles.
-- This inserts their role safely (ON CONFLICT DO NOTHING avoids duplicates).
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'supervisor'::public.app_role
FROM public.profiles p
WHERE p.email = 'douglas@rondellobuffet.com.br'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id AND ur.role = 'supervisor'
  );
