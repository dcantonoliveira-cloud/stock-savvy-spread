-- Adiciona cooldown de 10 minutos na notificação de cardápio alterado.
-- Sem isso, o auto-save dispara uma notificação a cada keystroke.
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
      -- Só cria notificação se não existe uma nos últimos 10 minutos para o mesmo evento
      if not exists (
        select 1 from public.app_notifications
        where type = 'cardapio_alterado'
          and data->>'event_id' = NEW.id::text
          and created_at > now() - interval '10 minutes'
      ) then
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
  end if;
  return NEW;
end;
$$;
