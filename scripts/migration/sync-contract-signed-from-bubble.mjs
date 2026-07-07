/**
 * Sincroniza o campo Contratoassinado (yes/no) do Bubble para contract_signed no Supabase.
 * Match por NomeDoEvento + dataDoEvento (fallback: só nome).
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=xxx node scripts/migration/sync-contract-signed-from-bubble.mjs
 */

import { createClient } from '@supabase/supabase-js';

const BUBBLE_BASE  = 'https://rondellobuffet-app.com.br/api/1.1/obj';
const BUBBLE_TOKEN = 'b4b3c4138bb1000811d5a3c0ba47a238';
const SUPABASE_URL = 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_Al-4U7Sa5TSXj7DEk8d-BA_B9HuCqHB';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAllBubble() {
  const PAGE = 100;
  let cursor = 0;
  let all = [];

  while (true) {
    const url = `${BUBBLE_BASE}/eventos?limit=${PAGE}&cursor=${cursor}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` } });
    const json = await res.json();
    const { results, remaining } = json.response;
    all = all.concat(results);
    process.stdout.write(`\r  Bubble: ${all.length} eventos buscados...`);
    if (remaining === 0) break;
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
  console.log('=== Sincronizando Contratoassinado do Bubble → Supabase ===\n');

  console.log('Buscando eventos do Bubble...');
  const bubbleEvents = await fetchAllBubble();

  const signed = bubbleEvents.filter(e => e['Contratoassinado'] === true || e['Contratoassinado'] === 'yes');
  console.log(`Total Bubble: ${bubbleEvents.length} | Com contrato assinado: ${signed.length}`);

  console.log('\nBuscando eventos do Supabase...');
  const { data: supaEvents, error } = await supabase
    .from('events')
    .select('id, event_name, event_date, contract_signed');
  if (error) throw error;
  console.log(`Total Supabase: ${supaEvents.length}`);

  let updated   = 0;
  let already   = 0;
  let notFound  = 0;
  const missed  = [];

  for (const bev of signed) {
    const bName = normalize(bev['NomeDoEvento']);
    const bDate = bev['dataDoEvento'];

    // Match por nome + data
    let match = supaEvents.find(s =>
      normalize(s.event_name) === bName && sameDate(bDate, s.event_date)
    );

    // Fallback: só pelo nome (quando há apenas 1 resultado)
    if (!match) {
      const byName = supaEvents.filter(s => normalize(s.event_name) === bName);
      if (byName.length === 1) match = byName[0];
    }

    if (!match) {
      notFound++;
      missed.push(`${bev['NomeDoEvento']} (${bDate?.slice(0, 10) ?? '?'})`);
      continue;
    }

    if (match.contract_signed) {
      already++;
      continue;
    }

    const { error: err } = await supabase
      .from('events')
      .update({
        contract_signed: true,
        // Usa a data do evento como data de assinatura se não houver outra info
        contract_signed_date: match.event_date ?? bDate?.slice(0, 10) ?? null,
      })
      .eq('id', match.id);

    if (err) {
      console.error(`  ✗ Erro ao atualizar "${bev['NomeDoEvento']}":`, err.message);
    } else {
      updated++;
      console.log(`  ✓ ${bev['NomeDoEvento']}`);
    }
  }

  console.log('\n=== Resultado ===');
  console.log(`✓ Atualizados:      ${updated}`);
  console.log(`• Já marcados:      ${already}`);
  console.log(`✗ Não encontrados:  ${notFound}`);

  if (missed.length > 0) {
    console.log('\nNão encontrados:');
    missed.forEach(m => console.log('  -', m));
  }
}

main().catch(console.error);
