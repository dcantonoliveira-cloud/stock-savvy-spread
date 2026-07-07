-- Garante unique constraint em user_roles(user_id, company_id)
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_company_id_key;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_company_id_key UNIQUE (user_id, company_id);

-- Recria a função usando INSERT seguro sem ON CONFLICT
CREATE OR REPLACE FUNCTION public.link_portal_by_code(p_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_portal_id uuid;
  v_event_id  uuid;
  v_company   uuid;
BEGIN
  SELECT cpa.id, cpa.event_id, e.company_id
    INTO v_portal_id, v_event_id, v_company
    FROM public.client_portal_access cpa
    JOIN public.events e ON e.id = cpa.event_id
   WHERE upper(cpa.access_code) = upper(p_code)
     AND cpa.user_id IS NULL
     AND cpa.enabled = true
   LIMIT 1;

  IF v_portal_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.client_portal_access
     SET user_id = auth.uid(), first_accessed_at = now()
   WHERE id = v_portal_id;

  -- Insere role somente se ainda não existir
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND company_id = v_company
  ) THEN
    INSERT INTO public.user_roles(user_id, company_id, role)
    VALUES (auth.uid(), v_company, 'client');
  END IF;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_portal_by_code(text) TO authenticated;
