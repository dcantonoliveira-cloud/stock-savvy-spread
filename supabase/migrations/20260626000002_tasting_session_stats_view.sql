create or replace view tasting_session_stats as
select
  tse.session_id,
  count(*)                                                                                    as total,
  count(*) filter (where tse.situation_snapshot = 'new')                                     as novos,
  count(*) filter (where tse.situation_snapshot = 'new'
                     and e.status in ('lead','negotiating','tasting_scheduled'))              as em_aberto,
  count(*) filter (where tse.situation_snapshot = 'new'
                     and e.status in ('confirmed','completed'))                               as fechados,
  coalesce(sum(tse.guest_count), 0)                                                          as guests,
  coalesce(sum(tse.paid_amount), 0)                                                          as total_pago
from tasting_session_events tse
left join events e on e.id = tse.event_id
group by tse.session_id;
