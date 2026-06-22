import type {
  BubbleClient,
  BubbleEvent,
  BubbleTasting,
  EventStatus,
  SupabaseClient,
  SupabaseEvent,
  SupabaseTasting,
} from "./types.js";

// ─── Status mapping ────────────────────────────────────────────────────────────
//
// Bubble option set "statuscliente"  →  Supabase enum "event_status"
//
// ┌─────────────────────┬──────────────────────┬─────────────────────────────┐
// │ Valor no Bubble     │ Enum no Supabase      │ Interpretação               │
// ├─────────────────────┼──────────────────────┼─────────────────────────────┤
// │ 1º contato          │ lead                  │ Primeiro contato recebido   │
// │ negociando          │ negotiating           │ Proposta em andamento       │
// │ fechado             │ confirmed             │ Contrato fechado/assinado   │
// │ não fechou          │ cancelled             │ Negociação perdida          │
// │ cancelado           │ cancelled             │ Evento cancelado            │
// └─────────────────────┴──────────────────────┴─────────────────────────────┘
//
// NOTA: "tasting_scheduled" e "completed" não têm equivalente direto no Bubble.
// Registros com status desconhecido caem em "lead" (conservador) e são logados.

const STATUS_MAP: Record<string, EventStatus> = {
  "1º contato": "lead",
  "1o contato": "lead",
  "primeiro contato": "lead",
  negociando: "negotiating",
  fechado: "confirmed",
  "não fechou": "cancelled",
  "nao fechou": "cancelled",
  cancelado: "cancelled",
};

export function mapStatus(raw: unknown): { status: EventStatus; unknown: boolean } {
  if (!raw || typeof raw !== "string") {
    return { status: "lead", unknown: true };
  }

  const normalized = raw.trim().toLowerCase();
  const mapped = STATUS_MAP[normalized];

  if (mapped) return { status: mapped, unknown: false };

  // Fuzzy fallbacks for common variations
  if (normalized.includes("contact") || normalized.includes("contato"))
    return { status: "lead", unknown: false };
  if (normalized.includes("negoci"))
    return { status: "negotiating", unknown: false };
  if (normalized.includes("fecha") || normalized.includes("confirm"))
    return { status: "confirmed", unknown: false };
  if (normalized.includes("cancel"))
    return { status: "cancelled", unknown: false };
  if (normalized.includes("conclu") || normalized.includes("realiz"))
    return { status: "completed", unknown: false };

  return { status: "lead", unknown: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBoolean(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const lower = val.toLowerCase().trim();
    return lower === "yes" || lower === "sim" || lower === "true" || lower === "1";
  }
  return false;
}

function toIsoDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val !== "string" && typeof val !== "number") return null;

  const d = new Date(val as string | number);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toDateOnly(val: unknown): string | null {
  const iso = toIsoDate(val);
  if (!iso) return null;
  return iso.split("T")[0]; // "YYYY-MM-DD"
}

function toTimeOnly(val: unknown): string | null {
  if (!val || typeof val !== "string") return null;
  // Bubble may return "HH:MM" or a full ISO datetime
  if (/^\d{2}:\d{2}/.test(val.trim())) return val.trim().slice(0, 5);
  const iso = toIsoDate(val);
  if (!iso) return null;
  return iso.split("T")[1]?.slice(0, 5) ?? null; // "HH:MM"
}

function str(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  return String(val).trim();
}

/**
 * Converts Bubble BBCode-like markup to HTML.
 * Preserves colors, highlights, bold, italic, lists, headings.
 */
function bubbleMarkupToHtml(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  let s = String(val);

  // Block wrappers (Bubble-specific, no HTML equivalent)
  s = s.replace(/\[ml\]/gi, "").replace(/\[\/ml\]/gi, "");
  s = s.replace(/\[indent=\d+\s+align=\w+\]/gi, "");

  // Headings
  s = s.replace(/\[h([1-6])\]/gi, "<h$1>").replace(/\[\/h([1-6])\]/gi, "</h$1>");

  // Alignment
  s = s.replace(/\[center\]/gi, '<div style="text-align:center">').replace(/\[\/center\]/gi, "</div>");

  // Lists
  s = s.replace(/\[ul\]/gi, "<ul>").replace(/\[\/ul\]/gi, "</ul>");
  s = s.replace(/\[ol\]/gi, "<ol>").replace(/\[\/ol\]/gi, "</ol>");
  s = s.replace(/\[li(?:[^\]]*)\]/gi, "<li>").replace(/\[\/li\]/gi, "</li>");

  // Inline formatting
  s = s.replace(/\[b\]/gi, "<strong>").replace(/\[\/b\]/gi, "</strong>");
  s = s.replace(/\[i\]/gi, "<em>").replace(/\[\/i\]/gi, "</em>");
  s = s.replace(/\[u\]/gi, "<u>").replace(/\[\/u\]/gi, "</u>");
  s = s.replace(/\[s\]/gi, "<s>").replace(/\[\/s\]/gi, "</s>");

  // Color: [color=rgb(...)] or [color=#hex]
  s = s.replace(/\[color=([^\]]+)\]/gi, '<span style="color:$1">').replace(/\[\/color\]/gi, "</span>");

  // Highlight / background color
  s = s.replace(/\[highlight=([^\]]+)\]/gi, '<span style="background-color:$1">').replace(/\[\/highlight\]/gi, "</span>");

  // Font size
  s = s.replace(/\[size=(\d+)\]/gi, '<span style="font-size:$1pt">').replace(/\[\/size\]/gi, "</span>");

  // Font family
  s = s.replace(/\[font=([^\]]+)\]/gi, '<span style="font-family:$1">').replace(/\[\/font\]/gi, "</span>");

  // Newlines → <br>
  s = s.replace(/\n/g, "<br>\n");

  return s.trim() || null;
}

function num(val: unknown): number | null {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// ─── Transformers ─────────────────────────────────────────────────────────────

export function transformClient(raw: BubbleClient): SupabaseClient {
  return {
    name: str(raw.NomeDoCliente),
    phone: str(raw.Telefone),
    email: str(raw.email),
    cpf: str(raw.CPF),
    rg: str(raw.RG),
    address: str(raw["endereço"]),
    zip_code: str(raw.CEP),
    dietary_restrictions: null,
    notes: null,
    source: null,
    created_at: toIsoDate(raw["Created Date"]) ?? undefined,
    updated_at: toIsoDate(raw["Modified Date"]) ?? undefined,
  };
}

export function transformEvent(
  raw: BubbleEvent,
  clientIdMap: Map<string, string>
): { record: SupabaseEvent; warnings: string[] } {
  const warnings: string[] = [];

  // Resolve client FK
  let client_id: string | null = null;
  if (raw.Cliente) {
    const resolved = clientIdMap.get(raw.Cliente);
    if (resolved) {
      client_id = resolved;
    } else {
      warnings.push(`client FK "${raw.Cliente}" not found in clientIdMap`);
    }
  }

  // Resolve status
  const { status, unknown: unknownStatus } = mapStatus(raw.status);
  if (unknownStatus) {
    warnings.push(
      `status desconhecido "${raw.status}" → fallback para "lead"`
    );
  }

  // contract_signed is derived from whether the signed date exists
  const contractSignedDate = toDateOnly(raw.dataQueFechouContrato);

  const record: SupabaseEvent = {
    client_id,
    event_name: str(raw.NomeDoEvento),
    event_type: str(raw.Tipo_Do_Evento),
    status,
    event_date: toDateOnly(raw.dataDoEvento),
    start_time: null,
    end_time: null,
    duration_hours: null,
    location_text: str(raw["Local Do Evento_TXT"]),
    guest_count: num(raw.QtdConvidados),
    children_50_pct: num(raw["Crianças50%"]),
    non_paying_guests: num(raw.CriançasNãoPagantes),
    product_name: null,
    price_per_person: num(raw.PreçoCombinado),
    total_value: num(raw.ValorTotalEvento),
    contract_signed: contractSignedDate !== null,
    contract_signed_date: contractSignedDate,
    is_paid_in_full: toBoolean(raw.Quitado),
    notes: bubbleMarkupToHtml(raw.Observações),
    created_at: toIsoDate(raw["Created Date"]) ?? undefined,
    updated_at: toIsoDate(raw["Modified Date"]) ?? undefined,
  };

  return { record, warnings };
}

function firstId(val: string | string[] | undefined): string | undefined {
  if (!val) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

export function transformTasting(
  raw: BubbleTasting,
  clientIdMap: Map<string, string>,
  eventIdMap: Map<string, string>
): { record: SupabaseTasting; warnings: string[] } {
  const warnings: string[] = [];

  let event_id: string | null = null;
  const bubbleEventId = firstId(raw.eventos);
  if (bubbleEventId) {
    const resolved = eventIdMap.get(bubbleEventId);
    if (resolved) {
      event_id = resolved;
    } else {
      warnings.push(`event FK "${bubbleEventId}" not found in eventIdMap`);
    }
  }

  let client_id: string | null = null;
  const bubbleClientId = firstId(raw.clientes);
  if (bubbleClientId) {
    const resolved = clientIdMap.get(bubbleClientId);
    if (resolved) {
      client_id = resolved;
    } else {
      warnings.push(`client FK "${bubbleClientId}" not found in clientIdMap`);
    }
  }

  const confirmed =
    Array.isArray(raw.clientesConfirmados) && raw.clientesConfirmados.length > 0;

  const record: SupabaseTasting = {
    event_id,
    client_id,
    scheduled_date: toDateOnly(raw.data),
    guest_count: num(raw.convidados),
    confirmed,
    status: null,
    menu_notes: bubbleMarkupToHtml(raw.Cardápio),
    feedback: null,
    created_at: toIsoDate(raw["Created Date"]) ?? undefined,
    updated_at: toIsoDate(raw["Modified Date"]) ?? undefined,
  };

  return { record, warnings };
}
