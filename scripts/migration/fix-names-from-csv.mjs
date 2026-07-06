/**
 * fix-names-from-csv.mjs
 *
 * Lê o CSV exportado do Bubble e preenche event_name nos eventos
 * que estão sem nome no Supabase.
 *
 * USO:
 *   node scripts/migration/fix-names-from-csv.mjs --dry-run
 *   node scripts/migration/fix-names-from-csv.mjs
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

const SUPA_URL = process.env.SUPABASE_URL || 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes('--dry-run');

if (!SUPA_KEY) { console.error('❌  SUPABASE_SERVICE_ROLE_KEY não definido'); process.exit(1); }

const CSV_PATH = process.argv.find(a => a.endsWith('.csv'))
  || '/Users/douglascantondeoliveira/Downloads/export_All-eventos-modified--_2026-07-03_18-44-48.csv';

const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

// ── Parse CSV robusto (lida com campos com quebras de linha e vírgulas dentro de aspas) ──
function parseCSV(text) {
  const rows = [];
  let headers = null;
  let i = 0;

  function parseField() {
    if (text[i] === '"') {
      i++; // skip opening quote
      let val = '';
      while (i < text.length) {
        if (text[i] === '"' && text[i + 1] === '"') { val += '"'; i += 2; }
        else if (text[i] === '"') { i++; break; }
        else { val += text[i++]; }
      }
      return val;
    }
    let val = '';
    while (i < text.length && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') val += text[i++];
    return val;
  }

  function parseLine() {
    const fields = [];
    while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
      fields.push(parseField());
      if (text[i] === ',') i++;
    }
    if (text[i] === '\r') i++;
    if (text[i] === '\n') i++;
    return fields;
  }

  headers = parseLine();
  while (i < text.length) {
    if (text[i] === '\r' || text[i] === '\n') { i++; continue; }
    const values = parseLine();
    if (values.length < 2) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

async function main() {
  console.log(`╔══════════════════════════════════════════════════════════╗`);
  console.log(`║   FIX NOMES VIA CSV  ${DRY ? '[DRY-RUN]                        ' : '[LIVE]                           '}║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  // 1. Lê CSV
  console.log(`Lendo CSV: ${CSV_PATH}`);
  const text = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(text);
  console.log(`  ${rows.length} registros no CSV\n`);

  // Monta mapa bubble_id → nome (prioriza NomeDoEvento, fallback NomeDoContratante)
  const nameMap = {};
  for (const row of rows) {
    const id = row['unique id']?.trim();
    if (!id) continue;
    const nome = row['NomeDoEvento']?.trim() || row['NomeDoContratante']?.trim() || '';
    if (nome) nameMap[id] = nome;
  }
  console.log(`  ${Object.keys(nameMap).length} eventos com nome no CSV\n`);

  // 2. Busca eventos sem nome no Supabase
  const { data: semNome, error } = await supabase
    .from('events')
    .select('id, bubble_id, event_name')
    .not('bubble_id', 'is', null)
    .or('event_name.is.null,event_name.eq.');

  if (error) { console.error('❌ Erro Supabase:', error.message); process.exit(1); }
  console.log(`Eventos sem nome no Supabase: ${semNome.length}\n`);

  let found = 0, notFound = 0, updated = 0;

  for (const ev of semNome) {
    const nome = nameMap[ev.bubble_id];
    if (!nome) {
      console.log(`  ✗ ${ev.bubble_id} — sem nome no CSV também`);
      notFound++;
      continue;
    }

    console.log(`  ✔ "${nome}" (${ev.bubble_id})`);
    found++;

    if (!DRY) {
      const { error: upErr } = await supabase
        .from('events')
        .update({ event_name: nome })
        .eq('id', ev.id);
      if (upErr) console.log(`    ✗ Erro: ${upErr.message}`);
      else updated++;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Com nome no CSV:    ${found}`);
  console.log(`  Sem nome em lugar nenhum: ${notFound}`);
  if (!DRY) console.log(`  Atualizados no Supabase: ${updated}`);
  else console.log(`\n✔  DRY-RUN. Para aplicar: node scripts/migration/fix-names-from-csv.mjs`);
}

main().catch(err => { console.error('✖', err); process.exit(1); });
