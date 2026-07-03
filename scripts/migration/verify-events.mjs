/**
 * verify-events.mjs
 *
 * 1. Busca todos os eventos do Supabase (com bubble_id)
 * 2. Para cada um, consulta o Bubble pelo ID e compara campos
 * 3. Atualiza o que estiver diferente
 * 4. Reporta eventos que existem no Bubble mas não no Supabase
 *
 * USO:
 *   node scripts/migration/verify-events.mjs --dry-run   ← só mostra diferenças
 *   node scripts/migration/verify-events.mjs             ← aplica correções
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const DRY = process.argv.includes('--dry-run');
const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

// ── Helpers ──────────────────────────────────────────────────────────────────
const str = v => (v != null && String(v).trim() !== '') ? String(v).trim() : null;
const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const bool = v => {
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

// Converte registro do Bubble para campos do Supabase
function bubbleToSupabase(ev) {
  const contractDate = dateOnly(ev.dataQueFechouContrato);
  return {
    event_name:              str(ev.NomeDoEvento) ?? str(ev['Nome do Evento']) ?? str(ev.nomeDoEvento),
    event_type:              str(ev.Tipo_Do_Evento),
    status:                  mapStatus(ev.status),
    event_date:              dateOnly(ev.dataDoEvento),
    location_text:           str(ev['Local Do Evento_TXT']),
    guest_count:             num(ev.QtdConvidados),
    children_50_pct:         num(ev['Crianças50%']),
    non_paying_guests:       num(ev.CriançasNãoPagantes),
    price_per_person:        num(ev.PreçoCombinado),
    total_value:             num(ev.ValorTotalEvento),
    contract_signed:         contractDate !== null,
    contract_signed_date:    contractDate,
    is_paid_in_full:         bool(ev.Quitado),
    ceremony_time:           parseTime(ev.HorarioCerimonia),
    duration_hours:          parseDuration(ev['duração do evento']),
    organizer:               str(ev['Organizador(a) escolhido']),
    decorator:               str(ev.Decorador),
    additional_hours:        num(ev.QtdHorasAdicionais),
    professional_count:      num(ev.QuantidadeProfissionais),
    professional_meal_value: num(ev['AlimentaçãoProfissionais']),
    professional_meal_type:  str(ev.tipoAlimentProf),
  };
}

// Compara dois valores normalizados
function valEq(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  // número
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  // bool
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b);
  return String(a) === String(b);
}

// Busca todos os eventos do Bubble (paginado)
async function fetchAllBubble() {
  const all = [];
  let cursor = 0;
  while (true) {
    const res = await fetch(
      `${BUBBLE_BASE}/eventos?limit=100&cursor=${cursor}`,
      { headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` } }
    );
    if (!res.ok) throw new Error(`Bubble API ${res.status}: ${res.statusText}`);
    const { response: { results = [], remaining = 0 } } = await res.json();
    all.push(...results);
    process.stdout.write(`\r  Bubble: ${all.length} eventos...`);
    if (remaining === 0) break;
    cursor += 100;
  }
  console.log('');
  return all;
}

// Busca um evento específico do Bubble pelo ID
async function fetchBubbleById(bubbleId) {
  const res = await fetch(
    `${BUBBLE_BASE}/eventos/${bubbleId}`,
    { headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.response ?? null;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║   VERIFICAÇÃO E CORREÇÃO DE EVENTOS  ${DRY ? '[DRY-RUN]         ' : '[LIVE]            '}║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 1. Busca todos os eventos do Supabase
  process.stdout.write('Buscando eventos do Supabase...');
  const { data: supaEvents, error } = await supabase
    .from('events')
    .select('id, bubble_id, event_name, status, event_date, guest_count, organizer, location_text, price_per_person, total_value, contract_signed, is_paid_in_full, ceremony_time, duration_hours')
    .not('bubble_id', 'is', null);
  if (error) { console.error('\n❌ Erro ao buscar Supabase:', error.message); process.exit(1); }
  console.log(` ${supaEvents.length} encontrados\n`);

  const supaByBubbleId = {};
  for (const e of supaEvents) supaByBubbleId[e.bubble_id] = e;

  // 2. Busca todos do Bubble
  console.log('Buscando eventos do Bubble (paginado)...');
  const bubbleEvents = await fetchAllBubble();
  const bubbleById = {};
  for (const e of bubbleEvents) bubbleById[e._id] = e;

  // 3. Confronta contagens
  console.log(`\n━━━ CONTAGEM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Supabase: ${supaEvents.length} eventos com bubble_id`);
  console.log(`  Bubble:   ${bubbleEvents.length} eventos`);

  const noSupabase = bubbleEvents.filter(e => !supaByBubbleId[e._id]);
  const noBubble   = supaEvents.filter(e => !bubbleById[e.bubble_id]);

  if (noSupabase.length === 0 && noBubble.length === 0) {
    console.log('  ✅ Contagens batem perfeitamente!');
  } else {
    if (noSupabase.length > 0) {
      console.log(`\n  ⚠  ${noSupabase.length} evento(s) no Bubble mas NÃO no Supabase:`);
      noSupabase.forEach(e => console.log(`    • ${e._id} — "${str(e.NomeDoEvento) ?? '(sem nome)'}" [${e.status}] ${dateOnly(e.dataDoEvento) ?? ''}`));
    }
    if (noBubble.length > 0) {
      console.log(`\n  ⚠  ${noBubble.length} evento(s) no Supabase mas NÃO no Bubble:`);
      noBubble.forEach(e => console.log(`    • ${e.bubble_id} — "${e.event_name ?? '(sem nome)'}" [${e.status}]`));
    }
  }

  // 4. Para cada evento sem nome no Supabase, busca individualmente no Bubble
  const semNome = supaEvents.filter(e => !e.event_name && supaByBubbleId[e.bubble_id]);
  console.log(`\n━━━ EVENTOS SEM NOME NO SUPABASE: ${semNome.length} ━━━━━━━━━━━━━━━━━━━━━`);

  if (semNome.length > 0) {
    console.log('  Consultando cada um individualmente no Bubble...\n');
    let recuperados = 0;
    for (const ev of semNome) {
      const bubbleEv = await fetchBubbleById(ev.bubble_id);
      if (!bubbleEv) {
        console.log(`  ✗ ${ev.bubble_id} — não encontrado na API do Bubble`);
        continue;
      }
      const nome = str(bubbleEv.NomeDoEvento) ?? str(bubbleEv['Nome do Evento']) ?? str(bubbleEv.nomeDoEvento);
      const date = dateOnly(bubbleEv.dataDoEvento);
      console.log(`  ${nome ? '✔' : '✗'} ${ev.bubble_id}`);
      console.log(`    Bubble retornou ${Object.keys(bubbleEv).length} campos`);
      console.log(`    NomeDoEvento: ${JSON.stringify(bubbleEv.NomeDoEvento ?? null)}`);
      if (nome) {
        console.log(`    → Nome encontrado: "${nome}" | Data: ${date}`);
        if (!DRY) {
          const fields = bubbleToSupabase(bubbleEv);
          const { error: upErr } = await supabase.from('events').update({
            ...fields,
            event_name: nome, // garante que nome não vem null
          }).eq('id', ev.id);
          if (upErr) console.log(`    ✗ Erro ao atualizar: ${upErr.message}`);
          else { console.log(`    ✅ Atualizado no Supabase`); recuperados++; }
        }
      } else {
        console.log(`    → Bubble também retornou sem nome (campo ausente na API)`);
        // Mostra todos os campos que vieram para diagnóstico
        const campos = Object.keys(bubbleEv).filter(k => bubbleEv[k] != null && bubbleEv[k] !== '').join(', ');
        console.log(`    → Campos disponíveis: ${campos}`);
      }
    }
    if (!DRY) console.log(`\n  ✅ ${recuperados} eventos com nome recuperado e atualizado`);
  }

  // 5. Verifica diferenças de campo nos eventos que existem nos dois lados
  console.log(`\n━━━ VERIFICAÇÃO DE CAMPOS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  const CAMPOS_CHAVE = ['event_name', 'status', 'event_date', 'guest_count', 'organizer', 'location_text', 'price_per_person', 'total_value'];

  let comDiff = 0, semDiff = 0, atualizados = 0;

  for (const supaEv of supaEvents) {
    const bEv = bubbleById[supaEv.bubble_id];
    if (!bEv) continue;

    const fromBubble = bubbleToSupabase(bEv);
    const diffs = [];

    for (const campo of CAMPOS_CHAVE) {
      const bVal = fromBubble[campo];
      const sVal = supaEv[campo];
      // Só considera diff se Bubble tem um valor diferente do Supabase
      if (bVal !== null && !valEq(bVal, sVal)) {
        diffs.push({ campo, bubble: bVal, supabase: sVal });
      }
    }

    if (diffs.length > 0) {
      comDiff++;
      console.log(`\n  ⚡ "${supaEv.event_name ?? bEv.NomeDoEvento ?? supaEv.bubble_id}":`);
      diffs.forEach(d => console.log(`    ${d.campo}: Supabase="${d.supabase}" → Bubble="${d.bubble}"`));

      if (!DRY) {
        const update = {};
        for (const d of diffs) update[d.campo] = fromBubble[d.campo];
        const { error: upErr } = await supabase.from('events').update(update).eq('id', supaEv.id);
        if (upErr) console.log(`    ✗ Erro: ${upErr.message}`);
        else { console.log(`    ✅ Atualizado`); atualizados++; }
      }
    } else {
      semDiff++;
    }
  }

  console.log(`\n  ${semDiff} eventos sem diferença | ${comDiff} com diferença`);
  if (!DRY && atualizados > 0) console.log(`  ✅ ${atualizados} eventos atualizados`);

  // 6. Insere eventos que estão no Bubble mas faltam no Supabase
  if (noSupabase.length > 0 && !DRY) {
    console.log(`\n━━━ INSERINDO ${noSupabase.length} EVENTOS FALTANDO ━━━━━━━━━━━━━━━━━━━━`);
    let inserted = 0;
    for (const bEv of noSupabase) {
      const fields = bubbleToSupabase(bEv);
      const { error: insErr } = await supabase.from('events').insert({
        ...fields,
        bubble_id: bEv._id,
        created_at: isoTs(bEv['Created Date']) ?? new Date().toISOString(),
        updated_at: isoTs(bEv['Modified Date']) ?? new Date().toISOString(),
      });
      if (insErr) console.log(`  ✗ ${bEv._id}: ${insErr.message}`);
      else { console.log(`  ✅ "${fields.event_name ?? '(sem nome)'}" inserido`); inserted++; }
    }
    console.log(`\n  ✅ ${inserted}/${noSupabase.length} inseridos`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  if (DRY) {
    console.log('✔  DRY-RUN concluído. Nenhum dado foi alterado.');
    console.log('   Para aplicar: node scripts/migration/verify-events.mjs');
  } else {
    console.log('✔  Verificação e correção concluída.');
  }
}

main().catch(err => { console.error('✖', err); process.exit(1); });
