/**
 * sync-from-bubble.mjs
 *
 * Sincronização completa Bubble → Supabase (upsert seguro)
 *
 * USO:
 *   node scripts/migration/sync-from-bubble.mjs --dry-run   ← inspeciona sem alterar nada
 *   node scripts/migration/sync-from-bubble.mjs             ← executa de verdade
 *
 * O que faz:
 *   1. Clientes   — UPSERT por bubble_id (atualiza + insere novos)
 *   2. Eventos    — UPSERT por bubble_id com TODOS os campos do Bubble
 *   3. Pagamentos — INSERT apenas novos (não altera pagamentos existentes)
 *   4. Adicionais — INSERT apenas novos (não altera existentes)
 *   5. Degustações — DELETE ALL + RECRIA a partir do Bubble
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Config ────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

// Lê o .env local se existir
try {
  const env = readFileSync(resolve(__dirname, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
  }
} catch {}

const BUBBLE_BASE  = process.env.BUBBLE_BASE_URL  || 'https://rondellobuffet-app.com.br/api/1.1/obj';
const BUBBLE_TOKEN = process.env.BUBBLE_API_TOKEN  || 'b4b3c4138bb1000811d5a3c0ba47a238';
const SUPA_URL     = process.env.SUPABASE_URL      || 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPA_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_KEY) { console.error('❌  SUPABASE_SERVICE_ROLE_KEY não definido'); process.exit(1); }

const DRY   = process.argv.includes('--dry-run');
const DEBUG = process.argv.includes('--debug-names');
const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

// ─── Helpers ────────────────────────────────────────────────────────────────────
const str  = v  => (v != null && String(v).trim() !== '') ? String(v).trim() : null;
const num  = v  => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const bool = v  => {
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase().trim();
  return s === 'yes' || s === 'sim' || s === 'true' || s === '1';
};
const dateOnly = v => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};
const isoTs = v => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};
const parseTime = raw => {
  if (!raw) return null;
  const m = String(raw).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = m[1].padStart(2, '0'), mn = m[2];
  return (parseInt(h) <= 23 && parseInt(mn) <= 59) ? `${h}:${mn}` : null;
};
const parseDuration = raw => {
  if (!raw) return null;
  const m = String(raw).match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
};

function bubbleMarkupToHtml(val) {
  if (!val) return null;
  let s = String(val);
  s = s.replace(/\[ml\]/gi, '').replace(/\[\/ml\]/gi, '');
  s = s.replace(/\[indent=[^\]]*\]/gi, '');
  s = s.replace(/\[h([1-6])\]/gi, '<h$1>').replace(/\[\/h([1-6])\]/gi, '</h$1>');
  s = s.replace(/\[center\]/gi, '<div style="text-align:center">').replace(/\[\/center\]/gi, '</div>');
  s = s.replace(/\[ul\]/gi, '<ul>').replace(/\[\/ul\]/gi, '</ul>');
  s = s.replace(/\[ol\]/gi, '<ol>').replace(/\[\/ol\]/gi, '</ol>');
  s = s.replace(/\[li[^\]]*\]/gi, '<li>').replace(/\[\/li\]/gi, '</li>');
  s = s.replace(/\[b\]/gi, '<strong>').replace(/\[\/b\]/gi, '</strong>');
  s = s.replace(/\[i\]/gi, '<em>').replace(/\[\/i\]/gi, '</em>');
  s = s.replace(/\[u\]/gi, '<u>').replace(/\[\/u\]/gi, '</u>');
  s = s.replace(/\[s\]/gi, '<s>').replace(/\[\/s\]/gi, '</s>');
  s = s.replace(/\[color=([^\]]+)\]/gi, '<span style="color:$1">').replace(/\[\/color\]/gi, '</span>');
  s = s.replace(/\[highlight=([^\]]+)\]/gi, '<span style="background-color:$1">').replace(/\[\/highlight\]/gi, '</span>');
  s = s.replace(/\[size=(\d+)\]/gi, '<span style="font-size:$1pt">').replace(/\[\/size\]/gi, '</span>');
  s = s.replace(/\[font=([^\]]+)\]/gi, '<span style="font-family:$1">').replace(/\[\/font\]/gi, '</span>');
  s = s.replace(/\n/g, '<br>\n');
  return s.trim() || null;
}

const STATUS_MAP = {
  '1º contato': 'lead', '1o contato': 'lead', 'primeiro contato': 'lead',
  negociando: 'negotiating',
  fechado: 'confirmed',
  'não fechou': 'cancelled', 'nao fechou': 'cancelled',
  cancelado: 'cancelled',
  realizado: 'completed', concluido: 'completed', 'concluído': 'completed',
};

function mapStatus(raw) {
  if (!raw) return 'lead';
  const n = String(raw).trim().toLowerCase();
  if (STATUS_MAP[n]) return STATUS_MAP[n];
  if (n.includes('contato') || n.includes('contact')) return 'lead';
  if (n.includes('negoci')) return 'negotiating';
  if (n.includes('fecha') || n.includes('confirm')) return 'confirmed';
  if (n.includes('cancel')) return 'cancelled';
  if (n.includes('conclu') || n.includes('realiz')) return 'completed';
  return 'lead';
}

// ─── Bubble fetch ───────────────────────────────────────────────────────────────
async function fetchAll(type) {
  const all = [];
  let cursor = 0;
  const encodedType = encodeURIComponent(type);
  while (true) {
    const res = await fetch(
      `${BUBBLE_BASE}/${encodedType}?limit=100&cursor=${cursor}`,
      { headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` } }
    );
    if (!res.ok) throw new Error(`Bubble API [${type}] ${res.status}: ${res.statusText}`);
    const json = await res.json();
    const { results = [], remaining = 0 } = json.response ?? {};
    all.push(...results);
    process.stdout.write(`\r  Bubble/${type}: ${all.length} registros...`);
    if (remaining === 0) break;
    cursor += 100;
  }
  console.log('');
  return all;
}

// ─── 1. CLIENTES ───────────────────────────────────────────────────────────────
async function syncClients() {
  console.log('\n━━━ 1/5  CLIENTES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const raw = await fetchAll('Clientes_RondBuffet');
  console.log(`  Bubble: ${raw.length} clientes`);

  // Carrega existentes do Supabase
  const { data: existing } = await supabase.from('clients').select('id, bubble_id');
  const existMap = {};
  for (const c of existing ?? []) if (c.bubble_id) existMap[c.bubble_id] = c.id;
  console.log(`  Supabase: ${Object.keys(existMap).length} com bubble_id`);

  if (DRY) {
    const novos = raw.filter(c => !existMap[c._id]).length;
    const atualizar = raw.filter(c => existMap[c._id]).length;
    console.log(`  [DRY-RUN] ${novos} novos para inserir, ${atualizar} para atualizar`);
    const sample = raw.find(c => !existMap[c._id]) || raw[0];
    if (sample) console.log('  Amostra:', JSON.stringify({ bubble_id: sample._id, name: sample.NomeDoCliente, phone: sample.Telefone }, null, 2));
    return existMap;
  }

  let inserted = 0, updated = 0, errors = 0;
  const idMap = { ...existMap };

  for (const c of raw) {
    const record = {
      name:      str(c.NomeDoCliente) ?? '(sem nome)',
      phone:     str(c.Telefone),
      email:     str(c.email),
      cpf:       str(c.CPF),
      rg:        str(c.RG),
      address:   str(c['endereço']),
      zip_code:  str(c.CEP),
      bubble_id: c._id,
      updated_at: isoTs(c['Modified Date']) ?? new Date().toISOString(),
    };

    if (existMap[c._id]) {
      // Atualiza
      const { error } = await supabase.from('clients').update(record).eq('id', existMap[c._id]);
      if (error) { console.error(`  ✗ update client ${c._id}:`, error.message); errors++; }
      else updated++;
    } else {
      // Insere
      const { data, error } = await supabase.from('clients')
        .insert({ ...record, created_at: isoTs(c['Created Date']) ?? new Date().toISOString() })
        .select('id').single();
      if (error) { console.error(`  ✗ insert client ${c._id}:`, error.message); errors++; }
      else { idMap[c._id] = data.id; inserted++; }
    }
  }

  console.log(`  ✅ ${inserted} inseridos | ${updated} atualizados | ${errors} erros`);
  return idMap;
}

// ─── 2. EVENTOS ────────────────────────────────────────────────────────────────
async function syncEvents(clientIdMap) {
  console.log('\n━━━ 2/5  EVENTOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const raw = await fetchAll('eventos');
  console.log(`  Bubble: ${raw.length} eventos`);

  const { data: existing } = await supabase.from('events').select('id, bubble_id, status');
  const existMap = {};
  for (const e of existing ?? []) if (e.bubble_id) existMap[e.bubble_id] = e;
  console.log(`  Supabase: ${Object.keys(existMap).length} com bubble_id`);

  if (DRY) {
    const novos = raw.filter(e => !existMap[e._id]).length;
    const atualizar = raw.filter(e => existMap[e._id]).length;
    // Mostra mudanças de status
    const statusChange = raw.filter(e => {
      const ex = existMap[e._id];
      if (!ex) return false;
      return mapStatus(e.status) !== ex.status;
    });
    console.log(`  [DRY-RUN] ${novos} novos para inserir, ${atualizar} para atualizar`);
    if (statusChange.length) {
      console.log(`  ⚠  ${statusChange.length} eventos com MUDANÇA DE STATUS:`);
      statusChange.slice(0, 10).forEach(e => {
        console.log(`     "${e.NomeDoEvento}" — Bubble: "${e.status}" → Supabase atual: "${existMap[e._id].status}" → Novo: "${mapStatus(e.status)}"`);
      });
    }
    const sample = raw.find(e => !existMap[e._id]) || raw[0];
    if (sample) {
      const clientId = clientIdMap[sample.Cliente] || null;
      console.log('\n  Amostra evento novo:', JSON.stringify({
        bubble_id: sample._id,
        event_name: str(sample.NomeDoEvento),
        status: mapStatus(sample.status),
        event_date: dateOnly(sample.dataDoEvento),
        client_id: clientId,
      }, null, 2));
    }
    // retorna mapa real para que degustações possam simular vínculos no dry-run
    const dryMap = {};
    for (const e of existing ?? []) if (e.bubble_id) dryMap[e.bubble_id] = e.id;
    return dryMap;
  }

  let inserted = 0, updated = 0, errors = 0;
  const idMap = {};
  for (const e of existing ?? []) if (e.bubble_id) idMap[e.bubble_id] = e.id;

  for (const ev of raw) {
    const clientId = clientIdMap[ev.Cliente] ?? null;
    const contractDate = dateOnly(ev.dataQueFechouContrato);

    const bubbleName = str(ev.NomeDoEvento) ?? str(ev['Nome do Evento']) ?? str(ev.nomeDoEvento);

    const record = {
      client_id:              clientId,
      ...(bubbleName !== null ? { event_name: bubbleName } : {}),
      event_type:             str(ev.Tipo_Do_Evento),
      status:                 mapStatus(ev.status),
      event_date:             dateOnly(ev.dataDoEvento),
      location_text:          str(ev['Local Do Evento_TXT']),
      guest_count:            num(ev.QtdConvidados),
      children_50_pct:        num(ev['Crianças50%']),
      non_paying_guests:      num(ev.CriançasNãoPagantes),
      price_per_person:       num(ev.PreçoCombinado),
      total_value:            num(ev.ValorTotalEvento),
      contract_signed:        contractDate !== null,
      contract_signed_date:   contractDate,
      is_paid_in_full:        bool(ev.Quitado),
      notes:                  bubbleMarkupToHtml(ev.Observações),
      ceremony_time:          parseTime(ev.HorarioCerimonia),
      duration_hours:         parseDuration(ev['duração do evento']),
      organizer:              str(ev['Organizador(a) escolhido']),
      decorator:              str(ev.Decorador),
      additional_hours:       num(ev.QtdHorasAdicionais),
      professional_count:     num(ev.QuantidadeProfissionais),
      professional_meal_value:num(ev['AlimentaçãoProfissionais']),
      professional_meal_type: str(ev.tipoAlimentProf),
      bubble_id:              ev._id,
      updated_at:             isoTs(ev['Modified Date']) ?? new Date().toISOString(),
    };

    if (existMap[ev._id]) {
      const { error } = await supabase.from('events').update(record).eq('id', existMap[ev._id].id);
      if (error) { console.error(`  ✗ update event ${ev._id} "${ev.NomeDoEvento}":`, error.message); errors++; }
      else updated++;
    } else {
      const { data, error } = await supabase.from('events')
        .insert({ ...record, created_at: isoTs(ev['Created Date']) ?? new Date().toISOString() })
        .select('id').single();
      if (error) { console.error(`  ✗ insert event ${ev._id} "${ev.NomeDoEvento}":`, error.message); errors++; }
      else { idMap[ev._id] = data.id; inserted++; }
    }
  }

  console.log(`  ✅ ${inserted} inseridos | ${updated} atualizados | ${errors} erros`);
  return idMap;
}

// ─── 3. PAGAMENTOS ─────────────────────────────────────────────────────────────
async function syncPayments(eventIdMap) {
  console.log('\n━━━ 3/5  PAGAMENTOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const raw = await fetchAll('Pagamentos');
  console.log(`  Bubble: ${raw.length} pagamentos`);

  if (DRY) {
    console.log(`  [DRY-RUN] UPSERT por bubble_id — ${raw.length} pagamentos do Bubble`);
    const sample = raw.find(p => p.evento) || raw[0];
    if (sample) console.log('  Amostra:', JSON.stringify({ bubble_id: sample._id, value: sample.Valor, confirmed: sample.conferido }, null, 2));
    return;
  }

  let upserted = 0, noEvent = 0, errors = 0;

  for (const p of raw) {
    const eventId = eventIdMap[p.evento];
    if (!eventId) { noEvent++; continue; }

    const { error } = await supabase.from('event_payments').upsert({
      event_id:     eventId,
      bubble_id:    p._id,
      value:        num(p.Valor) ?? 0,
      payment_date: dateOnly(p.data),
      is_confirmed: bool(p.conferido),
      payment_type: bool(p.deg) ? 'tasting' : 'outros',
    }, { onConflict: 'bubble_id', ignoreDuplicates: false });

    if (error) { console.error(`  ✗ pagamento ${p._id}:`, error.message); errors++; }
    else upserted++;
  }

  console.log(`  ✅ ${upserted} upserted | ${noEvent} sem evento | ${errors} erros`);
}

// ─── 4. VALORES ADICIONAIS ─────────────────────────────────────────────────────
async function syncAdditionals(eventIdMap) {
  console.log('\n━━━ 4/5  VALORES ADICIONAIS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const raw = await fetchAll('ValoresAdicionaisEventos');
  console.log(`  Bubble: ${raw.length} adicionais`);

  if (DRY) {
    console.log(`  [DRY-RUN] UPSERT por bubble_id — ${raw.length} adicionais do Bubble`);
    return;
  }

  let upserted = 0, noEvent = 0, errors = 0;

  for (const item of raw) {
    const eventId = eventIdMap[item.evento];
    if (!eventId) { noEvent++; continue; }

    const { error } = await supabase.from('event_additional_values').upsert({
      event_id:    eventId,
      bubble_id:   item._id,
      description: str(item['Descrição']) ?? 'Valor adicional',
      value:       num(item.valor) ?? 0,
    }, { onConflict: 'bubble_id', ignoreDuplicates: false });

    if (error) { console.error(`  ✗ adicional ${item._id}:`, error.message); errors++; }
    else upserted++;
  }

  console.log(`  ✅ ${upserted} upserted | ${noEvent} sem evento | ${errors} erros`);
}

// ─── 5. DEGUSTAÇÕES ────────────────────────────────────────────────────────────
async function syncTastings(eventIdMap) {
  console.log('\n━━━ 5/5  DEGUSTAÇÕES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const raw = await fetchAll('Degustação');
  console.log(`  Bubble: ${raw.length} sessões`);

  if (DRY) {
    let totalEventos = 0, totalConfirmados = 0, totalSemMatch = 0, semNome = 0;
    for (const s of raw) {
      const evs = Array.isArray(s.eventos) ? s.eventos : [];
      const conf = new Set(Array.isArray(s.eventosConfirmados) ? s.eventosConfirmados : []);
      totalEventos += evs.length;
      totalConfirmados += evs.filter(id => conf.has(id)).length;
      totalSemMatch += evs.filter(id => !eventIdMap[id]).length;
    }
    const totalNovos = totalEventos - totalConfirmados;
    console.log(`  [DRY-RUN] Vai UPSERT ${raw.length} sessões por bubble_id`);
    console.log(`  Total vínculos: ${totalEventos} (${totalConfirmados} confirmados + ${totalNovos} novos/leads)`);
    console.log(`  IDs sem match no Supabase: ${totalSemMatch}`);
    const s = raw[0];
    if (s) console.log('  Amostra:', JSON.stringify({ bubble_id: s._id, date: s.data, tipo: s.TipoDeg, eventos: s.eventos?.length ?? 0 }, null, 2));
    return;
  }

  const TIPO_MAP = {
    '1684957812120x867236156745106200': 'Jantar',
    '1684957827210x720560994941090000': 'Almoço',
  };

  let sessOk = 0, evtOk = 0, evtSkip = 0, errors = [];

  for (const s of raw) {
    const date = dateOnly(s.data);
    if (!date) { evtSkip++; continue; }

    const tipo = str(s.TipoDeg) ?? TIPO_MAP[s.tipo_degust] ?? null;

    // UPSERT por bubble_id — seguro para rodar múltiplas vezes
    const { data: sess, error: sErr } = await supabase
      .from('tasting_sessions')
      .upsert({
        bubble_id:      s._id,
        scheduled_date: date,
        type:           tipo,
        max_couples:    num(s['Limite de casais']) ?? 4,
        menu_text:      str(s['Cardápio']),
        notes:          str(s['Observações']),
        created_at:     isoTs(s['Created Date']) ?? new Date().toISOString(),
      }, { onConflict: 'bubble_id' })
      .select('id').single();

    if (sErr) { errors.push(`sessão ${date}: ${sErr.message}`); continue; }
    sessOk++;

    // Apaga vínculos antigos desta sessão e recria (evita duplicatas de eventos)
    await supabase.from('tasting_session_events').delete().eq('session_id', sess.id);

    const confirmadosSet = new Set(Array.isArray(s.eventosConfirmados) ? s.eventosConfirmados : []);

    for (const bubbleId of (Array.isArray(s.eventos) ? s.eventos : [])) {
      const eventId = eventIdMap[bubbleId];
      if (!eventId) { evtSkip++; continue; }
      const snap = confirmadosSet.has(bubbleId) ? 'confirmed' : 'new';
      const { error } = await supabase.from('tasting_session_events').insert({
        session_id: sess.id,
        event_id:   eventId,
        situation_snapshot: snap,
        is_second_tasting:  false,
        created_at: isoTs(s['Created Date']) ?? new Date().toISOString(),
      });
      if (error) errors.push(`evt ${bubbleId} (${snap}): ${error.message}`);
      else evtOk++;
    }
  }

  console.log(`  ✅ ${sessOk}/${raw.length} sessões | ${evtOk} vínculos | ${evtSkip} sem match`);
  if (errors.length) {
    console.log(`  ⚠  ${errors.length} erros:`);
    errors.slice(0, 5).forEach(e => console.log(`    ${e}`));
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────────
async function main() {
  const start = Date.now();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║   Bubble → Supabase SYNC  ${DRY ? '[DRY-RUN — nada será alterado]' : '[LIVE — alterando dados]   '}  ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (!DRY) {
    console.log('\n⚠  MODO LIVE — dados serão alterados no Supabase.');
    console.log('   Pressione Ctrl+C agora para cancelar. Iniciando em 5s...\n');
    await new Promise(r => setTimeout(r, 5000));
  }

  try {
    const clientIdMap = await syncClients();
    const eventIdMap  = await syncEvents(clientIdMap);
    await syncPayments(eventIdMap);
    await syncAdditionals(eventIdMap);
    await syncTastings(eventIdMap);
  } catch (err) {
    console.error('\n✖ ERRO FATAL:', err.message);
    process.exit(1);
  }

  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n${'═'.repeat(60)}`);
  if (DRY) {
    console.log('✔  DRY-RUN concluído. Nenhum dado foi alterado.');
    console.log('   Para executar de verdade: node scripts/migration/sync-from-bubble.mjs');
  } else {
    console.log(`✔  Sync concluído em ${secs}s`);
  }
}

main().catch(err => { console.error('✖', err); process.exit(1); });
