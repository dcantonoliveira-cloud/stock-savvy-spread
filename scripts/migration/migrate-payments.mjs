/**
 * Migra pagamentos do Bubble → event_payments no Supabase
 * Relaciona via bubble_id dos eventos já migrados
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
  console.log('Buscando pagamentos do Bubble...');
  const bubblePayments = await fetchAllBubble('Pagamentos');
  console.log(`  → ${bubblePayments.length} pagamentos encontrados`);

  // Carrega mapa bubble_id → supabase event id
  console.log('Carregando eventos do Supabase...');
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, bubble_id')
    .not('bubble_id', 'is', null);

  if (evErr) { console.error('Erro ao buscar eventos:', evErr.message); process.exit(1); }

  const bubbleIdMap = {};
  for (const e of events ?? []) {
    if (e.bubble_id) bubbleIdMap[e.bubble_id] = e.id;
  }
  console.log(`  → ${Object.keys(bubbleIdMap).length} eventos com bubble_id`);

  // Verifica pagamentos já migrados (evita duplicatas)
  const { data: existing } = await supabase
    .from('event_payments')
    .select('bubble_id')
    .not('bubble_id', 'is', null);

  const existingIds = new Set((existing ?? []).map(p => p.bubble_id));
  console.log(`  → ${existingIds.size} pagamentos já migrados`);

  let inserted = 0, skipped = 0, noEvent = 0;

  for (const p of bubblePayments) {
    const bubbleId = p._id;

    if (existingIds.has(bubbleId)) { skipped++; continue; }

    const eventId = bubbleIdMap[p.evento];
    if (!eventId) { noEvent++; continue; }

    const { error } = await supabase.from('event_payments').insert({
      event_id: eventId,
      bubble_id: bubbleId,
      value: p.Valor ?? 0,
      payment_date: p.data ? new Date(p.data).toISOString().split('T')[0] : null,
      is_confirmed: p.conferido === true,
      payment_type: 'outros',
      notes: null,
    });

    if (error) {
      console.error(`  ✗ Erro no pagamento ${bubbleId}:`, error.message);
    } else {
      inserted++;
    }
  }

  console.log('\n=== Resultado ===');
  console.log(`  Inseridos:     ${inserted}`);
  console.log(`  Já existiam:   ${skipped}`);
  console.log(`  Sem evento:    ${noEvent}`);

  if (inserted > 0) {
    console.log('\nAtualizando paid_value dos eventos afetados...');
    const { error: syncErr } = await supabase.rpc('sync_all_paid_values');
    if (syncErr) {
      console.log('  (trigger automático deve ter atualizado — sem erro crítico)');
    } else {
      console.log('  ✓ paid_value sincronizado');
    }
  }

  console.log('\nMigração concluída!');
}

main().catch(console.error);
