import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();

      if (body.base64 && body.mimeType) {
        const invoiceData = await parseWithClaude(body.base64, body.mimeType);
        return new Response(JSON.stringify(invoiceData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Formato não suportado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Content-Type inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-invoice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function parseWithClaude(base64: string, mimeType: string) {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada nos Secrets da função");

  const prompt = `Leia este documento fiscal (Nota Fiscal, Cupom Fiscal ou Recibo) e extraia os dados em JSON.

Retorne APENAS o JSON no formato abaixo, sem markdown, sem explicação:
{
  "supplier": "nome do fornecedor/emitente",
  "invoice_number": "número da nota ou cupom",
  "items": [
    {
      "name": "nome do produto como está no documento",
      "quantity": 1.0,
      "unit_cost": 10.50,
      "unit": "un",
      "barcode": null
    }
  ]
}

Regras:
- Valores monetários como número (ex: 74.90, não "R$ 74,90")
- Unidades normalizadas: KG→kg, G→g, LT→L, ML→ml, UN/UND/UNID→un, CX→cx, PCT→pct
- Se um campo não existir, use null
- Inclua TODOS os produtos listados no documento`;

  // Claude supports image types: image/jpeg, image/png, image/gif, image/webp
  // For PDFs, use document type
  const isPdf = mimeType === "application/pdf";

  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Claude API error:", response.status, text);
    if (response.status === 401) throw new Error("ANTHROPIC_API_KEY inválida ou sem permissão.");
    if (response.status === 429) throw new Error("Rate limit atingido. Tente novamente em instantes.");
    throw new Error("Erro ao processar documento com IA");
  }

  const data = await response.json();
  let jsonStr = (data.content?.[0]?.text || "").trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    console.error("Failed to parse Claude response:", jsonStr);
    throw new Error("Não foi possível interpretar a resposta da IA");
  }
}
