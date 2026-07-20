-- Corrige RLS de holerites: supervisor pode tudo, funcionário só vê o próprio
-- Problema anterior: FOR ALL sem WITH CHECK explícito quebrava upserts (bulk upload)

DROP POLICY IF EXISTS "Supervisors manage payslips"             ON public.payslips;
DROP POLICY IF EXISTS "Supervisors insert payslips"             ON public.payslips;
DROP POLICY IF EXISTS "Supervisors read update delete payslips" ON public.payslips;
DROP POLICY IF EXISTS "Employees view own payslips"             ON public.payslips;
DROP POLICY IF EXISTS "Supervisors manage versions"             ON public.payslip_versions;
DROP POLICY IF EXISTS "Supervisors insert versions"             ON public.payslip_versions;
DROP POLICY IF EXISTS "Supervisors read update delete versions" ON public.payslip_versions;
DROP POLICY IF EXISTS "Employees view own versions"             ON public.payslip_versions;

-- INSERT separado com WITH CHECK para upserts funcionarem corretamente
CREATE POLICY "supervisor_insert_payslips"
  ON public.payslips FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "supervisor_all_payslips"
  ON public.payslips FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "employee_view_own_payslips"
  ON public.payslips FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "supervisor_insert_versions"
  ON public.payslip_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "supervisor_all_versions"
  ON public.payslip_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "employee_view_own_versions"
  ON public.payslip_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payslips p
    WHERE p.id = payslip_id AND p.employee_id = auth.uid()
  ));
