/**
 * Migra arquivos (Arquivos_Internos) do Bubble → Supabase Storage + event_files.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=xxx node scripts/migration/sync-files-from-bubble.mjs
 *   SUPABASE_SERVICE_KEY=xxx node scripts/migration/sync-files-from-bubble.mjs --dry-run
 */

import https from 'https';
import http from 'http';
import { createClient } from '@supabase/supabase-js';

const BUBBLE_BASE  = 'https://rondelloemcasa.bubbleapps.io/api/1.1/obj';
const BUBBLE_TOKEN = 'b4b3c4138bb1000811d5a3c0ba47a238';
const SUPABASE_URL = 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? '';
const BUCKET       = 'event-files';

const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('⚠️  DRY RUN — nenhum arquivo será enviado\n');

if (!SUPABASE_KEY) { console.error('❌ SUPABASE_SERVICE_KEY não definido'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` } }, r => {
      let b = ''; r.on('data', c => b += c);
      r.on('end', () => { try { res(JSON.parse(b)); } catch(e) { rej(e); } });
    }).on('error', rej);
  });
}

function downloadBuffer(url) {
  return new Promise((res, rej) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        return downloadBuffer(r.headers.location).then(res).catch(rej);
      }
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => res(Buffer.concat(chunks)));
    }).on('error', rej);
  });
}

async function fetchAllBubble(type) {
  const results = [];
  let cursor = 0;
  const limit = 100;
  while (true) {
    const url = `${BUBBLE_BASE}/${type}?limit=${limit}&cursor=${cursor}`;
    const { response } = await fetchJson(url);
    if (!response?.results?.length) break;
    results.push(...response.results);
    if (results.length >= response.count) break;
    cursor += limit;
  }
  return results;
}

// ── Extrai nome do arquivo da URL do Bubble ───────────────────────────────────
function nameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    const last = parts[parts.length - 1];
    // Remove query string se houver
    return decodeURIComponent(last.split('?')[0]) || 'arquivo.pdf';
  } catch {
    return 'arquivo.pdf';
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📥 Buscando eventos no Supabase com bubble_id...');
  const { data: sbEvents, error: sbErr } = await supabase
    .from('events')
    .select('id, event_name, bubble_id')
    .not('bubble_id', 'is', null);

  if (sbErr) { console.error('❌ Erro ao buscar eventos:', sbErr.message); process.exit(1); }

  const bubbleToSupabase = new Map(sbEvents.map(e => [e.bubble_id, e]));
  console.log(`✅ ${sbEvents.length} eventos no Supabase com bubble_id\n`);

  // Busca arquivos já migrados para evitar duplicatas
  const { data: existingFiles } = await supabase
    .from('event_files')
    .select('event_id, name');
  const existingKeys = new Set((existingFiles ?? []).map(f => `${f.event_id}|${f.name}`));
  console.log(`📋 ${existingKeys.size} arquivos já existentes no Supabase\n`);

  console.log('📥 Buscando eventos no Bubble...');
  const bubbleEvents = await fetchAllBubble('eventos');
  console.log(`✅ ${bubbleEvents.length} eventos no Bubble\n`);

  let total = 0, skipped = 0, uploaded = 0, errors = 0;

  for (const ev of bubbleEvents) {
    const files = ev['Arquivos_Internos'];
    if (!files?.length) continue;

    const sbEvent = bubbleToSupabase.get(ev._id);
    if (!sbEvent) {
      console.log(`⚠️  Evento sem match: ${ev['NomeDoEvento'] ?? ev._id}`);
      skipped++;
      continue;
    }

    for (const fileUrl of files) {
      if (!fileUrl || typeof fileUrl !== 'string') continue;
      total++;

      const fileName = nameFromUrl(fileUrl);
      const key = `${sbEvent.id}|${fileName}`;

      if (existingKeys.has(key)) {
        console.log(`  ⏭  Já existe: ${fileName}`);
        skipped++;
        continue;
      }

      console.log(`  ⬆️  ${sbEvent.event_name} → ${fileName}`);

      if (DRY_RUN) { uploaded++; continue; }

      try {
        // Download do Bubble
        const buffer = await downloadBuffer(fileUrl);

        // Upload no Supabase Storage
        const storagePath = `${sbEvent.id}/${Date.now()}-${fileName}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false });

        if (upErr) {
          console.error(`    ❌ Upload falhou: ${upErr.message}`);
          errors++;
          continue;
        }

        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

        // Insere em event_files
        const { error: dbErr } = await supabase.from('event_files').insert({
          event_id: sbEvent.id,
          name: fileName,
          url: publicUrl,
        });

        if (dbErr) {
          console.error(`    ❌ DB insert falhou: ${dbErr.message}`);
          errors++;
        } else {
          existingKeys.add(key);
          uploaded++;
        }
      } catch (err) {
        console.error(`    ❌ Erro: ${err.message}`);
        errors++;
      }
    }
  }

  console.log('\n════════════════════════════════');
  console.log(`Total de arquivos encontrados : ${total}`);
  console.log(`Enviados                      : ${uploaded}`);
  console.log(`Já existiam / sem match       : ${skipped}`);
  console.log(`Erros                         : ${errors}`);
}

main().catch(console.error);
