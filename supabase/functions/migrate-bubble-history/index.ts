import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-migrate-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const BUBBLE_BASE = 'https://rondelloemcasa.bubbleapps.io/api/1.1';
const BUBBLE_TOKEN = 'Bearer b4b3c4138bb1000811d5a3c0ba47a238';
const MIGRATE_SECRET = 'rondello-migrate-2026';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const secret = req.headers.get('x-migrate-secret');
  if (secret !== MIGRATE_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Busca company_id do Rondello
    const { data: companies, error: compErr } = await supa.from('companies').select('id').limit(1);
    if (compErr) throw new Error('Company query error: ' + compErr.message);
    const companyId = (companies as any)?.[0]?.id;
    if (!companyId) throw new Error('Company not found — companies table empty or inaccessible');

    // Busca todos os orçamentos do Bubble com paginação
    let allOrcamentos: any[] = [];
    let cursor = 0;
    while (true) {
      const res = await fetch(`${BUBBLE_BASE}/obj/orcamento?limit=100&cursor=${cursor}&sort_field=Created+Date&descending=false`, {
        headers: { Authorization: BUBBLE_TOKEN },
      });
      const json = await res.json();
      const results = json?.response?.results ?? [];
      allOrcamentos = allOrcamentos.concat(results);
      const remaining = json?.response?.remaining ?? 0;
      if (remaining === 0) break;
      cursor += results.length;
    }

    if (allOrcamentos.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0, message: 'Nenhum orçamento encontrado no Bubble' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Transforma e insere
    const rows = allOrcamentos.map((item: any) => {
      let dados: any = null;
      try { dados = typeof item.dados_json === 'string' ? JSON.parse(item.dados_json) : item.dados_json; } catch {}
      return {
        company_id: companyId,
        nome_evento: item.nome_evento || null,
        tipo_pacote: item.tipo_pacote || null,
        valor_total: typeof item.valor_total === 'number' ? item.valor_total : null,
        data_geracao: item.data_geracao || item['Created Date'] || new Date().toISOString(),
        dados_json: dados,
        criado_por: item.criado_por || null,
      };
    });

    // Insere em lotes de 50
    let totalInserted = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error, count } = await supa.from('quotation_history').insert(batch, { count: 'exact' });
      if (error) throw new Error(`Batch ${i}: ${error.message}`);
      totalInserted += count ?? batch.length;
    }

    return new Response(JSON.stringify({ ok: true, inserted: totalInserted, total_bubble: allOrcamentos.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
