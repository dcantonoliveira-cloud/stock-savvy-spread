/**
 * Cruza eventos Bubble → Supabase e vincula location_id, organizer_id, decorator_id
 * Estratégia: match por event_name + event_date
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vfrtvnzptaazhzfirflm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcnR2bnpwdGFhemh6ZmlyZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyODYyOSwiZXhwIjoyMDg5MDA0NjI5fQ.bR1zR4gfcAOOEQhGizaXOAALN0HD7RQTsUZunYXRbrM'
);

const COMPANY_ID  = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';
const BUBBLE_BASE = 'https://rondellobuffet-app.com.br/api/1.1/obj';
const TOKEN       = 'b4b3c4138bb1000811d5a3c0ba47a238';

const norm = s => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const toDate = val => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
};

function fetchJson(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b)));
    }).on('error', rej);
  });
}

async function fetchAllBubble() {
  let cursor = 0, all = [];
  while (true) {
    const data = await fetchJson(`${BUBBLE_BASE}/eventos?limit=100&cursor=${cursor}`);
    all.push(...data.response.results);
    if (data.response.remaining === 0) break;
    cursor += 100;
  }
  return all;
}

async function fetchAllSupabase(table, select, filters = {}) {
  let rows = [], from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + 999);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) { console.error(`Erro ${table}:`, error.message); break; }
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function main() {
  console.log('⏳ Carregando dados...');

  const [bubbleEvents, sbEvents, locations, suppliers] = await Promise.all([
    fetchAllBubble(),
    fetchAllSupabase('events', 'id,event_name,event_date', { company_id: COMPANY_ID }),
    fetchAllSupabase('event_locations', 'id,name', { company_id: COMPANY_ID }),
    fetchAllSupabase('suppliers', 'id,name,type', { company_id: COMPANY_ID }),
  ]);

  console.log(`  Bubble: ${bubbleEvents.length} | Supabase: ${sbEvents.length}`);
  console.log(`  Locais: ${locations.length} | Fornecedores: ${suppliers.length}`);

  const organizers = suppliers.filter(s => s.type === 'organizer');
  const decorators = suppliers.filter(s => s.type === 'decorator');

  // Mapas de lookup por nome normalizado
  const locMap  = new Map(locations.map(r  => [norm(r.name), r.id]));
  const orgMap  = new Map(organizers.map(r => [norm(r.name), r.id]));
  const decMap  = new Map(decorators.map(r => [norm(r.name), r.id]));

  // Mapa de eventos Supabase: "nome|data" → id
  const sbMap = new Map(sbEvents.map(e => [`${norm(e.event_name)}|${e.event_date ?? ''}`, e.id]));

  // Processar eventos do Bubble
  const EMPTY = new Set(['não tem', 'nao tem', 'não tem ainda', '—', '-', '?', '??', '???', 'não', 'nao', 'indefinido', '']);

  let matched = 0, noMatch = 0, locLinked = 0, orgLinked = 0, decLinked = 0;
  const updates = [];

  for (const bev of bubbleEvents) {
    const name    = norm(bev['NomeDoEvento']);
    const date    = toDate(bev['dataDoEvento']);
    const key     = `${name}|${date ?? ''}`;
    const sbId    = sbMap.get(key);

    if (!sbId) { noMatch++; continue; }
    matched++;

    const locText = bev['Local Do Evento_TXT'];
    const orgText = bev['Organizador(a) escolhido'];
    const decText = bev['Decorador'];

    const locId = (!locText || EMPTY.has(norm(locText))) ? null : locMap.get(norm(locText)) ?? null;
    const orgId = (!orgText || EMPTY.has(norm(orgText))) ? null : orgMap.get(norm(orgText)) ?? null;
    const decId = (!decText || EMPTY.has(norm(decText))) ? null : decMap.get(norm(decText)) ?? null;

    if (locId) locLinked++;
    if (orgId) orgLinked++;
    if (decId) decLinked++;

    updates.push({ id: sbId, location_id: locId, organizer_id: orgId, decorator_id: decId });
  }

  console.log(`\n🔗 Match: ${matched} eventos | Sem match: ${noMatch}`);
  console.log(`   Locais: ${locLinked} | Organizadoras: ${orgLinked} | Decoradores: ${decLinked}`);

  if (updates.length === 0) { console.log('Nada a atualizar.'); return; }

  console.log('\n⏳ Atualizando Supabase...');
  let done = 0;
  const BATCH = 20;
  for (let i = 0; i < updates.length; i += BATCH) {
    await Promise.all(updates.slice(i, i + BATCH).map(({ id, location_id, organizer_id, decorator_id }) =>
      supabase.from('events').update({ location_id, organizer_id, decorator_id }).eq('id', id)
    ));
    done += Math.min(BATCH, updates.length - i);
    process.stdout.write(`\r  ${done}/${updates.length}`);
  }

  console.log(`\n\n✅ Vinculação concluída!`);
}

main().catch(console.error);
