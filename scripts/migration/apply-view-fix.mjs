import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://vfrtvnzptaazhzfirflm.supabase.co', process.env.SUPABASE_SERVICE_KEY);

const { data } = await sb.from('tasting_session_stats').select('*');
let ok = 0, fail = 0;
for (const r of data) {
  if (r.total === r.novos + r.velhos) ok++;
  else { fail++; console.log('MISMATCH:', r); }
}
console.log(`total = novos + velhos: ${ok} OK, ${fail} FAIL out of ${data.length}`);
