-- ── Corrige isolamento RLS do portal do cliente ───────────────────────────────
-- Problema: policies de tenant isolam por empresa mas não por evento do cliente.
-- Um cliente autenticado poderia consultar a API Supabase diretamente e ver
-- dados de outros eventos/clientes da mesma empresa.

-- ── 1. client_portal_access ───────────────────────────────────────────────────
-- Antes: qualquer user da empresa via my_company_id()
-- Depois: supervisores veem todos da empresa; clientes só o próprio registro

DROP POLICY IF EXISTS "Tenant isolation client_portal_access" ON public.client_portal_access;

CREATE POLICY "Portal access read isolation"
  ON public.client_portal_access FOR SELECT
  USING (
    -- Supervisores/admins: acesso total da empresa
    (company_id = public.my_company_id()
     AND EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid() AND role <> 'client'
     ))
    OR
    -- Clientes: apenas o próprio registro
    user_id = auth.uid()
  );

-- Manter policies de INSERT/UPDATE/DELETE intactas (já existem ou são gerenciadas por funções)

-- ── 2. event_payments ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation event_payments" ON public.event_payments;

CREATE POLICY "Event payments isolation"
  ON public.event_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.company_id = public.my_company_id()
    )
    AND (
      -- Não é cliente: acesso total da empresa
      NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'client'
      )
      OR
      -- É cliente: apenas evento vinculado ao seu portal
      EXISTS (
        SELECT 1 FROM public.client_portal_access
        WHERE user_id = auth.uid() AND event_id = event_payments.event_id
      )
    )
  );

-- ── 3. event_additional_values ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation event_additional_values" ON public.event_additional_values;

CREATE POLICY "Event additional values isolation"
  ON public.event_additional_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.company_id = public.my_company_id()
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'client'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.client_portal_access
        WHERE user_id = auth.uid() AND event_id = event_additional_values.event_id
      )
    )
  );

-- ── 4. event_files ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation event_files" ON public.event_files;

CREATE POLICY "Event files isolation"
  ON public.event_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.company_id = public.my_company_id()
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'client'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.client_portal_access
        WHERE user_id = auth.uid() AND event_id = event_files.event_id
      )
    )
  );

-- ── 5. events — supervisores têm acesso total; clientes só veem o próprio evento
DROP POLICY IF EXISTS "Tenant isolation events" ON public.events;
DROP POLICY IF EXISTS "Events isolation"        ON public.events;

-- SELECT: supervisores veem todos da empresa; clientes só o próprio
CREATE POLICY "Events select isolation"
  ON public.events FOR SELECT
  USING (
    company_id = public.my_company_id()
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'client'
      )
      OR
      EXISTS (
        SELECT 1 FROM public.client_portal_access
        WHERE user_id = auth.uid() AND event_id = events.id
      )
    )
  );

-- INSERT / UPDATE / DELETE: apenas supervisores (não clientes)
CREATE POLICY "Events insert"
  ON public.events FOR INSERT
  WITH CHECK (
    company_id = public.my_company_id()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "Events update"
  ON public.events FOR UPDATE
  USING (
    company_id = public.my_company_id()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "Events delete"
  ON public.events FOR DELETE
  USING (
    company_id = public.my_company_id()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );
