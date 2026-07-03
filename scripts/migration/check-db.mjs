import { createClient } from '@supabase/supabase-js';

const SUPA_URL = 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_KEY) { console.error('precisa de SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

const { data: all } = await sb.from('events').select('status, event_name');
const counts = {};
let nullName = 0, emptyName = 0;
for (const e of all ?? []) {
  counts[e.status] = (counts[e.status] || 0) + 1;
  if (e.event_name === null) nullName++;
  if (e.event_name === '') emptyName++;
}
console.log('Status counts:', JSON.stringify(counts, null, 2));
console.log('Sem nome (null):', nullName);
console.log('Sem nome (vazio):', emptyName);

const pipeline = ['lead','negotiating','tasting_scheduled','cancelled'];
const { data: pip } = await sb.from('events').select('id').in('status', pipeline).not('event_name','is',null).neq('event_name','');
console.log('Em pipeline com nome:', pip?.length);

// tasting_session_stats - verifica se view existe
const { data: stats, error: se } = await sb.from('tasting_session_stats').select('session_id, total, novos, fechados').limit(3);
console.log('tasting_session_stats error:', se?.message ?? 'ok');
console.log('Stats amostra:', JSON.stringify(stats?.slice(0,2)));
