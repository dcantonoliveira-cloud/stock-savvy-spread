-- Fix tasting_session_stats view:
-- 1. Add explicit 'velhos' column (situation_snapshot='confirmed') so total = novos + velhos always holds
-- 2. Fix total_confirmados to only count velhos (already-confirmed before attending), not novos-who-later-confirmed
-- 3. Ensure em_aberto and fechados only count novos (already correct, just clarifying)

create or replace view public.tasting_session_stats
  with (security_invoker = true)
as
select
  tse.session_id,
  count(distinct tse.event_id)                                                               as total,
  -- novos = came as leads (contract_signed_date > session_date OR no contract yet)
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new')                as novos,
  -- velhos = already confirmed before attending (contract_signed_date < session_date)
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'confirmed')          as velhos,
  -- em_aberto = novos still in pipeline
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new'
                                         and e.status in ('lead','negotiating','tasting_scheduled')) as em_aberto,
  -- fechados = novos that have since confirmed (used for conversion rate)
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new'
                                         and e.status in ('confirmed','completed'))          as fechados,
  coalesce(sum(tse.guest_count), 0)                                                          as guests,
  (
    select coalesce(sum(ep.value), 0)
    from tasting_session_events tse2
    join event_payments ep on ep.event_id = tse2.event_id and ep.payment_type = 'tasting'
    where tse2.session_id = tse.session_id
  )                                                                                          as total_pago,
  -- total_confirmados kept for backward compat but now equals velhos (already-confirmed before attending)
  -- Note: this is NOT the same as events currently confirmed — that would mix velhos + fechados
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'confirmed')          as total_confirmados
from tasting_session_events tse
left join events e on e.id = tse.event_id
group by tse.session_id;
