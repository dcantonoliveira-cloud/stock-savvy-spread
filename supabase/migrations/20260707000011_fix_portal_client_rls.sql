-- ── Corrige isolamento RLS do portal do cliente ───────────────────────────────
-- Supervisores mantêm acesso total (SELECT/INSERT/UPDATE/DELETE).
-- Clientes (role='client') ficam restritos ao próprio evento no SELECT.
-- INSERT/UPDATE/DELETE são bloqueados para clientes em todas as tabelas.

-- Helper: verifica se o usuário atual é cliente
-- (evita repetição nas policies)

-- ── 1. client_portal_access ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation client_portal_access"  ON public.client_portal_access;
DROP POLICY IF EXISTS "Portal access read isolation"           ON public.client_portal_access;

-- SELECT: supervisores veem todos da empresa; clientes só o próprio
CREATE POLICY "client_portal_access select"
  ON public.client_portal_access FOR SELECT
  USING (
    (company_id = public.my_company_id()
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client'))
    OR user_id = auth.uid()
  );

-- INSERT/UPDATE/DELETE: só supervisores
CREATE POLICY "client_portal_access insert"
  ON public.client_portal_access FOR INSERT
  WITH CHECK (
    company_id = public.my_company_id()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "client_portal_access update"
  ON public.client_portal_access FOR UPDATE
  USING (
    company_id = public.my_company_id()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "client_portal_access delete"
  ON public.client_portal_access FOR DELETE
  USING (
    company_id = public.my_company_id()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

-- ── 2. event_payments ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation event_payments" ON public.event_payments;
DROP POLICY IF EXISTS "Event payments isolation"        ON public.event_payments;

CREATE POLICY "event_payments select"
  ON public.event_payments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND (
      NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
      OR EXISTS (SELECT 1 FROM public.client_portal_access WHERE user_id = auth.uid() AND event_id = event_payments.event_id)
    )
  );

CREATE POLICY "event_payments insert"
  ON public.event_payments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "event_payments update"
  ON public.event_payments FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "event_payments delete"
  ON public.event_payments FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

-- ── 3. event_additional_values ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation event_additional_values" ON public.event_additional_values;
DROP POLICY IF EXISTS "Event additional values isolation"        ON public.event_additional_values;

CREATE POLICY "event_additional_values select"
  ON public.event_additional_values FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND (
      NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
      OR EXISTS (SELECT 1 FROM public.client_portal_access WHERE user_id = auth.uid() AND event_id = event_additional_values.event_id)
    )
  );

CREATE POLICY "event_additional_values insert"
  ON public.event_additional_values FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "event_additional_values update"
  ON public.event_additional_values FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "event_additional_values delete"
  ON public.event_additional_values FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

-- ── 4. event_files ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation event_files" ON public.event_files;
DROP POLICY IF EXISTS "Event files isolation"        ON public.event_files;

CREATE POLICY "event_files select"
  ON public.event_files FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND (
      NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
      OR EXISTS (SELECT 1 FROM public.client_portal_access WHERE user_id = auth.uid() AND event_id = event_files.event_id)
    )
  );

CREATE POLICY "event_files insert"
  ON public.event_files FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "event_files update"
  ON public.event_files FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "event_files delete"
  ON public.event_files FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.company_id = public.my_company_id())
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

-- ── 5. events ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation events"  ON public.events;
DROP POLICY IF EXISTS "Events isolation"         ON public.events;
DROP POLICY IF EXISTS "Events select isolation"  ON public.events;
DROP POLICY IF EXISTS "Events insert"            ON public.events;
DROP POLICY IF EXISTS "Events update"            ON public.events;
DROP POLICY IF EXISTS "Events delete"            ON public.events;

CREATE POLICY "events select"
  ON public.events FOR SELECT
  USING (
    company_id = public.my_company_id()
    AND (
      NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
      OR EXISTS (SELECT 1 FROM public.client_portal_access WHERE user_id = auth.uid() AND event_id = events.id)
    )
  );

CREATE POLICY "events insert"
  ON public.events FOR INSERT
  WITH CHECK (
    company_id = public.my_company_id()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "events update"
  ON public.events FOR UPDATE
  USING (
    company_id = public.my_company_id()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

CREATE POLICY "events delete"
  ON public.events FOR DELETE
  USING (
    company_id = public.my_company_id()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
  );

-- ── client_portal_access: UPDATE especial para função link_portal_by_code ─────
-- A função link_portal_by_code é SECURITY DEFINER, então não precisa de policy
-- adicional — ela já bypassa o RLS. Sem mudança necessária aqui.
