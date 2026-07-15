import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apikey = req.headers.get("apikey");
    const expectedKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!apikey || (expectedKey && apikey !== expectedKey)) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { menu_text, sheets } = await req.json() as {
      menu_text: string;
      sheets: { id: string; name: string; category: string | null }[];
    };

    if (!menu_text?.trim()) {
      return new Response(JSON.stringify({ error: "Cardápio em texto não preenchido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY não configurada");

    // Compact format: use index numbers instead of UUIDs to save tokens
    const indexedSheets = sheets.map((s, i) => `${i}:${s.name}`).join("\n");

    // Truncate menu text to ~2000 chars to stay within token limits
    const menuTruncated = menu_text.slice(0, 2000);

    const prompt = `Você recebe uma lista numerada de fichas técnicas de buffet e um cardápio em texto livre.
Retorne os NÚMEROS (índices) das fichas que aparecem no cardápio, por similaridade de nome.
Não invente — só inclua fichas que realmente aparecem.

FICHAS (índice:nome):
${indexedSheets}

CARDÁPIO:
${menuTruncated}

Responda APENAS com JSON: {"matched_indexes":[0,1,2,...]}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const rawText = await response.text();
    if (!response.ok) throw new Error(`Anthropic ${response.status}: ${rawText.slice(0, 300)}`);

    const result = JSON.parse(rawText);
    const aiText = result.content?.[0]?.text ?? "";

    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`IA não retornou JSON. Texto: ${aiText.slice(0, 200)}`);

    const parsed = JSON.parse(jsonMatch[0]);
    const indexes: number[] = parsed.matched_indexes ?? [];

    // Map indexes back to real IDs
    const matched_ids = indexes
      .filter(i => i >= 0 && i < sheets.length)
      .map(i => sheets[i].id);

    return new Response(JSON.stringify({ matched_ids }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
