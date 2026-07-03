import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '.env'), 'utf8');
for (const l of env.split('\n')) { const [k,...v]=l.split('='); if(k&&v.length) process.env[k.trim()]=v.join('=').trim(); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});

// Simula exatamente a query do OrcamentosPage
const { data, error } = await sb
  .from('events')
  .select('id, event_name, event_date, status, created_at')
  .in('status', ['lead','negotiating','tasting_scheduled','cancelled'])
  .not('event_name','is',null)
  .neq('event_name','')
  .order('created_at', { ascending: false });

if (error) { console.error('ERRO:', error.message); process.exit(1); }

const TODAY = new Date().toISOString().split('T')[0];
const PIPELINE = ['lead','negotiating','tasting_scheduled'];
const isExpired = r => PIPELINE.includes(r.status) && !!r.event_date && r.event_date < TODAY;

console.log('Total retornado pela query:', data.length);
const counts = {};
for (const r of data) counts[r.status] = (counts[r.status]||0)+1;
console.log('Por status:', JSON.stringify(counts));

const emAberto = data.filter(r => PIPELINE.includes(r.status) && !isExpired(r));
const vencidos  = data.filter(r => isExpired(r));
const lead      = data.filter(r => r.status==='lead' && !isExpired(r));
console.log('Em aberto (pipeline + não vencido):', emAberto.length);
console.log('Vencidos:', vencidos.length);
console.log('Lead não vencido:', lead.length);
if (lead.length > 0) console.log('Amostra lead:', JSON.stringify(lead[0]));
