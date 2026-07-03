-- Recria tasting_session_stats:
-- guests     = soma de events.guest_count dos eventos da sessão
-- total_pago = soma de event_payments.value (confirmados) dos eventos da sessão

create or replace view tasting_session_stats as
select
  tse.session_id,
  count(distinct tse.event_id)                                                               as total,
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new')                as novos,
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new'
                                         and e.status in ('lead','negotiating','tasting_scheduled')) as em_aberto,
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new'
                                         and e.status in ('confirmed','completed'))          as fechados,
  (
    select coalesce(sum(ev2.guest_count), 0)
    from tasting_session_events tse2
    join events ev2 on ev2.id = tse2.event_id
    where tse2.session_id = tse.session_id
  )                                                                                          as guests,
  (
    select coalesce(sum(ep.value), 0)
    from tasting_session_events tse2
    join event_payments ep on ep.event_id = tse2.event_id and ep.is_confirmed = true
    where tse2.session_id = tse.session_id
  )                                                                                          as total_pago
from tasting_session_events tse
left join events e on e.id = tse.event_id
group by tse.session_id;
