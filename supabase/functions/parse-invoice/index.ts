import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const contentType = req.headers.get("content-type") || "";
    let invoiceData: any;

    if (contentType.includes("application/json")) {
      // XML or base64 content
      const body = await req.json();

      if (body.xml) {
        invoiceData = parseXmlInvoice(body.xml);
        return new Response(JSON.stringify(invoiceData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.base64 && body.mimeType) {
        invoiceData = await parseWithAI(body.base64, body.mimeType);
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

function parseXmlInvoice(xml: string) {
  const items: any[] = [];
  let supplier = "";
  let invoiceNumber = "";

  // Extract invoice number (nNF)
  const nNFMatch = xml.match(/<nNF>(\d+)<\/nNF>/);
  if (nNFMatch) invoiceNumber = nNFMatch[1];

  // Extract supplier name (xNome from emit)
  const emitMatch = xml.match(/<emit>[\s\S]*?<xNome>(.*?)<\/xNome>/);
  if (emitMatch) supplier = emitMatch[1];

  // Extract products (det blocks)
  const detRegex = /<det[\s\S]*?<\/det>/g;
  let detMatch;
  while ((detMatch = detRegex.exec(xml)) !== null) {
    const block = detMatch[0];
    const name = block.match(/<xProd>(.*?)<\/xProd>/)?.[1] || "";
    const quantity = parseFloat(block.match(/<qCom>(.*?)<\/qCom>/)?.[1] || "0");
    const unitCost = parseFloat(block.match(/<vUnCom>(.*?)<\/vUnCom>/)?.[1] || "0");
    const unit = block.match(/<uCom>(.*?)<\/uCom>/)?.[1] || "un";
    const ean = block.match(/<cEAN>(.*?)<\/cEAN>/)?.[1] || "";
    const ncm = block.match(/<NCM>(.*?)<\/NCM>/)?.[1] || "";

    items.push({
      name: name.trim(),
      quantity,
      unit_cost: Math.round(unitCost * 100) / 100,
      unit: normalizeUnit(unit),
      barcode: ean && ean !== "SEM GTIN" ? ean : null,
    });
  }

  return { supplier, invoice_number: invoiceNumber, items };
}

function normalizeUnit(unit: string): string {
  const u = unit.toUpperCase().trim();
  const map: Record<string, string> = {
    "KG": "kg", "G": "g", "GR": "g", "L": "L", "LT": "L", "ML": "ml",
    "UN": "un", "UND": "un", "UNID": "un", "CX": "cx", "PCT": "pct",
    "PC": "un", "PÇ": "un", "FD": "cx", "DZ": "un",
    "LATA": "lata", "LT.": "L", "GAR": "garrafa", "GF": "garrafa",
  };
  return map[u] || unit.toLowerCase();
}

async function parseWithAI(base64: string, mimeType: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const systemPrompt = `Você é um assistente especializado em ler Notas Fiscais brasileiras (NF-e / DANFE).
Extraia os seguintes dados do documento:
- supplier: nome do fornecedor/emitente
- invoice_number: número da nota fiscal
- items: array de produtos, cada um com:
  - name: nome do produto (como está na nota)
  - quantity: quantidade comprada (número)
  - unit_cost: valor unitário em reais (número com 2 decimais)
  - unit: unidade de medida (normalizar para: kg, g, L, ml, un, cx, pct, lata, garrafa)
  - barcode: código de barras EAN se disponível, ou null

IMPORTANTE:
- Retorne APENAS o JSON, sem markdown ou explicação
- Valores monetários em formato numérico (ex: 74.90, não "R$ 74,90")
- Se não conseguir ler algum campo, use null
- Normalize as unidades (KG→kg, UND→un, LT→L, etc.)`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Leia esta Nota Fiscal e extraia todos os produtos:" },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limit exceeded. Tente novamente em alguns segundos.");
    if (response.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no painel.");
    const text = await response.text();
    console.error("AI error:", response.status, text);
    throw new Error("Erro ao processar NF com IA");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Clean markdown wrapping if present
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    console.error("Failed to parse AI response:", content);
    throw new Error("Não foi possível interpretar a resposta da IA");
  }
}
