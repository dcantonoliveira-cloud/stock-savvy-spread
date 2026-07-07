-- Drop a versão antiga (returns void) para poder recriar como returns text
drop function if exists public.delete_portal_client_user(uuid);

-- Recria retornando o novo código de acesso gerado
create or replace function public.delete_portal_client_user(p_portal_id uuid)
returns text
language plpgsql security definer as $$
declare
  v_user_id  uuid;
  v_new_code text;
  v_attempt  int := 0;
begin
  -- Busca o user vinculado
  select user_id into v_user_id
    from public.client_portal_access
   where id = p_portal_id;

  -- Remove user_roles e apaga da auth.users se existir
  if v_user_id is not null then
    delete from public.user_roles where user_id = v_user_id;
    delete from auth.users where id = v_user_id;
  end if;

  -- Gera novo código único (até 10 tentativas)
  loop
    v_new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (
      select 1 from public.client_portal_access where access_code = v_new_code
    );
    v_attempt := v_attempt + 1;
    if v_attempt >= 10 then exit; end if;
  end loop;

  -- Desvincula e atualiza o código
  update public.client_portal_access
     set user_id     = null,
         access_code = v_new_code,
         enabled     = true
   where id = p_portal_id;

  return v_new_code;
end;
$$;
