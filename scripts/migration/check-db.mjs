import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(resolve(__dirname, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
  }
} catch {}

const SUPA_URL = 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY não definido'); process.exit(1); }

const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

// Contagem por status
const { data: all, error: e1 } = await sb.from('events').select('status, event_name');
if (e1) { console.error('events error:', e1.message); }
const counts = {};
let nullName = 0;
for (const e of all ?? []) {
  counts[e.status] = (counts[e.status] || 0) + 1;
  if (!e.event_name) nullName++;
}
console.log('Status counts:', JSON.stringify(counts, null, 2));
console.log('Sem nome:', nullName);

// Em pipeline com nome
const pipeline = ['lead','negotiating','tasting_scheduled','cancelled'];
const { data: pip } = await sb.from('events').select('id').in('status', pipeline).not('event_name','is',null).neq('event_name','');
console.log('Em pipeline com nome:', pip?.length);

// tasting_session_stats
const { data: stats, error: se } = await sb.from('tasting_session_stats').select('session_id, total, novos, fechados').limit(3);
console.log('tasting_session_stats:', se ? 'ERRO: '+se.message : JSON.stringify(stats?.slice(0,2)));
