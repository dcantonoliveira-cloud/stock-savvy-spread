-- Deleta completamente a conta auth do cliente vinculado ao portal
-- Também limpa user_roles e desvincula o portal

create or replace function public.delete_portal_client_user(p_portal_id uuid)
returns void language plpgsql security definer as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
    from public.client_portal_access
   where id = p_portal_id;

  if v_user_id is null then return; end if;

  -- Desvincula portal
  update public.client_portal_access
     set user_id = null, first_accessed_at = null, last_accessed_at = null
   where id = p_portal_id;

  -- Remove roles
  delete from public.user_roles where user_id = v_user_id;

  -- Deleta conta auth (cascata limpa sessions, identities, etc.)
  delete from auth.users where id = v_user_id;
end;
$$;

grant execute on function public.delete_portal_client_user(uuid) to authenticated;
