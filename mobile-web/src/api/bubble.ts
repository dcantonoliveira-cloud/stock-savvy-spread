// ---------------------------------------------------------------------------
// Bubble.io Data API client for Rondello Buffet management.
// Adjust BASE_URL, TOKEN, and data-type names to match your Bubble app.
// ---------------------------------------------------------------------------

import type {
  BubbleEvento,
  BubbleDegustacao,
  BubbleListResponse,
  BubbleSingleResponse,
} from '../types';

const BASE_URL = 'https://rondellobuffet-app.com.br/api/1.1/obj';
const HEADERS = {
  Authorization: 'Bearer b4b3c4138bb1000811d5a3c0ba47a238',
  'Content-Type': 'application/json',
};

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}/${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) throw new Error(`Bubble API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ── Events ──────────────────────────────────────────────────────────────────

export function fetchEventos(opts?: {
  limit?: number;
  cursor?: number;
  sortOrder?: 'asc' | 'desc';
  constraints?: object[];
}) {
  const params: Record<string, string> = {
    // Field name for event date — adjust if your Bubble type differs
    sort_field: 'dataDoEvento',
    sort_order: opts?.sortOrder ?? 'desc',
    limit: String(opts?.limit ?? 100),
  };
  if (opts?.cursor) params.cursor = String(opts.cursor);
  if (opts?.constraints?.length) params.constraints = JSON.stringify(opts.constraints);

  return apiFetch<BubbleListResponse<BubbleEvento>>('Eventos', params);
}

export function fetchEvento(id: string) {
  return apiFetch<BubbleSingleResponse<BubbleEvento>>(`Eventos/${id}`);
}

// ── Tastings ─────────────────────────────────────────────────────────────────

// Adjust data type name "Degustacao" if yours is different (e.g. "Degustacoes")
export function fetchDegustacoes() {
  return apiFetch<BubbleListResponse<BubbleDegustacao>>('Degustacao', {
    sort_field: 'DataDaDegustacao',
    sort_order: 'desc',
    limit: '200',
  });
}
