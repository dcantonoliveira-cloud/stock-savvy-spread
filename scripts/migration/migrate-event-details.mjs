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

// Tenta extrair "HH:MM" de texto livre como "16:30 no convite"
function parseTime(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = m[1].padStart(2, '0');
  const min = m[2];
  if (parseInt(h) > 23 || parseInt(min) > 59) return null;
  return `${h}:${min}`;
}

// Tenta extrair o primeiro número de texto livre como "7hs com 30min"
function parseDuration(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

async function main() {
  console.log('Buscando eventos do Bubble...');
  const bubbleEvents = await fetchAllBubble('eventos');
  console.log(`  → ${bubbleEvents.length} eventos no Bubble`);

  const { data: events } = await supabase
    .from('events')
    .select('id, bubble_id, ceremony_time, duration_hours, event_type, organizer, decorator, additional_hours')
    .not('bubble_id', 'is', null);

  const map = {};
  for (const e of events ?? []) map[e.bubble_id] = e;

  let updated = 0, skipped = 0;
  for (const ev of bubbleEvents) {
    const existing = map[ev._id];
    if (!existing) { skipped++; continue; }

    const patch = {};

    // Horário de cerimônia
    const time = parseTime(ev.HorarioCerimonia);
    if (time && !existing.ceremony_time) patch.ceremony_time = time;

    // Duração do evento
    const dur = parseDuration(ev['duração do evento']);
    if (dur && !existing.duration_hours) patch.duration_hours = dur;

    // Tipo do evento
    if (ev.Tipo_Do_Evento && !existing.event_type) patch.event_type = ev.Tipo_Do_Evento.trim();

    // Organizador
    if (ev['Organizador(a) escolhido'] && !existing.organizer)
      patch.organizer = String(ev['Organizador(a) escolhido']).trim();

    // Decorador
    if (ev.Decorador && !existing.decorator)
      patch.decorator = String(ev.Decorador).trim();

    // Horas adicionais
    const addH = parseFloat(ev.QtdHorasAdicionais);
    if (!isNaN(addH) && addH > 0 && !existing.additional_hours)
      patch.additional_hours = addH;

    if (Object.keys(patch).length === 0) { skipped++; continue; }

    const { error } = await supabase.from('events').update(patch).eq('id', existing.id);
    if (error) { console.error(`  Erro em ${existing.id}:`, error.message); skipped++; }
    else updated++;
  }

  console.log(`\nAtualizados: ${updated} | Sem mudança: ${skipped}`);
  console.log('Concluído!');
}

main().catch(console.error);
