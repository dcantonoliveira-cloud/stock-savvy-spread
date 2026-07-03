import { createClient } from '@supabase/supabase-js';

// Usa a chave publishable do .env do projeto
const sb = createClient(
  'https://vfrtvnzptaazhzfirflm.supabase.co',
  'sb_publishable_7b3DCl-vLsvuYXQ8H9Vdsw_yCvDFyhD',
  { auth: { persistSession: false } }
);

const { data, error } = await sb.from('events').select('status').limit(1000);
if (error) { console.error('ERRO:', error.message); process.exit(1); }

const counts = {};
for (const e of data ?? []) counts[e.status] = (counts[e.status]||0)+1;
console.log('Total eventos retornados:', data?.length);
console.log('Status counts:', JSON.stringify(counts, null, 2));

const pipeline = ['lead','negotiating','tasting_scheduled','cancelled'];
const pipeCount = (data ?? []).filter(e => pipeline.includes(e.status)).length;
console.log('Em pipeline:', pipeCount);
