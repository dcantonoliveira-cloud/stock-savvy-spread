-- Atualiza triggers de notificação:
-- 1. Garante event_date e location_text no data jsonb
-- 2. Não emite alerta para eventos cuja data já passou

-- 1. Novo orçamento
create or replace function public.notif_novo_orcamento()
returns trigger language plpgsql security definer as $$
begin
  -- não notifica se o evento já aconteceu
  if NEW.event_date is not null and NEW.event_date < current_date then
    return NEW;
  end if;
  insert into public.app_notifications(type, title, message, data, company_id)
  values (
    'novo_orcamento',
    'Novo orçamento',
    coalesce(NEW.event_name, 'Sem nome'),
    jsonb_build_object(
      'link',           '/events/' || NEW.id,
      'event_id',       NEW.id,
      'event_date',     NEW.event_date,
      'location_text',  NEW.location_text
    ),
    NEW.company_id
  );
  return NEW;
end;
$$;

-- 3. Novo pagamento
create or replace function public.notif_novo_pagamento()
returns trigger language plpgsql security definer as $$
declare
  v_event_name    text;
  v_company       uuid;
  v_event_date    date;
  v_location_text text;
begin
  select event_name, company_id, event_date, location_text
    into v_event_name, v_company, v_event_date, v_location_text
  from public.events where id = NEW.event_id;

  -- não notifica se o evento já aconteceu
  if v_event_date is not null and v_event_date < current_date then
    return NEW;
  end if;

  insert into public.app_notifications(type, title, message, data, company_id)
  values (
    'novo_pagamento',
    'Pagamento registrado',
    'R$ ' || to_char(NEW.value, 'FM999G999G990D00') || ' — ' || coalesce(v_event_name, ''),
    jsonb_build_object(
      'link',           '/events/' || NEW.event_id,
      'event_id',       NEW.event_id,
      'event_date',     v_event_date,
      'location_text',  v_location_text
    ),
    v_company
  );
  return NEW;
end;
$$;

-- 4. Evento fechado
create or replace function public.notif_evento_fechado()
returns trigger language plpgsql security definer as $$
begin
  if NEW.status = 'confirmed' and OLD.status <> 'confirmed' then
    -- não notifica se o evento já aconteceu
    if NEW.event_date is not null and NEW.event_date < current_date then
      return NEW;
    end if;
    insert into public.app_notifications(type, title, message, data, company_id)
    values (
      'evento_fechado',
      'Contrato fechado! 🎉',
      coalesce(NEW.event_name, 'Sem nome'),
      jsonb_build_object(
        'link',           '/events/' || NEW.id,
        'event_id',       NEW.id,
        'event_date',     NEW.event_date,
        'location_text',  NEW.location_text
      ),
      NEW.company_id
    );
  end if;
  return NEW;
end;
$$;

-- 5. Cardápio alterado
create or replace function public.notif_cardapio_alterado()
returns trigger language plpgsql security definer as $$
declare
  old_words int;
  new_words int;
begin
  if NEW.menu_text is distinct from OLD.menu_text then
    -- não notifica se o evento já aconteceu
    if NEW.event_date is not null and NEW.event_date < current_date then
      return NEW;
    end if;
    old_words := public.word_count(public.strip_html(coalesce(OLD.menu_text, '')));
    new_words := public.word_count(public.strip_html(coalesce(NEW.menu_text, '')));
    if abs(new_words - old_words) >= 1 then
      insert into public.app_notifications(type, title, message, data, company_id)
      values (
        'cardapio_alterado',
        'Cardápio atualizado',
        coalesce(NEW.event_name, 'Sem nome'),
        jsonb_build_object(
          'link',           '/events/' || NEW.id,
          'event_id',       NEW.id,
          'event_date',     NEW.event_date,
          'location_text',  NEW.location_text
        ),
        NEW.company_id
      );
    end if;
  end if;
  return NEW;
end;
$$;
