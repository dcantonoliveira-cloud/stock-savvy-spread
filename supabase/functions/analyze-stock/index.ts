import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all data
    const [itemsRes, entriesRes, outputsRes] = await Promise.all([
      supabase.from("stock_items").select("*"),
      supabase.from("stock_entries").select("*").order("date", { ascending: false }).limit(200),
      supabase.from("stock_outputs").select("*").order("date", { ascending: false }).limit(200),
    ]);

    const items = itemsRes.data || [];
    const entries = entriesRes.data || [];
    const outputs = outputsRes.data || [];

    const totalValue = items.reduce((s: number, i: any) => s + i.current_stock * i.unit_cost, 0);
    const lowStockItems = items.filter((i: any) => i.current_stock <= i.min_stock);

    const dataContext = `
DADOS DO ESTOQUE RONDELLO BUFFET:
- ${items.length} itens cadastrados
- Valor total em estoque: R$ ${totalValue.toFixed(2)}
- ${lowStockItems.length} itens com estoque baixo ou zerado: ${lowStockItems.map((i: any) => `${i.name} (${i.current_stock} ${i.unit}, mín: ${i.min_stock})`).join(', ') || 'nenhum'}

ITENS:
${items.map((i: any) => `- ${i.name} [${i.category}]: ${i.current_stock} ${i.unit} (mín: ${i.min_stock}, custo: R$${i.unit_cost})`).join('\n')}

ÚLTIMAS SAÍDAS (${outputs.length}):
${outputs.slice(0, 30).map((o: any) => {
  const item = items.find((i: any) => i.id === o.item_id);
  return `- ${o.date}: ${o.quantity} de ${item?.name || '?'} por ${o.employee_name}${o.event_name ? ` (${o.event_name})` : ''}`;
}).join('\n')}

ÚLTIMAS ENTRADAS (${entries.length}):
${entries.slice(0, 30).map((e: any) => {
  const item = items.find((i: any) => i.id === e.item_id);
  return `- ${e.date}: ${e.quantity} de ${item?.name || '?'}`;
}).join('\n')}
    `.trim();

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um analista especialista em gestão de estoque para buffets e cozinhas industriais. Analise os dados e forneça insights acionáveis em português brasileiro.

Estruture sua resposta em seções claras com emojis:
1. 📊 RESUMO GERAL - visão rápida do estado do estoque
2. 🚨 ALERTAS CRÍTICOS - itens que precisam de ação imediata
3. 📈 TENDÊNCIAS - padrões de consumo observados
4. 💡 RECOMENDAÇÕES - sugestões práticas para otimizar
5. 💰 OPORTUNIDADES DE ECONOMIA - onde reduzir custos

Seja direto, prático e específico. Use valores reais dos dados.`,
          },
          {
            role: "user",
            content: `Analise estes dados do meu buffet e me dê insights:\n\n${dataContext}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para análise de IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    return new Response(JSON.stringify({ analysis, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
