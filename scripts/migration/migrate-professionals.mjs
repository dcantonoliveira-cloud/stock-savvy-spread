import https from 'https';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vfrtvnzptaazhzfirflm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcnR2bnpwdGFhemh6ZmlyZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyODYyOSwiZXhwIjoyMDg5MDA0NjI5fQ.bR1zR4gfcAOOEQhGizaXOAALN0HD7RQTsUZunYXRbrM'
);

const TOKEN = 'b4b3c4138bb1000811d5a3c0ba47a238';
const BUBBLE_BASE = 'https://rondellobuffet-app.com.br/api/1.1/obj';

function fetchJson(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b)));
    }).on('error', rej);
  });
}

async function fetchAllBubble(type) {
  let cursor = 0, all = [];
  while (true) {
    const data = await fetchJson(`${BUBBLE_BASE}/${type}?limit=100&cursor=${cursor}`);
    all.push(...(data.response?.results ?? []));
    if ((data.response?.remaining ?? 0) === 0) break;
    cursor += 100;
  }
  return all;
}

async function main() {
  console.log('Buscando eventos do Bubble...');
  const bubbleEvents = await fetchAllBubble('eventos');
  console.log(`  → ${bubbleEvents.length} eventos`);

  const { data: events } = await supabase.from('events').select('id, bubble_id').not('bubble_id', 'is', null);
  const map = {};
  for (const e of events ?? []) map[e.bubble_id] = e.id;

  let updated = 0, skipped = 0;
  for (const ev of bubbleEvents) {
    const id = map[ev._id];
    if (!id) { skipped++; continue; }
    const profCount = ev.QuantidadeProfissionais ?? 0;
    const mealValue = ev['AlimentaçãoProfissionais'] ?? 0;
    const mealType = ev.tipoAlimentProf ?? null;
    if (profCount === 0 && mealValue === 0) { skipped++; continue; }
    await supabase.from('events').update({
      professional_count: profCount,
      professional_meal_value: mealValue,
      professional_meal_type: mealType,
    }).eq('id', id);
    updated++;
  }

  console.log(`\nAtualizados: ${updated} | Ignorados: ${skipped}`);
  console.log('Concluído!');
}
main().catch(console.error);
