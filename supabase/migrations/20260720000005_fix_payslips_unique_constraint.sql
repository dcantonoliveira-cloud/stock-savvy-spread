-- Corrige a constraint única de holerites para incluir o título (tipo do holerite).
-- Sem isso, "Pagamento" e "Adiantamento" do mesmo mês conflitam e se sobrescrevem.

-- Dropar qualquer constraint UNIQUE existente na tabela payslips
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'payslips'
      AND constraint_type = 'UNIQUE'
      AND table_schema = 'public'
  LOOP
    EXECUTE 'ALTER TABLE public.payslips DROP CONSTRAINT ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

-- Nova constraint: permite múltiplos tipos (Pagamento, Adiantamento, etc.) no mesmo mês
ALTER TABLE public.payslips
ADD CONSTRAINT payslips_company_employee_month_title_key
UNIQUE (company_id, employee_id, reference_month, title);

-- Reparar dados corrompidos: holerites com assinatura que voltaram para 'published'
-- (o upsert de Adiantamento sobrescreveu Pagamentos que já estavam assinados)
UPDATE public.payslips
SET
  status = 'signed',
  title  = REPLACE(title, 'Adiantamento ', 'Pagamento ')
WHERE status = 'published'
AND EXISTS (
  SELECT 1 FROM public.electronic_signatures es WHERE es.payslip_id = id
);
