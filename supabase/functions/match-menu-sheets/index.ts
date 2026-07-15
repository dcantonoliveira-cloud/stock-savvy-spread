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

    // Truncate aggressively to stay under 10k tokens/min
    const indexedSheets = sheets.map((s, i) => `${i}:${s.name.slice(0, 40)}`).join("\n");
    const menuTruncated = menu_text.slice(0, 1200);

    const prompt = `Cruze itens do cardápio com fichas técnicas. Responda SÓ JSON.

FICHAS (índice:nome):
${indexedSheets}

CARDÁPIO:
${menuTruncated}

Classifique cada prato do cardápio:
- matched: correspondência clara
- uncertain: possível correspondência (seja GENEROSO, 40%+ de chance já é uncertain) — até 3 sugestões
- unmatched: sem correspondência

JSON:
{"matched":[{"index":0,"menu_item":"..."}],"uncertain":[{"menu_item":"...","suggestions":[0,2]}],"unmatched":["..."]}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
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

    const matched_ids: string[] = (parsed.matched ?? [])
      .map((m: any) => m.index)
      .filter((i: number) => i >= 0 && i < sheets.length)
      .map((i: number) => sheets[i].id);

    const uncertain = (parsed.uncertain ?? []).map((u: any) => ({
      menu_item: u.menu_item,
      suggestions: (u.suggestions ?? [])
        .filter((i: number) => i >= 0 && i < sheets.length)
        .map((i: number) => ({ id: sheets[i].id, name: sheets[i].name, category: sheets[i].category })),
    }));

    const unmatched: string[] = parsed.unmatched ?? [];

    return new Response(JSON.stringify({ matched_ids, uncertain, unmatched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
