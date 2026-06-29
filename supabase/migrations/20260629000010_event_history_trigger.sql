-- Trigger que grava automaticamente no event_history quando campos importantes mudam

create or replace function record_event_history()
returns trigger
language plpgsql
security definer
as $$
declare
  _user_id uuid;
begin
  -- Tenta pegar o usuário autenticado (nulo em atualizações server-side)
  begin
    _user_id := auth.uid();
  exception when others then
    _user_id := null;
  end;

  if OLD.status is distinct from NEW.status then
    insert into event_history (event_id, field_name, old_value, new_value, user_id)
    values (NEW.id, 'Status', OLD.status, NEW.status, _user_id);
  end if;

  if OLD.event_date is distinct from NEW.event_date then
    insert into event_history (event_id, field_name, old_value, new_value, user_id)
    values (NEW.id, 'Data do evento',
      to_char(OLD.event_date, 'DD/MM/YYYY'),
      to_char(NEW.event_date, 'DD/MM/YYYY'),
      _user_id);
  end if;

  if OLD.event_name is distinct from NEW.event_name then
    insert into event_history (event_id, field_name, old_value, new_value, user_id)
    values (NEW.id, 'Nome do evento', OLD.event_name, NEW.event_name, _user_id);
  end if;

  if OLD.location_text is distinct from NEW.location_text then
    insert into event_history (event_id, field_name, old_value, new_value, user_id)
    values (NEW.id, 'Local', OLD.location_text, NEW.location_text, _user_id);
  end if;

  if OLD.guest_count is distinct from NEW.guest_count then
    insert into event_history (event_id, field_name, old_value, new_value, user_id)
    values (NEW.id, 'Nº de convidados',
      OLD.guest_count::text,
      NEW.guest_count::text,
      _user_id);
  end if;

  if OLD.total_value is distinct from NEW.total_value then
    insert into event_history (event_id, field_name, old_value, new_value, user_id)
    values (NEW.id, 'Valor total',
      'R$ ' || to_char(OLD.total_value, 'FM999G999G990D00'),
      'R$ ' || to_char(NEW.total_value, 'FM999G999G990D00'),
      _user_id);
  end if;

  if OLD.price_per_person is distinct from NEW.price_per_person then
    insert into event_history (event_id, field_name, old_value, new_value, user_id)
    values (NEW.id, 'Valor por convidado',
      'R$ ' || to_char(OLD.price_per_person, 'FM999G999G990D00'),
      'R$ ' || to_char(NEW.price_per_person, 'FM999G999G990D00'),
      _user_id);
  end if;

  if OLD.contract_value is distinct from NEW.contract_value then
    insert into event_history (event_id, field_name, old_value, new_value, user_id)
    values (NEW.id, 'Valor do contrato',
      'R$ ' || to_char(OLD.contract_value, 'FM999G999G990D00'),
      'R$ ' || to_char(NEW.contract_value, 'FM999G999G990D00'),
      _user_id);
  end if;

  if OLD.contract_signed is distinct from NEW.contract_signed then
    insert into event_history (event_id, field_name, old_value, new_value, user_id)
    values (NEW.id, 'Contrato assinado',
      case when OLD.contract_signed then 'Sim' else 'Não' end,
      case when NEW.contract_signed then 'Sim' else 'Não' end,
      _user_id);
  end if;

  return NEW;
end;
$$;

-- Remove trigger anterior se existir
drop trigger if exists trg_event_history on events;

create trigger trg_event_history
after update on events
for each row
execute function record_event_history();
