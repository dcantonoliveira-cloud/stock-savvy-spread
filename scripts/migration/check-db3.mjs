import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://vfrtvnzptaazhzfirflm.supabase.co',
  'sb_publishable_7b3DCl-vLsvuYXQ8H9Vdsw_yCvDFyhD',
  { auth: { persistSession: false } }
);

// Tenta query simples sem join
const { data, error, status, statusText } = await sb.from('events').select('id').limit(5);
console.log('Status HTTP:', status, statusText);
console.log('Erro:', error?.message ?? 'nenhum');
console.log('Data:', data?.length ?? 'null');

// Tenta um select mais simples
const res = await fetch('https://vfrtvnzptaazhzfirflm.supabase.co/rest/v1/events?select=id&limit=3', {
  headers: {
    'apikey': 'sb_publishable_7b3DCl-vLsvuYXQ8H9Vdsw_yCvDFyhD',
    'Authorization': 'Bearer sb_publishable_7b3DCl-vLsvuYXQ8H9Vdsw_yCvDFyhD',
  }
});
console.log('\nREST direto status:', res.status);
const body = await res.text();
console.log('Body:', body.slice(0,300));
