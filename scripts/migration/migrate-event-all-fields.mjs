import https from 'https';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vfrtvnzptaazhzfirflm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcnR2bnpwdGFhemh6ZmlyZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyODYyOSwiZXhwIjoyMDg5MDA0NjI5fQ.bR1zR4gfcAOOEQhGizaXOAALN0HD7RQTsUZunYXRbrM'
);

const TOKEN = 'b4b3c4138bb1000811d5a3c0ba47a238';
const BUBBLE_BASE = 'https://rondellobuffet-app.com.br/api/1.1/obj';

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
    process.stdout.write(`\r  → ${all.length} carregados...`);
  }
  console.log();
  return all;
}

const str = v => (v != null && String(v).trim() !== '') ? String(v).trim() : null;
const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const intV = v => { const n = parseInt(v); return isNaN(n) ? null : n; };

function parseTime(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = m[1].padStart(2, '0'), min = m[2];
  if (parseInt(h) > 23 || parseInt(min) > 59) return null;
  return `${h}:${min}`;
}

function parseDuration(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

async function main() {
  console.log('Buscando eventos do Bubble...');
  const bubbleEvents = await fetchAllBubble('eventos');
  console.log(`  → ${bubbleEvents.length} eventos`);

  const { data: events } = await supabase
    .from('events')
    .select('id, bubble_id, ceremony_time, duration_hours, event_type, organizer, decorator, additional_hours, band_dj, bartender, pastry_chef, photo_video, menu_text, extra_details, table_count, guests_per_table')
    .not('bubble_id', 'is', null);

  const map = {};
  for (const e of events ?? []) map[e.bubble_id] = e;

  let updated = 0, skipped = 0, errors = 0;

  for (const ev of bubbleEvents) {
    const existing = map[ev._id];
    if (!existing) { skipped++; continue; }

    const patch = {};

    // ── Horários / duração ───────────────────────────────────
    const time = parseTime(ev.HorarioCerimonia);
    if (time && !existing.ceremony_time) patch.ceremony_time = time;

    const dur = parseDuration(ev['duração do evento']);
    if (dur && !existing.duration_hours) patch.duration_hours = dur;

    const addH = num(ev.QtdHorasAdicionais);
    if (addH && !existing.additional_hours) patch.additional_hours = addH;

    // ── Tipo / classificação ──────────────────────────────────
    if (str(ev.Tipo_Do_Evento) && !existing.event_type)
      patch.event_type = str(ev.Tipo_Do_Evento);

    // ── Fornecedores / profissionais ──────────────────────────
    if (str(ev['Organizador(a) escolhido']) && !existing.organizer)
      patch.organizer = str(ev['Organizador(a) escolhido']);

    if (str(ev.Decorador) && !existing.decorator)
      patch.decorator = str(ev.Decorador);

    if (str(ev['Banda/DjEscolhido']) && !existing.band_dj)
      patch.band_dj = str(ev['Banda/DjEscolhido']);

    if (str(ev.Bartender) && !existing.bartender)
      patch.bartender = str(ev.Bartender);

    if (str(ev.Confeiteira) && !existing.pastry_chef)
      patch.pastry_chef = str(ev.Confeiteira);

    if (str(ev['Foto/Filmagem']) && !existing.photo_video)
      patch.photo_video = str(ev['Foto/Filmagem']);

    // ── Mesas ─────────────────────────────────────────────────
    const tableCount = intV(ev.QuantidadeDeMesas);
    if (tableCount && tableCount > 0 && !existing.table_count)
      patch.table_count = tableCount;

    const gPerTable = intV(ev.QuantidadeConvidadosPorMesa);
    if (gPerTable && gPerTable > 0 && !existing.guests_per_table)
      patch.guests_per_table = gPerTable;

    // ── Cardápio (texto livre do Bubble) ──────────────────────
    if (str(ev.CardapioEvento) && !existing.menu_text)
      patch.menu_text = str(ev.CardapioEvento);

    // ── Detalhes extras (JSON) ────────────────────────────────
    // Agrupa campos booleanos/texto de estrutura do evento
    if (!existing.extra_details) {
      const extras = {};
      const pick = (key, label) => { const v = str(ev[key]); if (v) extras[label] = v; };
      pick('Cerveja',             'cerveja');
      pick('CoquetelDeBoasVindas','coquetel_boas_vindas');
      pick('PortaGuardanapo',     'porta_guardanapo');
      pick('rechaud',             'rechaud');
      pick('sala dos noivos',     'sala_noivos');
      pick('Sousplát',            'sousplat');
      pick('taça',                'taca');
      pick('Toalha',              'toalha');
      pick('vinho',               'vinho');
      pick('whisky',              'whisky');
      pick('espaço kids',         'espaco_kids');
      if (Object.keys(extras).length > 0) patch.extra_details = extras;
    }

    if (Object.keys(patch).length === 0) { skipped++; continue; }

    const { error } = await supabase.from('events').update(patch).eq('id', existing.id);
    if (error) {
      console.error(`\n  Erro em ${existing.id}:`, error.message);
      errors++;
    } else {
      updated++;
    }
  }

  console.log(`\n✓ Atualizados: ${updated}`);
  console.log(`  Sem mudança:  ${skipped}`);
  if (errors) console.log(`  Erros:        ${errors}`);
  console.log('Concluído!');
}

main().catch(console.error);
