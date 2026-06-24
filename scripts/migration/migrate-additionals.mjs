/**
 * Migra valores adicionais do Bubble (ValoresAdicionaisEventos) → event_additional_values no Supabase
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vfrtvnzptaazhzfirflm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcnR2bnpwdGFhemh6ZmlyZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyODYyOSwiZXhwIjoyMDg5MDA0NjI5fQ.bR1zR4gfcAOOEQhGizaXOAALN0HD7RQTsUZunYXRbrM'
);

const BUBBLE_BASE = 'https://rondellobuffet-app.com.br/api/1.1/obj';
const TOKEN = 'b4b3c4138bb1000811d5a3c0ba47a238';

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
  console.log('Buscando valores adicionais do Bubble...');
  const bubbleItems = await fetchAllBubble('ValoresAdicionaisEventos');
  console.log(`  → ${bubbleItems.length} registros encontrados`);

  console.log('Carregando eventos do Supabase...');
  const { data: events } = await supabase
    .from('events')
    .select('id, bubble_id')
    .not('bubble_id', 'is', null);

  const bubbleIdMap = {};
  for (const e of events ?? []) bubbleIdMap[e.bubble_id] = e.id;
  console.log(`  → ${Object.keys(bubbleIdMap).length} eventos mapeados`);

  // Verifica já migrados via bubble_id
  const { data: existing } = await supabase
    .from('event_additional_values')
    .select('bubble_id')
    .not('bubble_id', 'is', null);
  const existingIds = new Set((existing ?? []).map(p => p.bubble_id));
  console.log(`  → ${existingIds.size} já migrados`);

  let inserted = 0, skipped = 0, noEvent = 0;

  for (const item of bubbleItems) {
    if (existingIds.has(item._id)) { skipped++; continue; }

    const eventId = bubbleIdMap[item.evento];
    if (!eventId) { noEvent++; continue; }

    const { error } = await supabase.from('event_additional_values').insert({
      event_id: eventId,
      bubble_id: item._id,
      description: item['Descrição'] ?? 'Valor adicional',
      value: item.valor ?? 0,
    });

    if (error) console.error(`  ✗ ${item._id}:`, error.message);
    else inserted++;
  }

  console.log('\n=== Resultado ===');
  console.log(`  Inseridos:   ${inserted}`);
  console.log(`  Já existiam: ${skipped}`);
  console.log(`  Sem evento:  ${noEvent}`);
  console.log('\nMigração concluída!');
}

main().catch(console.error);
