-- Restaura actor_id/actor_name na notificação de cardápio (perdidos em 20260707000007).
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
      -- Cooldown de 10 min por evento para não spammar com auto-save
      if not exists (
        select 1 from public.app_notifications
        where type = 'cardapio_alterado'
          and data->>'event_id' = NEW.id::text
          and created_at > now() - interval '10 minutes'
      ) then
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
  end if;
  return NEW;
end;
$$;
