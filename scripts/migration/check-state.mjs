import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '.env'), 'utf8');
for (const l of env.split('\n')) { const [k,...v]=l.split('='); if(k&&v.length) process.env[k.trim()]=v.join('=').trim(); }

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

// Tenta select simples
const { data: evs, error: e1 } = await sb.from('events').select('id, event_name, bubble_id, status').limit(5);
console.log('events erro:', e1?.message ?? 'ok');
console.log('events rows:', evs?.length, JSON.stringify(evs?.map(e=>({name:e.event_name, status:e.status, hasBubble:!!e.bubble_id}))));

const { data: cli, error: e2 } = await sb.from('clients').select('id, name, bubble_id').limit(3);
console.log('clients erro:', e2?.message ?? 'ok');
console.log('clients rows:', cli?.length, JSON.stringify(cli?.map(c=>({name:c.name, hasBubble:!!c.bubble_id}))));
