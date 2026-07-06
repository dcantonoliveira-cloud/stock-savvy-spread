/**
 * Corrige situation_snapshot em tasting_session_events:
 *   - data da deg ANTES do contrato assinado  → 'new'      (veio como lead)
 *   - data da deg DEPOIS (ou sem data assinada) → 'confirmed' (já era cliente)
 *   - evento sem contract_signed_date            → 'new'      (ainda não fechou)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) { console.error('❌ Set SUPABASE_SERVICE_KEY'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: rows, error } = await sb
  .from('tasting_session_events')
  .select(`
    id,
    session_id,
    event_id,
    situation_snapshot,
    tasting_sessions!inner(scheduled_date),
    events!inner(contract_signed_date)
  `);

if (error) { console.error('Erro ao buscar:', error.message); process.exit(1); }

console.log(`Total de registros: ${rows.length}`);

let toNew = [], toConfirmed = [], unchanged = [];

for (const r of rows) {
  const degDate      = r.tasting_sessions?.scheduled_date;    // 'YYYY-MM-DD'
  const signedDate   = r.events?.contract_signed_date;        // 'YYYY-MM-DD' ou null

  let expected;
  if (!signedDate) {
    // Evento sem data de assinatura = ainda é lead (ou nunca fechou)
    expected = 'new';
  } else if (degDate < signedDate) {
    // Degustação aconteceu ANTES de assinar → veio como lead
    expected = 'new';
  } else {
    // Degustação aconteceu DEPOIS (ou no mesmo dia) de assinar → já era cliente
    expected = 'confirmed';
  }

  if (expected === r.situation_snapshot) {
    unchanged.push(r.id);
  } else if (expected === 'new') {
    toNew.push(r.id);
  } else {
    toConfirmed.push(r.id);
  }
}

console.log(`\nResultado da análise:`);
console.log(`  Já corretos:    ${unchanged.length}`);
console.log(`  → 'new':        ${toNew.length}`);
console.log(`  → 'confirmed':  ${toConfirmed.length}`);

if (toNew.length > 0) {
  const { error: e1 } = await sb
    .from('tasting_session_events')
    .update({ situation_snapshot: 'new' })
    .in('id', toNew);
  if (e1) console.error('Erro ao atualizar new:', e1.message);
  else console.log(`✅ ${toNew.length} marcados como 'new'`);
}

if (toConfirmed.length > 0) {
  const { error: e2 } = await sb
    .from('tasting_session_events')
    .update({ situation_snapshot: 'confirmed' })
    .in('id', toConfirmed);
  if (e2) console.error('Erro ao atualizar confirmed:', e2.message);
  else console.log(`✅ ${toConfirmed.length} marcados como 'confirmed'`);
}

console.log('\n✅ Concluído.');
