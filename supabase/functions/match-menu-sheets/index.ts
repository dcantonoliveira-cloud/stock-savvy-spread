import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify request has a valid API key (anon key sent by frontend)
    const apikey = req.headers.get("apikey");
    const expectedKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!apikey || (expectedKey && apikey !== expectedKey)) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { menu_text, sheets } = await req.json() as {
      menu_text: string;
      sheets: { id: string; name: string; category: string | null }[];
    };

    if (!menu_text?.trim()) {
      return new Response(JSON.stringify({ error: "Cardápio em texto não preenchido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY não configurada");

    const sheetsText = sheets
      .map(s => `ID: ${s.id} | Nome: ${s.name}${s.category ? ` | Categoria: ${s.category}` : ""}`)
      .join("\n");

    const prompt = `Você é um assistente que identifica quais fichas técnicas de buffet correspondem aos itens de um cardápio em texto livre.

FICHAS TÉCNICAS DISPONÍVEIS:
${sheetsText}

CARDÁPIO EM TEXTO:
${menu_text}

Analise o cardápio e retorne APENAS os IDs das fichas técnicas que correspondem a itens presentes no cardápio.
Faça correspondência por similaridade de nome (ignore maiúsculas/minúsculas, acentos e pequenas variações).
Não invente correspondências — só inclua IDs de fichas que realmente aparecem no cardápio.

Responda SOMENTE com um JSON no formato:
{"matched_ids": ["id1", "id2", ...]}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${err}`);
    }

    const result = await response.json();
    const text = result.content?.[0]?.text ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta inválida da IA");

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
