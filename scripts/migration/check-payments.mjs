import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '.env'), 'utf8');
for (const l of env.split('\n')) { const [k,...v]=l.split('='); if(k&&v.length) process.env[k.trim()]=v.join('=').trim(); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});

// Verifica colunas de event_payments
const { data, error } = await sb.from('event_payments').select('*').limit(2);
console.log('Colunas event_payments:', data ? Object.keys(data[0] ?? {}) : 'erro: '+error?.message);

// Verifica se tem coluna is_tasting_payment
const { data: d2 } = await sb.from('event_payments').select('id,value,is_tasting_payment,payment_type').limit(3);
console.log('Amostra:', JSON.stringify(d2));
