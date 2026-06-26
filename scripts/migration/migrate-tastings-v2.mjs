/**
 * Migração correta das degustações do Bubble → tasting_sessions + tasting_session_events
 * Cada Degustação do Bubble = 1 sessão. Casais vinculados via campos eventos (fechados) e leads (pipeline).
 */

import { createClient } from '@supabase/supabase-js';

const BUBBLE_BASE  = 'https://rondellobuffet-app.com.br/api/1.1/obj';
const BUBBLE_TOKEN = 'b4b3c4138bb1000811d5a3c0ba47a238';
const SUPABASE_URL = 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) { console.error('❌ Set SUPABASE_SERVICE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAllBubble(type, params = '') {
  const all = [];
  let cursor = 0;
  while (true) {
    const res = await fetch(
      `${BUBBLE_BASE}/${type}?limit=100&cursor=${cursor}${params}`,
      { headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` } }
    );
    const json = await res.json();
    if (!json.response) { console.error('API error:', json); break; }
    const { results, remaining } = json.response;
    all.push(...results);
    process.stdout.write(`\r  ${type}: ${all.length} registros...`);
    if (remaining === 0) break;
    cursor += 100;
  }
  console.log('');
  return all;
}

async function main() {
  console.log('\n── 1. Buscando Degustações do Bubble ──');
  const sessions = await fetchAllBubble('Degusta%C3%A7%C3%A3o');
  console.log(`✓ ${sessions.length} sessões`);

  // ── 2. Busca mapa bubble_id → Supabase event UUID ──
  console.log('\n── 2. Carregando eventos do Supabase ──');
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, bubble_id, status');
  if (evErr) throw evErr;

  const bubbleToEvent = {};
  for (const e of events) {
    if (e.bubble_id) bubbleToEvent[e.bubble_id] = e;
  }
  console.log(`✓ ${events.length} eventos no Supabase`);

  // ── 3. Limpa dados antigos ──
  console.log('\n── 3. Limpando dados antigos ──');
  const { error: delEvt } = await supabase
    .from('tasting_session_events')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  const { error: delSess } = await supabase
    .from('tasting_sessions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (delEvt) throw delEvt;
  if (delSess) throw delSess;
  console.log('✓ Limpo');

  // ── 4. Insere sessões e vincula casais ──
  console.log('\n── 4. Inserindo sessões e casais ──');

  const PIPELINE = new Set(['lead', 'negotiating', 'tasting_scheduled']);

  let sessOk = 0, evtOk = 0, evtSkip = 0;
  const errors = [];

  for (const s of sessions) {
    const date = s.data?.split('T')[0];
    if (!date) { evtSkip++; continue; }

    // Tipo: usa TipoDeg (string) se disponível, fallback para tipo_degust ID
    const TIPO_ID_MAP = {
      '1684957812120x867236156745106200': 'Jantar',
      '1684957827210x720560994941090000': 'Almoço',
    };
    const tipo = s.TipoDeg ?? TIPO_ID_MAP[s.tipo_degust] ?? null;

    // Cria a sessão
    const { data: sess, error: sErr } = await supabase
      .from('tasting_sessions')
      .insert({
        scheduled_date: date,
        type: tipo,
        max_couples: s['Limite de casais'] ?? 4,
        menu_text: s['Cardápio'] ?? null,
        notes: s['Observações'] ?? null,
        created_at: s['Created Date'] ?? new Date().toISOString(),
      })
      .select('id')
      .single();

    if (sErr) {
      errors.push(`sessão ${date}: ${sErr.message}`);
      continue;
    }
    sessOk++;

    // Casais de eventos fechados (situation_snapshot = 'confirmed')
    const eventoIds = Array.isArray(s.eventos) ? s.eventos : [];
    for (const bubbleId of eventoIds) {
      const ev = bubbleToEvent[bubbleId];
      if (!ev) { evtSkip++; continue; }

      const { error: eErr } = await supabase
        .from('tasting_session_events')
        .insert({
          session_id: sess.id,
          event_id: ev.id,
          situation_snapshot: 'confirmed',
          is_second_tasting: false,
          created_at: s['Created Date'] ?? new Date().toISOString(),
        });

      if (eErr) errors.push(`evento ${bubbleId}: ${eErr.message}`);
      else evtOk++;
    }

    // Casais de leads/negociação (situation_snapshot = 'new')
    const leadIds = Array.isArray(s.leads) ? s.leads : [];
    for (const bubbleId of leadIds) {
      const ev = bubbleToEvent[bubbleId];
      if (!ev) { evtSkip++; continue; }

      const { error: eErr } = await supabase
        .from('tasting_session_events')
        .insert({
          session_id: sess.id,
          event_id: ev.id,
          situation_snapshot: 'new',
          is_second_tasting: false,
          created_at: s['Created Date'] ?? new Date().toISOString(),
        });

      if (eErr) errors.push(`lead ${bubbleId}: ${eErr.message}`);
      else evtOk++;
    }
  }

  console.log(`\n✅ Concluído:`);
  console.log(`   ${sessOk}/${sessions.length} sessões criadas`);
  console.log(`   ${evtOk} casais vinculados`);
  console.log(`   ${evtSkip} IDs sem match no Supabase`);
  if (errors.length) {
    console.log(`\n⚠️  ${errors.length} erros:`);
    errors.slice(0, 10).forEach(e => console.log(`   ${e}`));
  }
}

main().catch(console.error);
