-- ══════════════════════════════════════════════════════════════════
--  CAMPOS LINKADOS + CAMPOS CUSTOMIZÁVEIS DE EVENTO
--  Aplique via Supabase SQL Editor em:
--  https://supabase.com/dashboard/project/vfrtvnzptaazhzfirflm/sql
-- ══════════════════════════════════════════════════════════════════

-- ─── 1. Locais de evento ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.event_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_locations" ON public.event_locations;
CREATE POLICY "Tenant isolation event_locations" ON public.event_locations
  FOR ALL USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

-- ─── 2. Produtos / Pacotes ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.event_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_products" ON public.event_products;
CREATE POLICY "Tenant isolation event_products" ON public.event_products
  FOR ALL USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

-- ─── 3. Fornecedores (organizer, decorator, etc.) ───────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL, -- organizer | decorator | pastry_chef | photo_video | bartender | band_dj | other
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation suppliers" ON public.suppliers;
CREATE POLICY "Tenant isolation suppliers" ON public.suppliers
  FOR ALL USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

-- ─── 4. FKs nos eventos ──────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS location_id   UUID REFERENCES public.event_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id    UUID REFERENCES public.event_products(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organizer_id  UUID REFERENCES public.suppliers(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decorator_id  UUID REFERENCES public.suppliers(id)       ON DELETE SET NULL;

-- ─── 5. Campos customizáveis por empresa ─────────────────────────
CREATE TABLE IF NOT EXISTS public.event_field_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.event_field_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_field_definitions" ON public.event_field_definitions;
CREATE POLICY "Tenant isolation event_field_definitions" ON public.event_field_definitions
  FOR ALL USING (company_id = public.my_company_id())
  WITH CHECK (company_id = public.my_company_id());

-- ─── 6. Valores dos campos customizáveis ────────────────────────
CREATE TABLE IF NOT EXISTS public.event_field_values (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  field_id     UUID NOT NULL REFERENCES public.event_field_definitions(id) ON DELETE CASCADE,
  value        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, field_id)
);
ALTER TABLE public.event_field_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation event_field_values" ON public.event_field_values;
CREATE POLICY "Tenant isolation event_field_values" ON public.event_field_values
  FOR ALL USING (
    event_id IN (SELECT id FROM public.events WHERE company_id = public.my_company_id())
  )
  WITH CHECK (
    event_id IN (SELECT id FROM public.events WHERE company_id = public.my_company_id())
  );

-- ─── 7. Seed: campos padrão do Rondello ─────────────────────────
DO $$
DECLARE rondello_id UUID;
BEGIN
  SELECT id INTO rondello_id FROM public.companies WHERE slug = 'rondello';
  IF rondello_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.event_field_definitions (company_id, name, sort_order) VALUES
    (rondello_id, 'Coquetel de boas-vindas', 10),
    (rondello_id, 'Vinho',                   20),
    (rondello_id, 'Whisky',                  30),
    (rondello_id, 'Cerveja',                 40),
    (rondello_id, 'Porta guardanapo',         50),
    (rondello_id, 'Toalha',                  60),
    (rondello_id, 'Rechaud',                 70),
    (rondello_id, 'Sousplát',               80),
    (rondello_id, 'Aparador',               90),
    (rondello_id, 'Taça',                   100),
    (rondello_id, 'Sala dos noivos',         110),
    (rondello_id, 'Espaço kids',             120),
    (rondello_id, 'Qtd. de mesas',           130),
    (rondello_id, 'Convidados por mesa',      140),
    (rondello_id, 'Local mesa do bolo',       150),
    (rondello_id, 'Horário Banda/DJ',         160)
  ON CONFLICT DO NOTHING;
END $$;
