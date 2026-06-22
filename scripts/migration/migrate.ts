#!/usr/bin/env node
/**
 * Bubble → Supabase migration
 *
 * Usage:
 *   npx tsx scripts/migration/migrate.ts --dry-run   # inspeciona sem inserir
 *   npx tsx scripts/migration/migrate.ts             # insere de verdade
 *
 * Env vars required (copy .env.example → .env inside this folder):
 *   BUBBLE_BASE_URL, BUBBLE_API_TOKEN
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { fetchAll } from "./bubble-api.js";
import { transformClient, transformEvent, transformTasting } from "./transform.js";
import { initLogger, logError, serializeError, closeLogger } from "./logger.js";
import type {
  BubbleClient,
  BubbleEvent,
  BubbleTasting,
  MigrationSummary,
} from "./types.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_CLIENTS = process.argv.includes("--skip-clients");
const DRY_RUN_SAMPLES = 5;

// Bubble Data Type names — adjust if your app uses different casing
const BUBBLE_TYPE_CLIENTS = "Clientes_RondBuffet";
const BUBBLE_TYPE_EVENTS = "eventos";
const BUBBLE_TYPE_TASTINGS = "Degustação";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

// ─── Supabase client ──────────────────────────────────────────────────────────

function buildSupabase() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}

// ─── Dry-run helpers ──────────────────────────────────────────────────────────

function printSamples(label: string, items: unknown[], total: number): void {
  const samples = items.slice(0, DRY_RUN_SAMPLES);
  console.log(`\n${"─".repeat(60)}`);
  console.log(`[DRY-RUN] ${label}: ${total} registros seriam migrados`);
  console.log(`Mostrando ${samples.length} exemplo(s):`);
  samples.forEach((s, i) => {
    console.log(`\n  [${i + 1}]`, JSON.stringify(s, null, 4).replace(/^/gm, "  ").trimStart());
  });
}

// ─── Migrate clients ──────────────────────────────────────────────────────────

async function loadClientIdMapFromSupabase(
  supabase: ReturnType<typeof buildSupabase>
): Promise<Map<string, string>> {
  console.log("  → Reconstruindo mapa de clientes a partir do Supabase...");
  const idMap = new Map<string, string>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, bubble_id")
      .not("bubble_id", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.bubble_id) idMap.set(row.bubble_id as string, row.id as string);
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`  ✓ ${idMap.size} clientes carregados do Supabase\n`);
  return idMap;
}

async function migrateClients(
  supabase: ReturnType<typeof buildSupabase>,
  summary: MigrationSummary
): Promise<Map<string, string>> {
  console.log("\n── 1/3  Clientes ──────────────────────────────────────────");

  if (SKIP_CLIENTS) {
    console.log("  (pulando inserção — carregando IDs existentes)");
    return loadClientIdMapFromSupabase(supabase);
  }

  const raw = await fetchAll<BubbleClient>(BUBBLE_TYPE_CLIENTS);
  const idMap = new Map<string, string>(); // bubble_id → supabase uuid

  const transformed = raw.map((r) => ({
    bubbleId: r._id,
    record: transformClient(r),
  }));

  if (DRY_RUN) {
    printSamples("clients", transformed.map((t) => ({ bubble_id: t.bubbleId, ...t.record })), raw.length);
    return idMap;
  }

  for (const { bubbleId, record } of transformed) {
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...record, bubble_id: bubbleId })
        .select("id")
        .single();

      if (error) throw error;
      idMap.set(bubbleId, data.id as string);
      summary.clients.success++;
    } catch (err) {
      logError("clients", bubbleId, serializeError(err));
      summary.clients.failed++;
    }
  }

  console.log(
    `  ✓ clients: ${summary.clients.success} inseridos, ${summary.clients.failed} falharam`
  );
  return idMap;
}

// ─── Migrate events ───────────────────────────────────────────────────────────

async function migrateEvents(
  supabase: ReturnType<typeof buildSupabase>,
  clientIdMap: Map<string, string>,
  summary: MigrationSummary
): Promise<Map<string, string>> {
  console.log("\n── 2/3  Eventos ──────────────────────────────────────────");

  const raw = await fetchAll<BubbleEvent>(BUBBLE_TYPE_EVENTS);
  const idMap = new Map<string, string>(); // bubble_id → supabase uuid

  const transformed = raw.map((r) => {
    const { record, warnings } = transformEvent(r, clientIdMap);
    return { bubbleId: r._id, record, warnings };
  });

  if (DRY_RUN) {
    const samples = transformed.slice(0, DRY_RUN_SAMPLES).map((t) => ({
      bubble_id: t.bubbleId,
      warnings: t.warnings,
      ...t.record,
    }));
    printSamples("events", samples, raw.length);
    return idMap;
  }

  for (const { bubbleId, record, warnings } of transformed) {
    try {
      if (warnings.length > 0) {
        logError("events", bubbleId, `warnings: ${warnings.join("; ")}`);
      }

      const { data, error } = await supabase
        .from("events")
        .insert({ ...record, bubble_id: bubbleId })
        .select("id")
        .single();

      if (error) throw error;
      idMap.set(bubbleId, data.id as string);
      summary.events.success++;
    } catch (err) {
      logError("events", bubbleId, serializeError(err));
      summary.events.failed++;
    }
  }

  console.log(
    `  ✓ events: ${summary.events.success} inseridos, ${summary.events.failed} falharam`
  );
  return idMap;
}

// ─── Migrate tastings ─────────────────────────────────────────────────────────

async function migrateTastings(
  supabase: ReturnType<typeof buildSupabase>,
  clientIdMap: Map<string, string>,
  eventIdMap: Map<string, string>,
  summary: MigrationSummary
): Promise<void> {
  console.log("\n── 3/3  Degustações ──────────────────────────────────────");

  const raw = await fetchAll<BubbleTasting>(BUBBLE_TYPE_TASTINGS);

  const transformed = raw.map((r) => {
    const { record, warnings } = transformTasting(r, clientIdMap, eventIdMap);
    return { bubbleId: r._id, record, warnings };
  });

  if (DRY_RUN) {
    const samples = transformed.slice(0, DRY_RUN_SAMPLES).map((t) => ({
      bubble_id: t.bubbleId,
      warnings: t.warnings,
      ...t.record,
    }));
    printSamples("tastings", samples, raw.length);
    return;
  }

  for (const { bubbleId, record, warnings } of transformed) {
    try {
      if (warnings.length > 0) {
        logError("tastings", bubbleId, `warnings: ${warnings.join("; ")}`);
      }

      const { error } = await supabase.from("tastings").insert({ ...record, bubble_id: bubbleId });

      if (error) throw error;
      summary.tastings.success++;
    } catch (err) {
      logError("tastings", bubbleId, serializeError(err));
      summary.tastings.failed++;
    }
  }

  console.log(
    `  ✓ tastings: ${summary.tastings.success} inseridas, ${summary.tastings.failed} falharam`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log(`║  Bubble → Supabase Migration  ${DRY_RUN ? "[DRY-RUN]          " : "[LIVE — inserindo]"}   ║`);
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  requireEnv("BUBBLE_BASE_URL");
  requireEnv("BUBBLE_API_TOKEN");

  const supabase = buildSupabase();

  const summary: MigrationSummary = {
    clients: { success: 0, failed: 0 },
    events: { success: 0, failed: 0 },
    tastings: { success: 0, failed: 0 },
  };

  initLogger(DRY_RUN);

  try {
    const clientIdMap = await migrateClients(supabase, summary);
    const eventIdMap = await migrateEvents(supabase, clientIdMap, summary);
    await migrateTastings(supabase, clientIdMap, eventIdMap, summary);
  } finally {
    closeLogger();
  }

  // ─── Final summary ────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  if (DRY_RUN) {
    console.log("RESUMO DRY-RUN (nenhum dado foi inserido):");
    console.log(`  clients   → ${summary.clients.success + summary.clients.failed || "—"} registros encontrados no Bubble`);
    console.log(`  events    → ${summary.events.success + summary.events.failed || "—"} registros encontrados no Bubble`);
    console.log(`  tastings  → ${summary.tastings.success + summary.tastings.failed || "—"} registros encontrados no Bubble`);
    console.log("\n✔ Valide o mapeamento acima e rode sem --dry-run para inserir.");
  } else {
    console.log("RESUMO FINAL:");
    console.log(`  clients   → ${summary.clients.success} ✓  /  ${summary.clients.failed} ✗`);
    console.log(`  events    → ${summary.events.success} ✓  /  ${summary.events.failed} ✗`);
    console.log(`  tastings  → ${summary.tastings.success} ✓  /  ${summary.tastings.failed} ✗`);

    const totalFailed =
      summary.clients.failed + summary.events.failed + summary.tastings.failed;
    if (totalFailed > 0) {
      console.log(`\n⚠  ${totalFailed} registro(s) falharam — veja migration-errors.log`);
    } else {
      console.log("\n✔ Migração concluída sem erros.");
    }
  }
}

main().catch((err) => {
  console.error("\n✖ Erro fatal:", err);
  process.exit(1);
});
