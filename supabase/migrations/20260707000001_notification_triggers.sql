-- ── Helper: strip HTML tags para comparar texto do cardápio ─────────────────
create or replace function public.strip_html(html text)
returns text language sql immutable as $$
  select regexp_replace(coalesce(html,''), '<[^>]*>', '', 'g');
$$;

-- ── Helper: conta palavras ────────────────────────────────────────────────────
create or replace function public.word_count(t text)
returns int language sql immutable as $$
  select coalesce(array_length(regexp_split_to_array(trim(t), '\s+'), 1), 0);
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Novo orçamento (evento criado)
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.notif_novo_orcamento()
returns trigger language plpgsql security definer as $$
begin
  insert into public.app_notifications(type, title, message, data, company_id)
  values (
    'novo_orcamento',
    'Novo orçamento',
    coalesce(NEW.event_name, 'Sem nome'),
    jsonb_build_object('link', '/events/' || NEW.id, 'event_id', NEW.id),
    NEW.company_id
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notif_novo_orcamento on public.events;
create trigger trg_notif_novo_orcamento
  after insert on public.events
  for each row execute function public.notif_novo_orcamento();

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Nova degustação agendada
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.notif_nova_degustacao()
returns trigger language plpgsql security definer as $$
begin
  insert into public.app_notifications(type, title, message, data, company_id)
  values (
    'nova_degustacao',
    'Nova degustação agendada',
    to_char(NEW.scheduled_date::date, 'DD/MM/YY') || ' — ' || coalesce(NEW.type, ''),
    jsonb_build_object('link', '/tastings/' || NEW.id, 'session_id', NEW.id),
    NEW.company_id
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notif_nova_degustacao on public.tasting_sessions;
create trigger trg_notif_nova_degustacao
  after insert on public.tasting_sessions
  for each row execute function public.notif_nova_degustacao();

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Novo pagamento alocado
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.notif_novo_pagamento()
returns trigger language plpgsql security definer as $$
declare
  v_event_name text;
  v_company    uuid;
begin
  select event_name, company_id into v_event_name, v_company
  from public.events where id = NEW.event_id;

  insert into public.app_notifications(type, title, message, data, company_id)
  values (
    'novo_pagamento',
    'Pagamento registrado',
    'R$ ' || to_char(NEW.value, 'FM999G999G990D00') || ' — ' || coalesce(v_event_name, ''),
    jsonb_build_object('link', '/events/' || NEW.event_id, 'event_id', NEW.event_id),
    v_company
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notif_novo_pagamento on public.event_payments;
create trigger trg_notif_novo_pagamento
  after insert on public.event_payments
  for each row execute function public.notif_novo_pagamento();

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Evento fechado (status → confirmed)
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.notif_evento_fechado()
returns trigger language plpgsql security definer as $$
begin
  if NEW.status = 'confirmed' and OLD.status <> 'confirmed' then
    insert into public.app_notifications(type, title, message, data, company_id)
    values (
      'evento_fechado',
      'Contrato fechado! 🎉',
      coalesce(NEW.event_name, 'Sem nome'),
      jsonb_build_object('link', '/events/' || NEW.id, 'event_id', NEW.id),
      NEW.company_id
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notif_evento_fechado on public.events;
create trigger trg_notif_evento_fechado
  after update on public.events
  for each row execute function public.notif_evento_fechado();

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. Cardápio do evento alterado (≥ 1 palavra de diferença)
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.notif_cardapio_alterado()
returns trigger language plpgsql security definer as $$
declare
  old_words int;
  new_words int;
begin
  if NEW.menu_text is distinct from OLD.menu_text then
    old_words := public.word_count(public.strip_html(coalesce(OLD.menu_text, '')));
    new_words := public.word_count(public.strip_html(coalesce(NEW.menu_text, '')));
    if abs(new_words - old_words) >= 1 then
      insert into public.app_notifications(type, title, message, data, company_id)
      values (
        'cardapio_alterado',
        'Cardápio atualizado',
        coalesce(NEW.event_name, 'Sem nome'),
        jsonb_build_object('link', '/events/' || NEW.id, 'event_id', NEW.id),
        NEW.company_id
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notif_cardapio_alterado on public.events;
create trigger trg_notif_cardapio_alterado
  after update on public.events
  for each row execute function public.notif_cardapio_alterado();
