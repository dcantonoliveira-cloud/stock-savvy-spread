-- Adiciona campos de autor (quem fez a ação) nas notificações
alter table public.app_notifications
  add column if not exists actor_id   uuid references auth.users(id) on delete set null,
  add column if not exists actor_name text;

-- Recria todas as funções de trigger capturando auth.uid() e o nome do perfil
-- auth.uid() funciona mesmo em SECURITY DEFINER pois lê do contexto da sessão JWT

create or replace function public.notif_novo_orcamento()
returns trigger language plpgsql security definer as $$
declare v_name text;
begin
  select display_name into v_name from public.profiles where id = auth.uid();
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
declare v_name text;
begin
  select display_name into v_name from public.profiles where id = auth.uid();
  insert into public.app_notifications(type, title, message, data, company_id, actor_id, actor_name)
  values (
    'nova_degustacao',
    'Nova degustação agendada',
    to_char(NEW.scheduled_date::date, 'DD/MM/YY') || ' — ' || coalesce(NEW.type, ''),
    jsonb_build_object('link', '/tastings/' || NEW.id, 'session_id', NEW.id),
    NEW.company_id,
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
  select display_name into v_name from public.profiles where id = auth.uid();
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
    select display_name into v_name from public.profiles where id = auth.uid();
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
      select display_name into v_name from public.profiles where id = auth.uid();
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
