-- ══════════════════════════════════════════════════════════════════
--  MULTI-TENANCY — company_id em todas as tabelas + RLS
--  Aplique via Supabase SQL Editor em:
--  https://supabase.com/dashboard/project/vfrtvnzptaazhzfirflm/sql
-- ══════════════════════════════════════════════════════════════════

-- ─── 1. Tabela companies ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  plan         TEXT NOT NULL DEFAULT 'starter',
  logo_url     TEXT,
  primary_color TEXT DEFAULT '#163D8A',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ─── 2. Adicionar company_id em todas as tabelas (nullable primeiro) ─
ALTER TABLE public.user_roles           ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.employee_permissions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.profiles             ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.app_notifications    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- CRM
ALTER TABLE public.clients              ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.events               ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.tastings             ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Estoque
ALTER TABLE public.stock_items          ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.stock_outputs        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.stock_entries        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.stock_transfers      ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.stock_price_history  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.stock_item_locations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.kitchens             ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.categories           ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.subcategories        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.tags                 ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_counts     ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_count_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_tokens     ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoices             ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Fichas técnicas & cardápios
ALTER TABLE public.technical_sheets     ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.technical_sheet_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.sheet_categories     ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.event_menus          ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.event_menu_dishes    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.event_menu_dish_items ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Materiais
ALTER TABLE public.material_categories  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.material_items       ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.material_loans       ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.material_loan_items  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- ─── 3. Inserir a empresa Rondello Buffet ────────────────────────────
INSERT INTO public.companies (id, name, slug, plan)
VALUES (gen_random_uuid(), 'Rondello Buffet', 'rondello', 'pro')
ON CONFLICT (slug) DO NOTHING;

-- ─── 4. Atualizar TODOS os registros existentes com o ID do Rondello ─
DO $$
DECLARE
  rondello_id UUID;
BEGIN
  SELECT id INTO rondello_id FROM public.companies WHERE slug = 'rondello';

  -- Usuários
  UPDATE public.user_roles           SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.employee_permissions SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.profiles             SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.app_notifications    SET company_id = rondello_id WHERE company_id IS NULL;

  -- CRM
  UPDATE public.clients              SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.events               SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.tastings             SET company_id = rondello_id WHERE company_id IS NULL;

  -- Estoque
  UPDATE public.stock_items          SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.stock_outputs        SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.stock_entries        SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.stock_transfers      SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.stock_price_history  SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.stock_item_locations SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.kitchens             SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.categories           SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.subcategories        SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.tags                 SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.inventory_counts     SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.inventory_count_items SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.inventory_tokens     SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.invoices             SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.invoice_items        SET company_id = rondello_id WHERE company_id IS NULL;

  -- Fichas & cardápios
  UPDATE public.technical_sheets     SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.technical_sheet_items SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.sheet_categories     SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.event_menus          SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.event_menu_dishes    SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.event_menu_dish_items SET company_id = rondello_id WHERE company_id IS NULL;

  -- Materiais
  UPDATE public.material_categories  SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.material_items       SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.material_loans       SET company_id = rondello_id WHERE company_id IS NULL;
  UPDATE public.material_loan_items  SET company_id = rondello_id WHERE company_id IS NULL;
END $$;

-- ─── 5. Função helper: retorna o company_id do usuário logado ─────────
CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ─── 6. Trigger para auto-preencher company_id nos inserts ───────────
-- Cada novo registro herda o company_id do usuário que está inserindo.
-- Isso elimina a necessidade de o frontend enviar company_id explicitamente.
CREATE OR REPLACE FUNCTION public.auto_set_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.my_company_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Aplica o trigger em cada tabela de dados
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'clients','events','tastings',
    'stock_items','stock_outputs','stock_entries','stock_transfers',
    'stock_price_history','stock_item_locations',
    'kitchens','categories','subcategories','tags',
    'inventory_counts','inventory_count_items',
    'invoices','invoice_items',
    'technical_sheets','technical_sheet_items','sheet_categories',
    'event_menus','event_menu_dishes','event_menu_dish_items',
    'material_categories','material_items','material_loans','material_loan_items',
    'app_notifications'
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

-- ─── 7. RLS Policies ─────────────────────────────────────────────────
-- Padrão: usuário vê SOMENTE dados da sua empresa.
-- Usamos a função my_company_id() para o filtro.

-- companies: membros veem sua própria empresa
DROP POLICY IF EXISTS "Members see own company" ON public.companies;
CREATE POLICY "Members see own company" ON public.companies
  FOR SELECT USING (id = public.my_company_id());

DROP POLICY IF EXISTS "Members update own company" ON public.companies;
CREATE POLICY "Members update own company" ON public.companies
  FOR UPDATE USING (id = public.my_company_id());

-- Macro para cada tabela de dados
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'clients','events','tastings',
    'stock_items','stock_outputs','stock_entries','stock_transfers',
    'stock_price_history','stock_item_locations',
    'kitchens','categories','subcategories','tags',
    'inventory_counts','inventory_count_items',
    'invoices','invoice_items',
    'technical_sheets','technical_sheet_items','sheet_categories',
    'event_menus','event_menu_dishes','event_menu_dish_items',
    'material_categories','material_items','material_loans','material_loan_items',
    'app_notifications','employee_permissions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation %I" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Tenant isolation %I" ON public.%I
       FOR ALL USING (company_id = public.my_company_id())
       WITH CHECK (company_id = public.my_company_id())',
      tbl, tbl
    );
  END LOOP;
END $$;

-- user_roles: usuário vê roles da sua empresa, ou o próprio role
DROP POLICY IF EXISTS "Tenant isolation user_roles" ON public.user_roles;
CREATE POLICY "Tenant isolation user_roles" ON public.user_roles
  FOR ALL USING (
    company_id = public.my_company_id()
    OR user_id = auth.uid()
  )
  WITH CHECK (company_id = public.my_company_id());

-- profiles: cada um vê só o próprio perfil (já existia) + supervisores da empresa
DROP POLICY IF EXISTS "Tenant isolation profiles" ON public.profiles;
CREATE POLICY "Tenant isolation profiles" ON public.profiles
  FOR ALL USING (
    id = auth.uid()
    OR company_id = public.my_company_id()
  );

-- ─── 8. Atualizar trigger de novo usuário para não quebrar ────────────
-- Após a migration, company_id em user_roles é nullable.
-- Novos usuários ficam sem empresa até serem convidados/associados.
-- O trigger existente (handle_new_user_role) já tem ON CONFLICT DO NOTHING,
-- não precisa alterar.
