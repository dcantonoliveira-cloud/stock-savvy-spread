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

function num(val: unknown): number | null {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// ─── Transformers ─────────────────────────────────────────────────────────────

export function transformClient(raw: BubbleClient): SupabaseClient {
  return {
    name: str(raw.nome),
    phone: str(raw.telefone),
    email: str(raw.email),
    cpf: str(raw.cpf),
    rg: str(raw.rg),
    address: str(raw.endereco),
    zip_code: str(raw.cep),
    dietary_restrictions: str(raw.restricoes_alimentares),
    notes: str(raw.observacoes),
    source: str(raw.origem),
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
  if (raw.cliente) {
    const resolved = clientIdMap.get(raw.cliente);
    if (resolved) {
      client_id = resolved;
    } else {
      warnings.push(`client FK "${raw.cliente}" not found in clientIdMap`);
    }
  }

  // Resolve status
  const { status, unknown: unknownStatus } = mapStatus(raw.statuscliente);
  if (unknownStatus) {
    warnings.push(
      `status desconhecido "${raw.statuscliente}" → fallback para "lead"`
    );
  }

  const record: SupabaseEvent = {
    client_id,
    event_name: str(raw.nome_evento),
    event_type: str(raw.tipo_evento),
    status,
    event_date: toDateOnly(raw.data_evento),
    start_time: toTimeOnly(raw.hora_inicio),
    end_time: toTimeOnly(raw.hora_fim),
    duration_hours: num(raw.duracao_horas),
    location_text: str(raw.local),
    guest_count: num(raw.numero_convidados),
    children_50_pct: num(raw.criancas_50pct),
    non_paying_guests: num(raw.nao_pagantes),
    product_name: str(raw.produto),
    price_per_person: num(raw.preco_por_pessoa),
    total_value: num(raw.valor_total),
    contract_signed: toBoolean(raw.contrato_assinado),
    contract_signed_date: toDateOnly(raw.data_assinatura_contrato),
    is_paid_in_full: toBoolean(raw.pago_integralmente),
    notes: str(raw.observacoes),
    created_at: toIsoDate(raw["Created Date"]) ?? undefined,
    updated_at: toIsoDate(raw["Modified Date"]) ?? undefined,
  };

  return { record, warnings };
}

export function transformTasting(
  raw: BubbleTasting,
  clientIdMap: Map<string, string>,
  eventIdMap: Map<string, string>
): { record: SupabaseTasting; warnings: string[] } {
  const warnings: string[] = [];

  let event_id: string | null = null;
  if (raw.evento) {
    const resolved = eventIdMap.get(raw.evento);
    if (resolved) {
      event_id = resolved;
    } else {
      warnings.push(`event FK "${raw.evento}" not found in eventIdMap`);
    }
  }

  let client_id: string | null = null;
  if (raw.cliente) {
    const resolved = clientIdMap.get(raw.cliente);
    if (resolved) {
      client_id = resolved;
    } else {
      warnings.push(`client FK "${raw.cliente}" not found in clientIdMap`);
    }
  }

  const record: SupabaseTasting = {
    event_id,
    client_id,
    scheduled_date: toDateOnly(raw.data_degustacao),
    guest_count: num(raw.numero_convidados),
    confirmed: toBoolean(raw.confirmado),
    status: str(raw.status),
    menu_notes: str(raw.notas_cardapio),
    feedback: str(raw.feedback),
    created_at: toIsoDate(raw["Created Date"]) ?? undefined,
    updated_at: toIsoDate(raw["Modified Date"]) ?? undefined,
  };

  return { record, warnings };
}
