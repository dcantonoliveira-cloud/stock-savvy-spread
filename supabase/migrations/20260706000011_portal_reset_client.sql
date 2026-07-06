-- Reseta o acesso do cliente ao portal:
-- 1. Desvincula user_id do client_portal_access
-- 2. Remove o user_role 'client' do usuário

create or replace function public.reset_portal_client(p_portal_id uuid)
returns void language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_company uuid;
begin
  select cpa.user_id, e.company_id
    into v_user_id, v_company
    from public.client_portal_access cpa
    join public.events e on e.id = cpa.event_id
   where cpa.id = p_portal_id;

  if v_user_id is null then return; end if;

  -- Desvincula do portal
  update public.client_portal_access
     set user_id = null, first_accessed_at = null, last_accessed_at = null
   where id = p_portal_id;

  -- Remove role de cliente (só se não tiver acesso a outros portais)
  if not exists (
    select 1 from public.client_portal_access
     where user_id = v_user_id and id <> p_portal_id
  ) then
    delete from public.user_roles
     where user_id = v_user_id and company_id = v_company and role = 'client';
  end if;
end;
$$;

grant execute on function public.reset_portal_client(uuid) to authenticated;
