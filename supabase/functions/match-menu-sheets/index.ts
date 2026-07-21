import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Text utils ─────────────────────────────────────────────────────────────────
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
   .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const stopwords = new Set(["com", "sem", "por", "para", "das", "dos", "aos", "uma", "uns", "num", "nao", "que", "nao", "ao", "de", "da", "do", "e", "a", "o"]);
const tokens = (s: string) => norm(s).split(" ").filter(w => w.length >= 3 && !stopwords.has(w));

// Levenshtein distance
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i-1] === b[j-1] ? prev : 1 + Math.min(prev, dp[j], dp[j-1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

// Word-level fuzzy similarity: two words match if lev distance ≤ 1 per 4 chars
const wordMatch = (a: string, b: string) => {
  if (a === b) return true;
  const maxDist = Math.floor(Math.max(a.length, b.length) / 4);
  return lev(a, b) <= Math.min(maxDist, 2);
};

// Token Jaccard with fuzzy word matching
function similarity(menuItem: string, sheetName: string): number {
  const ta = tokens(menuItem);
  const tb = tokens(sheetName);
  if (ta.length === 0 || tb.length === 0) return 0;
  let matched = 0;
  for (const wa of ta) {
    if (tb.some(wb => wordMatch(wa, wb))) matched++;
  }
  const union = ta.length + tb.length - matched;
  return matched / union;
}

// Extract menu items from text (ignore section headers in ALL CAPS)
function extractMenuItems(text: string): string[] {
  const lines = text.split(/[\n;]/).map(l => l.replace(/^[·•\-\*]\s*/, "").trim()).filter(Boolean);
  const items: string[] = [];
  for (const line of lines) {
    // Skip short lines, pure caps section headers, and lines with just numbers
    if (line.length < 4) continue;
    if (/^\d+$/.test(line)) continue;
    const upper = line.replace(/[^a-zA-Z]/g, '');
    if (upper.length > 3 && upper === upper.toUpperCase() && !line.includes(' ') === false && line.split(' ').length <= 3 && line.length < 30) continue;
    items.push(line);
  }
  return [...new Set(items)];
}

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

    const menuItems = extractMenuItems(menu_text.slice(0, 20000));

    // ── Stage 1: Local fuzzy matching ─────────────────────────────────────────
    const matched_ids: string[] = [];
    const toAI: { menu_item: string; candidates: { id: string; name: string; category: string | null; score: number }[] }[] = [];

    for (const item of menuItems) {
      const scored = sheets
        .map(s => ({ ...s, score: similarity(item, s.name) }))
        .sort((a, b) => b.score - a.score);

      const best = scored[0];

      if (best.score >= 0.55) {
        // High confidence → auto match
        if (!matched_ids.includes(best.id)) matched_ids.push(best.id);
      } else {
        // Send to AI with top candidates (always top 12, even with low score)
        const candidates = scored.slice(0, 12);
        toAI.push({ menu_item: item, candidates });
      }
    }

    // ── Stage 2: AI for ambiguous items ───────────────────────────────────────
    const uncertain: { menu_item: string; suggestions: { id: string; name: string; category: string | null }[] }[] = [];
    const unmatched: string[] = [];

    if (toAI.length > 0) {
      // Build compact prompt: only send candidates relevant to each item
      const aiItems = toAI.map((x, i) => {
        const cands = x.candidates.map((c, j) => `  ${j}:${c.name}`).join("\n");
        return `[${i}] "${x.menu_item}"\nCandidatos:\n${cands}`;
      }).join("\n\n");

      const prompt = `Você é um especialista em buffet e gastronomia. Para cada item do cardápio, identifique a melhor ficha técnica entre os candidatos listados.

Regras de matching (seja generoso — prefira "matched" a "uncertain" sempre que possível):
- Ignore maiúsculas, acentos e variações ortográficas
- Ingredientes extras ou modo de preparo não impedem o match: "Queijo tipo brie em massa filo com geleia de damasco" → "Brie em massa filo e geleia de frutas vermelhas" é match
- Nomes parciais contam: "Mini Temaki de salmão" → "Temaki salmão cream cheese" é match
- Bebidas simples (água, refrigerante, suco, cerveja) raramente têm ficha técnica — marque como unmatched se nenhum candidato for relevante
- Se o candidato de maior score fizer sentido semântico mesmo com grafia diferente, use "matched"

${aiItems}

Para cada item [i], responda com:
- "matched": índice do candidato se for correspondência clara ou provável (>50% de certeza)
- "uncertain": lista de índices dos melhores candidatos (até 3) se houver dúvida real
- "unmatched": true se nenhum candidato fizer sentido (ex: bebidas industrializadas sem ficha)

JSON (array com um objeto por item, na mesma ordem):
[{"i":0,"matched":2},{"i":1,"uncertain":[0,1]},{"i":2,"unmatched":true}]`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const rawText = await response.text();
      if (!response.ok) throw new Error(`Anthropic ${response.status}: ${rawText.slice(0, 300)}`);

      const result = JSON.parse(rawText);
      const aiText = result.content?.[0]?.text ?? "";
      const jsonMatch = aiText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const parsed: { i: number; matched?: number; uncertain?: number[]; unmatched?: boolean }[] = JSON.parse(jsonMatch[0]);

        for (const r of parsed) {
          const item = toAI[r.i];
          if (!item) continue;

          if (r.matched !== undefined && item.candidates[r.matched]) {
            const sheet = item.candidates[r.matched];
            if (!matched_ids.includes(sheet.id)) matched_ids.push(sheet.id);
          } else if (r.uncertain && r.uncertain.length > 0) {
            const suggestions = r.uncertain
              .map((j: number) => item.candidates[j])
              .filter(Boolean)
              .map(c => ({ id: c.id, name: c.name, category: c.category }));
            if (suggestions.length > 0) uncertain.push({ menu_item: item.menu_item, suggestions });
            else unmatched.push(item.menu_item);
          } else {
            unmatched.push(item.menu_item);
          }
        }
      } else {
        // If AI failed to parse, add everything to uncertain with top candidates
        for (const item of toAI) {
          if (item.candidates.length > 0) {
            uncertain.push({
              menu_item: item.menu_item,
              suggestions: item.candidates.slice(0, 3).map(c => ({ id: c.id, name: c.name, category: c.category })),
            });
          } else {
            unmatched.push(item.menu_item);
          }
        }
      }
    }

    return new Response(JSON.stringify({ matched_ids, uncertain, unmatched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
