import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vfrtvnzptaazhzfirflm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcnR2bnpwdGFhemh6ZmlyZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyODYyOSwiZXhwIjoyMDg5MDA0NjI5fQ.bR1zR4gfcAOOEQhGizaXOAALN0HD7RQTsUZunYXRbrM'
);

// Mapeamento: chave em extra_details → nome do campo em event_field_definitions
const KEY_TO_NAME = {
  coquetel_boas_vindas: 'Coquetel de boas-vindas',
  vinho:                'Vinho',
  whisky:               'Whisky',
  cerveja:              'Cerveja',
  porta_guardanapo:     'Porta guardanapo',
  toalha:               'Toalha',
  rechaud:              'Rechaud',
  sousplat:             'Sousplát',
  taca:                 'Taça',
  sala_noivos:          'Sala dos noivos',
  espaco_kids:          'Espaço kids',
};

async function main() {
  // Carregar definições de campos
  const { data: defs } = await supabase
    .from('event_field_definitions')
    .select('id, name')
    .eq('is_active', true);

  const nameToId = {};
  for (const d of defs ?? []) nameToId[d.name] = d.id;

  console.log('Campos disponíveis:', Object.keys(nameToId).join(', '));

  // Buscar eventos com extra_details preenchidos
  const { data: events } = await supabase
    .from('events')
    .select('id, extra_details, table_count, guests_per_table')
    .not('extra_details', 'is', null);

  console.log(`\nEventos com extra_details: ${events?.length ?? 0}`);

  let inserted = 0, skipped = 0, errors = 0;

  for (const ev of events ?? []) {
    const details = ev.extra_details ?? {};
    const rows = [];

    // Campos do jsonb extra_details
    for (const [key, name] of Object.entries(KEY_TO_NAME)) {
      const val = details[key];
      if (!val) continue;
      const fieldId = nameToId[name];
      if (!fieldId) { console.warn(`  Campo não encontrado: ${name}`); continue; }
      rows.push({ event_id: ev.id, field_id: fieldId, value: String(val) });
    }

    // table_count → Qtd. de mesas
    if (ev.table_count && nameToId['Qtd. de mesas'])
      rows.push({ event_id: ev.id, field_id: nameToId['Qtd. de mesas'], value: String(ev.table_count) });

    // guests_per_table → Convidados por mesa
    if (ev.guests_per_table && nameToId['Convidados por mesa'])
      rows.push({ event_id: ev.id, field_id: nameToId['Convidados por mesa'], value: String(ev.guests_per_table) });

    if (rows.length === 0) { skipped++; continue; }

    const { error } = await supabase
      .from('event_field_values')
      .upsert(rows, { onConflict: 'event_id,field_id' });

    if (error) { console.error(`  Erro no evento ${ev.id}:`, error.message); errors++; }
    else inserted += rows.length;
  }

  console.log(`\n✓ Valores inseridos/atualizados: ${inserted}`);
  console.log(`  Eventos sem dados:              ${skipped}`);
  if (errors) console.log(`  Erros:                          ${errors}`);
  console.log('Concluído!');
}

main().catch(console.error);
