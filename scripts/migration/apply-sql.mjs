import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(resolve(__dirname, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
} catch {}

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

const sql = `
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
`;

const { error } = await sb.rpc('exec_sql', { sql }).catch(() => ({ error: { message: 'rpc não disponível' } }));
if (error) {
  // Tenta via fetch direto na Management API
  console.log('RPC falhou, tentando via Management API...');
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  console.log('Status:', res.status, await res.text());
} else {
  console.log('✅ View atualizada com sucesso');
}
