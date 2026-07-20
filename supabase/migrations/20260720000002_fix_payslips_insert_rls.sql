-- Separar política FOR ALL em políticas individuais para resolver ambiguidade
-- do PostgreSQL no upsert (INSERT...ON CONFLICT DO UPDATE) com apenas USING.
-- O comportamento do FOR ALL sem WITH CHECK explícito pode ser imprevisível
-- em upserts — políticas separadas por operação são mais confiáveis.

-- payslips
DROP POLICY IF EXISTS "Supervisors manage payslips" ON public.payslips;
DROP POLICY IF EXISTS "Supervisors insert payslips" ON public.payslips;
DROP POLICY IF EXISTS "Supervisors read update delete payslips" ON public.payslips;

-- INSERT: só precisa ser supervisor (company_id é controlado pelo app)
CREATE POLICY "Supervisors insert payslips"
  ON public.payslips FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

-- SELECT / UPDATE / DELETE: exige company_id correto
CREATE POLICY "Supervisors read update delete payslips"
  ON public.payslips FOR ALL TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'supervisor')
  );

-- payslip_versions: mesma separação
DROP POLICY IF EXISTS "Supervisors manage versions" ON public.payslip_versions;
DROP POLICY IF EXISTS "Supervisors insert versions" ON public.payslip_versions;
DROP POLICY IF EXISTS "Supervisors read update delete versions" ON public.payslip_versions;

CREATE POLICY "Supervisors insert versions"
  ON public.payslip_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors read update delete versions"
  ON public.payslip_versions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payslips p
    WHERE p.id = payslip_id
      AND p.company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
      AND public.has_role(auth.uid(), 'supervisor')
  ));
