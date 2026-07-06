-- Corrige tasting_session_stats:
-- guests   = soma de tasting_session_events.guest_count (qtd por degustação, não do evento total)
-- novos    = eventos que vieram como leads (snapshot='new')
-- fechados = todos os eventos confirmados/concluídos na sessão (independente do snapshot)
-- em_aberto= leads ainda em negociação
-- total_pago = soma de event_payments com payment_type = 'tasting'

create or replace view public.tasting_session_stats
  with (security_invoker = true)
as
select
  tse.session_id,
  count(distinct tse.event_id)                                                               as total,
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new')                as novos,
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new'
                                         and e.status in ('lead','negotiating','tasting_scheduled')) as em_aberto,
  -- fechados: apenas leads novos que confirmaram (usado para % conversão)
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new'
                                         and e.status in ('confirmed','completed'))          as fechados,
  coalesce(sum(tse.guest_count), 0)                                                          as guests,
  (
    select coalesce(sum(ep.value), 0)
    from tasting_session_events tse2
    join event_payments ep on ep.event_id = tse2.event_id and ep.payment_type = 'tasting'
    where tse2.session_id = tse.session_id
  )                                                                                          as total_pago,
  -- total_confirmados: todos os eventos confirmados da sessão (usado para display da coluna)
  count(distinct tse.event_id) filter (where e.status in ('confirmed','completed'))          as total_confirmados
from tasting_session_events tse
left join events e on e.id = tse.event_id
group by tse.session_id;
