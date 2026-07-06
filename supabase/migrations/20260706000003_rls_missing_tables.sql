-- ══════════════════════════════════════════════════════════════════
--  RLS — tabelas sem isolamento de tenant
--
--  Contexto: a migration multi_tenant (20260623100000) cobriu os
--  módulos principais, mas diversas tabelas criadas antes ou depois
--  ficaram sem RLS. Usuários com company_id NULL (ou de outra empresa)
--  podiam ver/editar dados de outros tenants.
--
--  Execute no Supabase SQL Editor:
--  https://supabase.com/dashboard/project/vfrtvnzptaazhzfirflm/sql
-- ══════════════════════════════════════════════════════════════════

-- ─── 1. tasting_sessions ─────────────────────────────────────────
-- Não estava na migration multi_tenant — sem company_id, sem RLS.

ALTER TABLE public.tasting_sessions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Popula via eventos linkados
UPDATE public.tasting_sessions ts
SET company_id = e.company_id
FROM public.tasting_session_events tse
JOIN public.events e ON e.id = tse.event_id
WHERE tse.tasting_session_id = ts.id
  AND ts.company_id IS NULL;

-- Fallback: sessões sem eventos linkados → empresa padrão
UPDATE public.tasting_sessions
SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
WHERE company_id IS NULL;

ALTER TABLE public.tasting_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation tasting_sessions" ON public.tasting_sessions;
CREATE POLICY "Tenant isolation tasting_sessions" ON public.tasting_sessions
  FOR ALL USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

-- ─── 2. tasting_session_events ────────────────────────────────────
ALTER TABLE public.tasting_session_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation tasting_session_events" ON public.tasting_session_events;
CREATE POLICY "Tenant isolation tasting_session_events" ON public.tasting_session_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasting_sessions ts
      WHERE ts.id = tasting_session_id
        AND ts.company_id = public.my_company_id()
    )
  );

-- ─── 3. Tabelas filho de events ───────────────────────────────────
-- Protegidas via EXISTS no pai (events já tem RLS por company_id).

ALTER TABLE public.event_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_files" ON public.event_files;
CREATE POLICY "Tenant isolation event_files" ON public.event_files
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
  );

ALTER TABLE public.event_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_history" ON public.event_history;
CREATE POLICY "Tenant isolation event_history" ON public.event_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
  );

ALTER TABLE public.event_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_checklist_items" ON public.event_checklist_items;
CREATE POLICY "Tenant isolation event_checklist_items" ON public.event_checklist_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
  );

ALTER TABLE public.event_separation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_separation_items" ON public.event_separation_items;
CREATE POLICY "Tenant isolation event_separation_items" ON public.event_separation_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
  );

ALTER TABLE public.event_stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_stock_movements" ON public.event_stock_movements;
CREATE POLICY "Tenant isolation event_stock_movements" ON public.event_stock_movements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
  );

ALTER TABLE public.event_additional_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_additional_values" ON public.event_additional_values;
CREATE POLICY "Tenant isolation event_additional_values" ON public.event_additional_values
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
  );

ALTER TABLE public.event_menu_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_menu_sheets" ON public.event_menu_sheets;
CREATE POLICY "Tenant isolation event_menu_sheets" ON public.event_menu_sheets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
  );

ALTER TABLE public.event_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_payments" ON public.event_payments;
CREATE POLICY "Tenant isolation event_payments" ON public.event_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
  );

-- ─── 4. Tabelas standalone sem company_id ─────────────────────────

-- annex_models
ALTER TABLE public.annex_models
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.annex_models
  SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
  WHERE company_id IS NULL;
ALTER TABLE public.annex_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation annex_models" ON public.annex_models;
CREATE POLICY "Tenant isolation annex_models" ON public.annex_models
  FOR ALL USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

-- contract_templates
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.contract_templates
  SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
  WHERE company_id IS NULL;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation contract_templates" ON public.contract_templates;
CREATE POLICY "Tenant isolation contract_templates" ON public.contract_templates
  FOR ALL USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

-- checklist_templates
ALTER TABLE public.checklist_templates
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.checklist_templates
  SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
  WHERE company_id IS NULL;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation checklist_templates" ON public.checklist_templates;
CREATE POLICY "Tenant isolation checklist_templates" ON public.checklist_templates
  FOR ALL USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

-- checklist_template_items (filho de checklist_templates via template_id)
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation checklist_template_items" ON public.checklist_template_items;
CREATE POLICY "Tenant isolation checklist_template_items" ON public.checklist_template_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.checklist_templates ct
      WHERE ct.id = template_id AND ct.company_id = public.my_company_id()
    )
  );

-- client_portal_access
ALTER TABLE public.client_portal_access
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.client_portal_access
  SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
  WHERE company_id IS NULL;
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation client_portal_access" ON public.client_portal_access;
CREATE POLICY "Tenant isolation client_portal_access" ON public.client_portal_access
  FOR ALL USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

-- material_base_list
ALTER TABLE public.material_base_list
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.material_base_list
  SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
  WHERE company_id IS NULL;
ALTER TABLE public.material_base_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation material_base_list" ON public.material_base_list;
CREATE POLICY "Tenant isolation material_base_list" ON public.material_base_list
  FOR ALL USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

-- material_inventory_losses
ALTER TABLE public.material_inventory_losses
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.material_inventory_losses
  SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
  WHERE company_id IS NULL;
ALTER TABLE public.material_inventory_losses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation material_inventory_losses" ON public.material_inventory_losses;
CREATE POLICY "Tenant isolation material_inventory_losses" ON public.material_inventory_losses
  FOR ALL USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

-- ─── 5. Tabelas filho sem company_id próprio ──────────────────────

-- item_suppliers (filho de stock_items via item_id)
ALTER TABLE public.item_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation item_suppliers" ON public.item_suppliers;
CREATE POLICY "Tenant isolation item_suppliers" ON public.item_suppliers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stock_items si
      WHERE si.id = item_id AND si.company_id = public.my_company_id()
    )
  );

-- technical_sheet_aliases (filho de technical_sheets via sheet_id)
ALTER TABLE public.technical_sheet_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation technical_sheet_aliases" ON public.technical_sheet_aliases;
CREATE POLICY "Tenant isolation technical_sheet_aliases" ON public.technical_sheet_aliases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.technical_sheets ts
      WHERE ts.id = sheet_id AND ts.company_id = public.my_company_id()
    )
  );

-- ─── 6. Corrige o trigger de criação de user_roles ────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_company_id UUID;
BEGIN
  SELECT id INTO default_company_id FROM public.companies ORDER BY created_at LIMIT 1;
  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (NEW.id, 'employee', default_company_id)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── 7. Corrige usuários existentes com company_id NULL ───────────
-- Maristela, Larissa, Andreia e quaisquer outros criados após multi_tenant.
-- Só é seguro rodar DEPOIS que RLS estiver ativo nas tabelas acima.

UPDATE public.user_roles
SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
WHERE company_id IS NULL;

UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
WHERE company_id IS NULL;
