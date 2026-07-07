-- Adiciona o trigger auto_set_company_id nas tabelas que ficaram de fora
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'event_locations', 'event_products', 'suppliers',
    'event_field_definitions', 'annex_models'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_company_%I ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_auto_company_%I
       BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id()',
      tbl, tbl
    );
  END LOOP;
END $$;
