import { createClient } from '@supabase/supabase-js';
const KEY = process.env.SUPABASE_SERVICE_KEY;
const URL = 'https://vfrtvnzptaazhzfirflm.supabase.co';

const sql = `
create or replace view public.tasting_session_stats
  with (security_invoker = true)
as
select
  tse.session_id,
  count(distinct tse.event_id) as total,
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new') as novos,
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'confirmed') as velhos,
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new' and e.status in ('lead','negotiating','tasting_scheduled')) as em_aberto,
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'new' and e.status in ('confirmed','completed')) as fechados,
  coalesce(sum(tse.guest_count), 0) as guests,
  (select coalesce(sum(ep.value), 0) from tasting_session_events tse2 join event_payments ep on ep.event_id = tse2.event_id and ep.payment_type = 'tasting' where tse2.session_id = tse.session_id) as total_pago,
  count(distinct tse.event_id) filter (where tse.situation_snapshot = 'confirmed') as total_confirmados
from tasting_session_events tse
left join events e on e.id = tse.event_id
group by tse.session_id;
`;

// Try Supabase Management API
const resp = await fetch('https://api.supabase.com/v1/projects/vfrtvnzptaazhzfirflm/database/query', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});
const body = await resp.text();
console.log('Management API status:', resp.status, body.slice(0, 300));
