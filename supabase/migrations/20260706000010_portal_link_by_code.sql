-- Função SECURITY DEFINER: vincula o usuário logado ao portal pelo access_code
-- Retorna o event_id em caso de sucesso, null se código inválido/já usado

create or replace function public.link_portal_by_code(p_code text)
returns uuid language plpgsql security definer as $$
declare
  v_portal_id uuid;
  v_event_id  uuid;
  v_company   uuid;
begin
  select cpa.id, cpa.event_id, e.company_id
    into v_portal_id, v_event_id, v_company
    from public.client_portal_access cpa
    join public.events e on e.id = cpa.event_id
   where upper(cpa.access_code) = upper(p_code)
     and cpa.user_id is null
     and cpa.enabled = true
   limit 1;

  if v_portal_id is null then return null; end if;

  update public.client_portal_access
     set user_id = auth.uid(), first_accessed_at = now()
   where id = v_portal_id;

  insert into public.user_roles(user_id, company_id, role)
  values (auth.uid(), v_company, 'client')
  on conflict (user_id, company_id) do nothing;

  return v_event_id;
end;
$$;

grant execute on function public.link_portal_by_code(text) to authenticated;
