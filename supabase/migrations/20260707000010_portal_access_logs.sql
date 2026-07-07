-- ── Tabela de logs de acesso ao portal do cliente ─────────────────────────
CREATE TABLE IF NOT EXISTS public.portal_access_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id    uuid REFERENCES public.client_portal_access(id) ON DELETE CASCADE,
  event_id     uuid REFERENCES public.events(id) ON DELETE CASCADE,
  company_id   uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  page         text NOT NULL,  -- 'inicio' | 'financeiro' | 'arquivos' | 'informacoes'
  accessed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_access_logs_event_id_idx    ON public.portal_access_logs(event_id);
CREATE INDEX IF NOT EXISTS portal_access_logs_company_id_idx  ON public.portal_access_logs(company_id);
CREATE INDEX IF NOT EXISTS portal_access_logs_accessed_at_idx ON public.portal_access_logs(accessed_at DESC);

-- RLS: só a empresa dona pode ler os logs
ALTER TABLE public.portal_access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company reads own portal logs"
  ON public.portal_access_logs FOR SELECT
  USING (company_id = (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1));

-- Clientes podem inserir seus próprios logs (SECURITY DEFINER para não precisar de RLS complexo)
CREATE OR REPLACE FUNCTION public.log_portal_access(p_page text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_portal  record;
BEGIN
  SELECT id, event_id, company_id INTO v_portal
    FROM public.client_portal_access
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_portal IS NULL THEN RETURN; END IF;

  INSERT INTO public.portal_access_logs(portal_id, event_id, company_id, page)
  VALUES (v_portal.id, v_portal.event_id, v_portal.company_id, p_page);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_portal_access(text) TO authenticated;

-- ── Notificação quando cliente vincula o portal ────────────────────────────
CREATE OR REPLACE FUNCTION public.notif_portal_client_linked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_company  uuid;
  v_name     text;
  v_event    text;
BEGIN
  -- Só dispara quando user_id muda de null para um valor (primeira vinculação)
  IF OLD.user_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT e.company_id, coalesce(c.name, 'Cliente'), e.event_name
      INTO v_company, v_name, v_event
      FROM public.events e
      LEFT JOIN public.clients c ON c.id = e.client_id
     WHERE e.id = NEW.event_id;

    INSERT INTO public.app_notifications(type, title, message, data, company_id)
    VALUES (
      'portal_client_linked',
      'Cliente acessou o portal',
      v_name || ' vinculou o acesso ao evento ' || coalesce(v_event, ''),
      jsonb_build_object('link', '/crm/clients', 'event_id', NEW.event_id),
      v_company
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_portal_client_linked ON public.client_portal_access;
CREATE TRIGGER trg_notif_portal_client_linked
  AFTER UPDATE ON public.client_portal_access
  FOR EACH ROW EXECUTE FUNCTION public.notif_portal_client_linked();
