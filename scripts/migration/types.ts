// ─── Bubble API response shapes ───────────────────────────────────────────────

export interface BubbleListResponse<T> {
  response: {
    cursor: number;
    results: T[];
    count: number;
    remaining: number;
  };
}

/** Raw record from Bubble — any string-keyed field */
export type BubbleRecord = Record<string, unknown> & {
  _id: string;
  "Created Date"?: string;
  "Modified Date"?: string;
};

// ─── Bubble entity shapes (fields we actually use) ────────────────────────────

export interface BubbleClient extends BubbleRecord {
  NomeDoCliente?: string;
  Telefone?: string;
  email?: string;
  CPF?: string;
  RG?: string;
  "endereço"?: string;
  CEP?: string;
  StatusDoCliente?: string;
}

export interface BubbleEvent extends BubbleRecord {
  NomeDoEvento?: string;
  Tipo_Do_Evento?: string;
  status?: string;
  dataDoEvento?: string;
  "Local Do Evento_TXT"?: string;
  QtdConvidados?: number;
  "Crianças50%"?: number;
  CriançasNãoPagantes?: number;
  PreçoCombinado?: number;
  ValorTotalEvento?: number;
  dataQueFechouContrato?: string;
  Quitado?: boolean | string;
  Observações?: string;
  // FK to client (single Bubble ID string)
  Cliente?: string;
}

export interface BubbleTasting extends BubbleRecord {
  data?: string;
  convidados?: number;
  Cardápio?: string;
  clientesConfirmados?: string[];
  // FKs (may be arrays in Bubble)
  eventos?: string | string[];
  clientes?: string | string[];
}

// ─── Supabase insert shapes ────────────────────────────────────────────────────

export type EventStatus =
  | "lead"
  | "tasting_scheduled"
  | "negotiating"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface SupabaseClient {
  id?: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  rg: string | null;
  address: string | null;
  zip_code: string | null;
  dietary_restrictions: string | null;
  notes: string | null;
  source: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseEvent {
  id?: string;
  client_id: string | null;
  event_name: string | null;
  event_type: string | null;
  status: EventStatus;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_hours: number | null;
  location_text: string | null;
  guest_count: number | null;
  children_50_pct: number | null;
  non_paying_guests: number | null;
  product_name: string | null;
  price_per_person: number | null;
  total_value: number | null;
  contract_signed: boolean;
  contract_signed_date: string | null;
  is_paid_in_full: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseTasting {
  id?: string;
  event_id: string | null;
  client_id: string | null;
  scheduled_date: string | null;
  guest_count: number | null;
  confirmed: boolean;
  status: string | null;
  menu_notes: string | null;
  feedback: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Migration state ──────────────────────────────────────────────────────────

export interface MigrationSummary {
  clients: { success: number; failed: number };
  events: { success: number; failed: number };
  tastings: { success: number; failed: number };
}
