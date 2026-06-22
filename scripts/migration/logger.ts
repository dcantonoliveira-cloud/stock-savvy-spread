import fs from "fs";
import path from "path";

const LOG_PATH = path.resolve(process.cwd(), "migration-errors.log");
let stream: fs.WriteStream | null = null;

export function initLogger(dryRun: boolean): void {
  if (dryRun) return;
  stream = fs.createWriteStream(LOG_PATH, { flags: "a" });
  const header = `\n${"=".repeat(60)}\nMigration run — ${new Date().toISOString()}\n${"=".repeat(60)}\n`;
  stream.write(header);
  console.log(`  Log de erros: ${LOG_PATH}\n`);
}

export function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) return JSON.stringify(err);
  return String(err);
}

export function logError(entity: string, bubbleId: string, reason: string): void {
  const line = `[${entity}] bubble_id=${bubbleId} | ${reason}\n`;
  if (stream) {
    stream.write(line);
  } else {
    // dry-run: print to stderr
    process.stderr.write("  ERROR " + line);
  }
}

export function closeLogger(): void {
  stream?.end();
}
