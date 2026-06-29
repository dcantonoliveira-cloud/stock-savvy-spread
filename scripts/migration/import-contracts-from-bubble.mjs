/**
 * Importa txt_contrato e Anexo 1 do Bubble para o Supabase (contract_text, annex_1_text)
 * Faz o match por NomeDoEvento + dataDoEvento
 *
 * Usage: node scripts/migration/import-contracts-from-bubble.mjs
 */

import { createClient } from '@supabase/supabase-js';

const BUBBLE_BASE  = 'https://rondellobuffet-app.com.br/api/1.1/obj';
const BUBBLE_TOKEN = 'b4b3c4138bb1000811d5a3c0ba47a238';
const SUPABASE_URL = 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key

if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAllBubble() {
  const PAGE = 100;
  let cursor = 0;
  let all = [];

  while (true) {
    const url = `${BUBBLE_BASE}/eventos?limit=${PAGE}&cursor=${cursor}&fields=_id,NomeDoEvento,dataDoEvento,txt_contrato,Anexo+1`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` } });
    const json = await res.json();
    const { results, remaining } = json.response;
    all = all.concat(results);
    console.log(`  Bubble: fetched ${all.length} events...`);
    if (remaining === 0) break;
    cursor += PAGE;
  }

  return all;
}

async function fetchSupabaseEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_name, event_date, contract_text, annex_1_text')
    .order('event_date');
  if (error) throw error;
  return data;
}

function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function sameDate(bubbleDate, supaDate) {
  if (!bubbleDate || !supaDate) return false;
  return bubbleDate.slice(0, 10) === supaDate.slice(0, 10);
}

async function main() {
  console.log('Buscando eventos do Bubble...');
  const bubbleEvents = await fetchAllBubble();
  const withContract = bubbleEvents.filter(e => e.txt_contrato || e['Anexo 1']);
  console.log(`Total Bubble: ${bubbleEvents.length} | Com contrato: ${withContract.length}`);

  console.log('Buscando eventos do Supabase...');
  const supaEvents = await fetchSupabaseEvents();
  console.log(`Total Supabase: ${supaEvents.length}`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const bev of withContract) {
    const bName = normalize(bev.NomeDoEvento);
    const bDate = bev.dataDoEvento;

    // Match por nome + data
    const match = supaEvents.find(s =>
      normalize(s.event_name) === bName && sameDate(bDate, s.event_date)
    );

    if (!match) {
      // Tenta só pelo nome (data pode estar diferente)
      const byName = supaEvents.filter(s => normalize(s.event_name) === bName);
      if (byName.length === 1) {
        const s = byName[0];
        await doUpdate(s.id, bev, supabase);
        updated++;
        console.log(`  ✓ (por nome) ${bev.NomeDoEvento}`);
      } else {
        notFound++;
        console.log(`  ✗ não encontrado: ${bev.NomeDoEvento} ${bDate?.slice(0,10)}`);
      }
      continue;
    }

    await doUpdate(match.id, bev, supabase);
    updated++;
    console.log(`  ✓ ${bev.NomeDoEvento}`);
  }

  console.log(`\nConcluído: ${updated} atualizados | ${skipped} já tinham contrato | ${notFound} não encontrados`);
}

function bubbleToHtml(text) {
  if (!text) return '';
  let s = text;

  // Remove [ml]...[/ml] wrapper
  s = s.replace(/\[ml\]/g, '').replace(/\[\/ml\]/g, '');

  // Block tags
  s = s.replace(/\[center\]([\s\S]*?)\[\/center\]/g, '<div style="text-align:center">$1</div>');
  s = s.replace(/\[h1\]([\s\S]*?)\[\/h1\]/g, '<h1>$1</h1>');
  s = s.replace(/\[h2\]([\s\S]*?)\[\/h2\]/g, '<h2>$1</h2>');
  s = s.replace(/\[h3\]([\s\S]*?)\[\/h3\]/g, '<h3>$1</h3>');
  s = s.replace(/\[h4\]([\s\S]*?)\[\/h4\]/g, '<h4>$1</h4>');
  s = s.replace(/\[quote\]([\s\S]*?)\[\/quote\]/g, '<blockquote>$1</blockquote>');
  s = s.replace(/\[ul\]([\s\S]*?)\[\/ul\]/g, '<ul>$1</ul>');
  s = s.replace(/\[li[^\]]*\]([\s\S]*?)\[\/li\]/g, '<li>$1</li>');

  // Inline tags
  s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<strong>$1</strong>');
  s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<em>$1</em>');
  s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/g, '<u>$1</u>');
  s = s.replace(/\[s\]([\s\S]*?)\[\/s\]/g, '<s>$1</s>');
  s = s.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/g, '<span style="color:$1">$2</span>');
  s = s.replace(/\[highlight=([^\]]+)\]([\s\S]*?)\[\/highlight\]/g, '<span style="background-color:$1">$2</span>');
  s = s.replace(/\[size=\d+\]([\s\S]*?)\[\/size\]/g, '$1');

  // Remove any remaining unknown tags
  s = s.replace(/\[[^\]]*\]/g, '');

  // Newlines to <br> (outside block tags)
  s = s.replace(/\n/g, '<br>');

  return s;
}

async function doUpdate(eventId, bev, supabase) {
  const payload = {};
  if (bev.txt_contrato) payload.contract_text = bubbleToHtml(bev.txt_contrato);
  if (bev['Anexo 1'])   payload.annex_1_text  = bubbleToHtml(bev['Anexo 1']);

  const { error } = await supabase.from('events').update(payload).eq('id', eventId);
  if (error) console.error(`  Erro ao atualizar ${eventId}:`, error.message);
}

main().catch(console.error);
