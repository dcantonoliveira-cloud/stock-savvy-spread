-- Corrige busca do display_name: profiles usa coluna user_id, não id
-- Também corrige notif_nova_degustacao que usava NEW.company_id (inexistente em tasting_sessions)

create or replace function public.notif_novo_orcamento()
returns trigger language plpgsql security definer as $$
declare v_name text;
begin
  select display_name into v_name from public.profiles where user_id = auth.uid();
  insert into public.app_notifications(type, title, message, data, company_id, actor_id, actor_name)
  values (
    'novo_orcamento',
    'Novo orçamento',
    coalesce(NEW.event_name, 'Sem nome'),
    jsonb_build_object('link', '/events/' || NEW.id, 'event_id', NEW.id),
    NEW.company_id,
    auth.uid(),
    coalesce(v_name, 'Sistema')
  );
  return NEW;
end;
$$;

create or replace function public.notif_nova_degustacao()
returns trigger language plpgsql security definer as $$
declare
  v_name    text;
  v_company uuid;
begin
  select display_name into v_name from public.profiles where user_id = auth.uid();
  -- tasting_sessions não tem company_id; busca via companies (única empresa no SaaS)
  select id into v_company from public.companies limit 1;
  insert into public.app_notifications(type, title, message, data, company_id, actor_id, actor_name)
  values (
    'nova_degustacao',
    'Nova degustação agendada',
    to_char(NEW.scheduled_date::date, 'DD/MM/YY') || ' — ' || coalesce(NEW.type, ''),
    jsonb_build_object('link', '/tastings/' || NEW.id, 'session_id', NEW.id),
    v_company,
    auth.uid(),
    coalesce(v_name, 'Sistema')
  );
  return NEW;
end;
$$;

create or replace function public.notif_novo_pagamento()
returns trigger language plpgsql security definer as $$
declare
  v_event_name text;
  v_company    uuid;
  v_name       text;
begin
  select event_name, company_id into v_event_name, v_company
    from public.events where id = NEW.event_id;
  select display_name into v_name from public.profiles where user_id = auth.uid();
  insert into public.app_notifications(type, title, message, data, company_id, actor_id, actor_name)
  values (
    'novo_pagamento',
    'Pagamento registrado',
    'R$ ' || to_char(NEW.value, 'FM999G999G990D00') || ' — ' || coalesce(v_event_name, ''),
    jsonb_build_object('link', '/events/' || NEW.event_id, 'event_id', NEW.event_id),
    v_company,
    auth.uid(),
    coalesce(v_name, 'Sistema')
  );
  return NEW;
end;
$$;

create or replace function public.notif_evento_fechado()
returns trigger language plpgsql security definer as $$
declare v_name text;
begin
  if NEW.status = 'confirmed' and OLD.status <> 'confirmed' then
    select display_name into v_name from public.profiles where user_id = auth.uid();
    insert into public.app_notifications(type, title, message, data, company_id, actor_id, actor_name)
    values (
      'evento_fechado',
      'Contrato fechado! 🎉',
      coalesce(NEW.event_name, 'Sem nome'),
      jsonb_build_object('link', '/events/' || NEW.id, 'event_id', NEW.id),
      NEW.company_id,
      auth.uid(),
      coalesce(v_name, 'Sistema')
    );
  end if;
  return NEW;
end;
$$;

create or replace function public.notif_cardapio_alterado()
returns trigger language plpgsql security definer as $$
declare
  old_words int;
  new_words int;
  v_name    text;
begin
  if NEW.menu_text is distinct from OLD.menu_text then
    old_words := public.word_count(public.strip_html(coalesce(OLD.menu_text, '')));
    new_words := public.word_count(public.strip_html(coalesce(NEW.menu_text, '')));
    if abs(new_words - old_words) >= 1 then
      select display_name into v_name from public.profiles where user_id = auth.uid();
      insert into public.app_notifications(type, title, message, data, company_id, actor_id, actor_name)
      values (
        'cardapio_alterado',
        'Cardápio atualizado',
        coalesce(NEW.event_name, 'Sem nome'),
        jsonb_build_object('link', '/events/' || NEW.id, 'event_id', NEW.id),
        NEW.company_id,
        auth.uid(),
        coalesce(v_name, 'Sistema')
      );
    end if;
  end if;
  return NEW;
end;
$$;
