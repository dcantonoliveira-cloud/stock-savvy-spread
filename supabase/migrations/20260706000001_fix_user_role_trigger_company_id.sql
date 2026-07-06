-- Corrige o trigger de criação de user_roles para incluir company_id automaticamente.
-- Sem isso, usuários criados após a migration multi-tenant ficam com company_id NULL
-- e o RLS bloqueia todos os dados para eles.
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_company_id UUID;
BEGIN
  -- Pega o company_id da empresa padrão (única empresa no sistema por enquanto)
  SELECT id INTO default_company_id FROM public.companies LIMIT 1;

  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (NEW.id, 'employee', default_company_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
