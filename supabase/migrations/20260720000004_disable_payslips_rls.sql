-- Remove todas as políticas e desativa RLS nas tabelas de holerites
-- Só o supervisor envia holerites, não há necessidade de RLS aqui

ALTER TABLE public.payslips          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_versions  DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supervisors manage payslips"              ON public.payslips;
DROP POLICY IF EXISTS "Supervisors insert payslips"              ON public.payslips;
DROP POLICY IF EXISTS "Supervisors read update delete payslips"  ON public.payslips;
DROP POLICY IF EXISTS "Employees view own payslips"              ON public.payslips;
DROP POLICY IF EXISTS "Supervisors manage versions"              ON public.payslip_versions;
DROP POLICY IF EXISTS "Supervisors insert versions"              ON public.payslip_versions;
DROP POLICY IF EXISTS "Supervisors read update delete versions"  ON public.payslip_versions;
DROP POLICY IF EXISTS "Employees view own versions"              ON public.payslip_versions;
