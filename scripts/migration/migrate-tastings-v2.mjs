/**
 * Migração correta das degustações do Bubble para tasting_sessions + tasting_session_events
 * Agrupa por (data + tipo_degust) para separar Jantar vs Almoço na mesma data
 */

import { createClient } from '@supabase/supabase-js';

const BUBBLE_BASE = 'https://rondellobuffet-app.com.br/api/1.1/obj';
const BUBBLE_TOKEN = 'b4b3c4138bb1000811d5a3c0ba47a238';

// IDs de tipo_degust → nome legível (verificado: Jantar tem "JANTAR" no cardápio)
const TIPO_MAP = {
  '1684957812120x867236156745106200': 'Jantar',
  '1684957827210x720560994941090000': 'Almoço',
};

const SUPABASE_URL = 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ Set SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAllBubble() {
  const all = [];
  let cursor = 0;
  while (true) {
    const res = await fetch(
      `${BUBBLE_BASE}/Degusta%C3%A7%C3%A3o?limit=100&cursor=${cursor}`,
      { headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` } }
    );
    const json = await res.json();
    const { results, remaining } = json.response;
    all.push(...results);
    console.log(`  Bubble: ${all.length} registros (${remaining} restantes)`);
    if (remaining === 0) break;
    cursor += 100;
  }
  return all;
}

async function main() {
  console.log('\n── Buscando degustações do Bubble ──');
  const bubbleRecords = await fetchAllBubble();
  console.log(`✓ Total: ${bubbleRecords.length} registros`);

  // ── Busca mapeamento bubble_id → event_id + confirmed do Supabase ──
  console.log('\n── Buscando tastings do Supabase ──');
  const { data: tastings, error: tErr } = await supabase
    .from('tastings')
    .select('bubble_id, event_id, confirmed, guest_count');
  if (tErr) throw tErr;

  const bubbleToSupabase = {};
  for (const t of tastings) {
    if (t.bubble_id) bubbleToSupabase[t.bubble_id] = t;
  }
  console.log(`✓ ${tastings.length} tastings no Supabase`);

  // ── Agrupa Bubble records por (data + tipo_degust) ──
  const sessions = {}; // key: "date|tipo_id"
  for (const r of bubbleRecords) {
    const date = r.data?.split('T')[0];
    if (!date) continue;
    const tipoId = r.tipo_degust ?? 'null';
    const key = `${date}|${tipoId}`;
    if (!sessions[key]) {
      sessions[key] = {
        scheduled_date: date,
        type: TIPO_MAP[tipoId] ?? null,
        menu_text: r['Cardápio'] ?? null,
        records: [],
      };
    }
    sessions[key].records.push(r);
  }

  const sessionList = Object.values(sessions);
  console.log(`\n── ${sessionList.length} sessões identificadas ──`);
  sessionList.sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  sessionList.forEach(s => {
    console.log(`  ${s.scheduled_date} ${s.type ?? '—'}: ${s.records.length} casais`);
  });

  // ── Limpa dados antigos ──
  console.log('\n── Limpando dados antigos ──');
  await supabase.from('tasting_session_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tasting_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✓ Limpo');

  // ── Insere sessões ──
  console.log('\n── Inserindo sessões ──');
  let sessOk = 0, evtOk = 0, evtSkip = 0;

  for (const s of sessionList) {
    // Pega a data de criação mais antiga do grupo
    const createdAt = s.records
      .map(r => r['Created Date'])
      .filter(Boolean)
      .sort()[0] ?? new Date().toISOString();

    const { data: sess, error: sErr } = await supabase
      .from('tasting_sessions')
      .insert({
        scheduled_date: s.scheduled_date,
        type: s.type,
        menu_text: s.menu_text,
        created_at: createdAt,
      })
      .select('id')
      .single();

    if (sErr) { console.error(`  ✗ sessão ${s.scheduled_date}:`, sErr.message); continue; }
    sessOk++;

    // Insere eventos vinculados
    for (const r of s.records) {
      const sup = bubbleToSupabase[r._id];
      if (!sup?.event_id) {
        evtSkip++;
        continue;
      }

      const PIPELINE = ['lead', 'negotiating', 'tasting_scheduled'];
      // situation_snapshot: confirmed = cliente já tinha evento fechado ao ser alocado
      const snapshot = sup.confirmed ? 'confirmed' : 'new';

      const { error: eErr } = await supabase
        .from('tasting_session_events')
        .insert({
          session_id: sess.id,
          event_id: sup.event_id,
          situation_snapshot: snapshot,
          guest_count: sup.guest_count ?? r.convidados ?? null,
          is_second_tasting: false,
          created_at: r['Created Date'] ?? new Date().toISOString(),
        });

      if (eErr) { console.error(`  ✗ evento ${r._id}:`, eErr.message); }
      else evtOk++;
    }
  }

  console.log(`\n✅ Concluído:`);
  console.log(`   ${sessOk} sessões criadas`);
  console.log(`   ${evtOk} eventos vinculados`);
  console.log(`   ${evtSkip} eventos sem event_id (sem match no Supabase)`);
}

main().catch(console.error);
