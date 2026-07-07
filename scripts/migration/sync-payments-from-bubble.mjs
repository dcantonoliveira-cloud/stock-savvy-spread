/**
 * Sincroniza pagamentos do Bubble → event_payments no Supabase.
 * Usa bubble_id quando disponível; fallback por NomeDoEvento + dataDoEvento.
 * Não envia mensagem de confirmação ao casal — apenas insere registros.
 *
 * Usage:
 *   node scripts/migration/sync-payments-from-bubble.mjs
 *   node scripts/migration/sync-payments-from-bubble.mjs --dry-run   (só mostra, não insere)
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';

const BUBBLE_BASE  = 'https://rondellobuffet-app.com.br/api/1.1/obj';
const BUBBLE_TOKEN = 'b4b3c4138bb1000811d5a3c0ba47a238';
const SUPABASE_URL = 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPABASE_KEY = 'sb_secret_Al-4U7Sa5TSXj7DEk8d-BA_B9HuCqHB';

const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('⚠️  DRY RUN — nenhuma alteração será salva\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function fetchJson(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` } }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch(e) { rej(e); } });
    }).on('error', rej);
  });
}

async function fetchAll(path) {
  const PAGE = 100;
  let cursor = 0, all = [];
  while (true) {
    const json = await fetchJson(`${BUBBLE_BASE}/${path}?limit=${PAGE}&cursor=${cursor}`);
    all.push(...(json.response?.results ?? []));
    process.stdout.write(`\r  Bubble ${path}: ${all.length} registros...`);
    if ((json.response?.remaining ?? 0) === 0) break;
    cursor += PAGE;
  }
  console.log('');
  return all;
}

function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function sameDate(bubbleDate, supaDate) {
  if (!bubbleDate || !supaDate) return false;
  return bubbleDate.slice(0, 10) === supaDate.slice(0, 10);
}

async function main() {
  console.log('=== Sincronizando Pagamentos do Bubble → Supabase ===\n');

  // 1. Busca tudo do Bubble
  console.log('Buscando eventos do Bubble...');
  const bubbleEvents = await fetchAll('eventos');

  console.log('Buscando pagamentos do Bubble...');
  const bubblePayments = await fetchAll('Pagamentos');
  console.log(`  Total pagamentos: ${bubblePayments.length}\n`);

  // Mapa bubble evento _id → dados do evento
  const bubbleEventMap = {};
  for (const e of bubbleEvents) bubbleEventMap[e._id] = e;

  // 2. Carrega eventos do Supabase
  console.log('Carregando eventos do Supabase...');
  const { data: supaEvents, error: evErr } = await supabase
    .from('events')
    .select('id, bubble_id, event_name, event_date');
  if (evErr) throw evErr;

  const byBubbleId = {};
  for (const e of supaEvents ?? []) {
    if (e.bubble_id) byBubbleId[e.bubble_id] = e.id;
  }
  console.log(`  Supabase: ${supaEvents.length} eventos (${Object.keys(byBubbleId).length} com bubble_id)\n`);

  // 3. Pagamentos já existentes no Supabase (para evitar duplicatas)
  const { data: existingPayments } = await supabase
    .from('event_payments')
    .select('event_id, payment_date, value, bubble_id');

  const existingBubbleIds = new Set(
    (existingPayments ?? []).filter(p => p.bubble_id).map(p => p.bubble_id)
  );

  // Chave para detectar duplicatas sem bubble_id: event_id|date|value
  const existingKeys = new Set(
    (existingPayments ?? []).map(p => `${p.event_id}|${p.payment_date}|${p.value}`)
  );

  console.log(`  Pagamentos já no Supabase: ${existingPayments?.length ?? 0}\n`);

  let inserted = 0, skipped = 0, noMatch = 0;
  const missed = [];

  for (const p of bubblePayments) {
    // Já migrado por bubble_id?
    if (existingBubbleIds.has(p._id)) { skipped++; continue; }

    // Encontra o evento Supabase correspondente
    let supaEventId = byBubbleId[p.evento] ?? null;

    if (!supaEventId && p.evento) {
      // Fallback: busca pelo evento Bubble e cruza por nome + data
      const bev = bubbleEventMap[p.evento];
      if (bev) {
        const bName = normalize(bev['NomeDoEvento']);
        const bDate = bev['dataDoEvento'];

        let match = supaEvents.find(s =>
          normalize(s.event_name) === bName && sameDate(bDate, s.event_date)
        );
        if (!match) {
          const byName = supaEvents.filter(s => normalize(s.event_name) === bName);
          if (byName.length === 1) match = byName[0];
        }
        if (match) supaEventId = match.id;
      }
    }

    if (!supaEventId) {
      noMatch++;
      const bev = bubbleEventMap[p.evento];
      missed.push(`${bev?.['NomeDoEvento'] ?? p.evento} — R$${p.Valor} em ${p.data?.slice(0,10)}`);
      continue;
    }

    const payDate = p.data ? p.data.slice(0, 10) : null;

    // Duplicata por chave natural?
    const key = `${supaEventId}|${payDate}|${p.Valor}`;
    if (existingKeys.has(key)) { skipped++; continue; }

    if (!DRY_RUN) {
      const { error } = await supabase.from('event_payments').insert({
        event_id:     supaEventId,
        bubble_id:    p._id,
        value:        p.Valor ?? 0,
        payment_date: payDate,
        is_confirmed: p.conferido === true,
        payment_type: 'outros',
        notes:        null,
      });
      if (error) {
        console.error(`  ✗ Erro (${p._id}):`, error.message);
        continue;
      }
      existingKeys.add(key);
    } else {
      const bev = bubbleEventMap[p.evento];
      console.log(`  [dry] ${bev?.['NomeDoEvento'] ?? supaEventId} — R$${p.Valor} em ${payDate}`);
    }

    inserted++;
  }

  console.log('\n=== Resultado ===');
  console.log(`✓ Inseridos:        ${inserted}`);
  console.log(`• Já existiam:      ${skipped}`);
  console.log(`✗ Sem match:        ${noMatch}`);

  if (missed.length > 0) {
    console.log('\nSem match (evento não encontrado no Supabase):');
    missed.forEach(m => console.log('  -', m));
  }

  if (inserted > 0 && !DRY_RUN) {
    console.log('\nSincronizando paid_value dos eventos...');
    const { error } = await supabase.rpc('sync_all_paid_values');
    if (error) console.log('  (trigger automático deve ter atualizado)');
    else console.log('  ✓ paid_value atualizado');
  }

  console.log('\nConcluído!');
}

main().catch(console.error);
