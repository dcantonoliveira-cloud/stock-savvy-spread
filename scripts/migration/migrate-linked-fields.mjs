/**
 * Migra Locais, Organizadoras e Decoradores do Bubble → Supabase
 * Uso: node scripts/migration/migrate-linked-fields.mjs
 */

import https from 'https';
import { createClient } from '@supabase/supabase-js';

const BUBBLE_BASE = 'https://rondellobuffet-app.com.br/api/1.1/obj';
const BUBBLE_TOKEN = 'b4b3c4138bb1000811d5a3c0ba47a238';
const SUPABASE_URL = 'https://vfrtvnzptaazhzfirflm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcnR2bnpwdGFhemh6ZmlyZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyODYyOSwiZXhwIjoyMDg5MDA0NjI5fQ.bR1zR4gfcAOOEQhGizaXOAALN0HD7RQTsUZunYXRbrM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ────────────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { Authorization: `Bearer ${BUBBLE_TOKEN}` } }, r => {
      let b = '';
      r.on('data', c => b += c);
      r.on('end', () => res(JSON.parse(b)));
    }).on('error', rej);
  });
}

async function fetchAllEvents() {
  let cursor = 0, all = [];
  while (true) {
    const data = await fetchJson(`${BUBBLE_BASE}/eventos?limit=100&cursor=${cursor}`);
    all.push(...data.response.results);
    if (data.response.remaining === 0) break;
    cursor += 100;
  }
  return all;
}

// Filtra valores que indicam ausência
const EMPTY = new Set([
  'não tem', 'nao tem', 'não tem ainda', 'sem organizadora', 'sem decorador',
  'sem local', '—', '-', '?', '??', '???', 'nÃo', 'não', 'nao', 'indefinido',
  'sem decoração', 'ela mesma vai decorar', 'ela mesma', 'somente 1 painel',
  'não tem decoração',
]);

function isValid(val) {
  if (!val || typeof val !== 'string') return false;
  const v = val.trim().toLowerCase();
  return v.length > 0 && !EMPTY.has(v) && !v.startsWith('não tem');
}

// Normaliza capitalização
function titleCase(s) {
  return s.trim().replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1));
}

// Deduplicação fuzzy simples: remove duplicatas que diferem só por case/espaço
function dedupe(arr) {
  const seen = new Map();
  for (const s of arr) {
    const key = s.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seen.has(key)) seen.set(key, s);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Buscar o company_id do Rondello
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', 'rondello')
    .single();

  if (!company) { console.error('Empresa rondello não encontrada'); process.exit(1); }
  const companyId = company.id;
  console.log('✅ Company ID:', companyId);

  // 2. Buscar todos os eventos do Bubble
  console.log('⏳ Buscando eventos do Bubble...');
  const events = await fetchAllEvents();
  console.log(`✅ ${events.length} eventos encontrados`);

  // 3. Extrair valores únicos
  const locaisRaw = [], orgsRaw = [], decsRaw = [];
  for (const ev of events) {
    const l = ev['Local Do Evento_TXT'];
    const o = ev['Organizador(a) escolhido'];
    const d = ev['Decorador'];
    if (isValid(l)) locaisRaw.push(l.trim());
    if (isValid(o)) orgsRaw.push(o.trim());
    if (isValid(d)) decsRaw.push(d.trim());
  }

  const locais = dedupe(locaisRaw);
  const orgs   = dedupe(orgsRaw);
  const decs   = dedupe(decsRaw);

  console.log(`\n📍 Locais únicos: ${locais.length}`);
  console.log(`👤 Organizadoras únicas: ${orgs.length}`);
  console.log(`🎨 Decoradores únicos: ${decs.length}`);

  // Limpar tabela de locais e fornecedores desta empresa antes de inserir
  await supabase.from('event_locations').delete().eq('company_id', companyId);
  await supabase.from('suppliers').delete().eq('company_id', companyId);

  // 4. Inserir locais em lotes de 50
  console.log('\n⏳ Inserindo locais...');
  const locRows = locais.map(name => ({ company_id: companyId, name }));
  for (let i = 0; i < locRows.length; i += 50) {
    const { error } = await supabase.from('event_locations').insert(locRows.slice(i, i + 50));
    if (error) { console.error('  ❌ Lote locais:', error.message); break; }
  }
  console.log(`  ✅ ${locais.length} locais inseridos`);

  // 5. Inserir organizadoras em lotes de 50
  console.log('⏳ Inserindo organizadoras...');
  const orgRows = orgs.map(name => ({ company_id: companyId, name, type: 'organizer' }));
  for (let i = 0; i < orgRows.length; i += 50) {
    const { error } = await supabase.from('suppliers').insert(orgRows.slice(i, i + 50));
    if (error) { console.error('  ❌ Lote orgs:', error.message); break; }
  }
  console.log(`  ✅ ${orgs.length} organizadoras inseridas`);

  // 6. Inserir decoradores em lotes de 50
  console.log('⏳ Inserindo decoradores...');
  const decRows = decs.map(name => ({ company_id: companyId, name, type: 'decorator' }));
  for (let i = 0; i < decRows.length; i += 50) {
    const { error } = await supabase.from('suppliers').insert(decRows.slice(i, i + 50));
    if (error) { console.error('  ❌ Lote decs:', error.message); break; }
  }
  console.log(`  ✅ ${decs.length} decoradores inseridos`);

  console.log('\n🎉 Migração de campos linkados concluída!');
}

main().catch(console.error);
