// ---------------------------------------------------------------------------
// Bubble.io Data API client for Rondello Buffet management.
// ---------------------------------------------------------------------------

import type {
  BubbleAssessoria,
  BubbleEvento,
  BubbleDegustacao,
  BubbleLocal,
  BubblePagamento,
  BubbleProduto,
  BubbleValorAdicional,
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
    sort_field: 'dataDoEvento',
    sort_order: opts?.sortOrder ?? 'desc',
    limit: String(opts?.limit ?? 100),
  };
  if (opts?.cursor) params.cursor = String(opts.cursor);
  if (opts?.constraints?.length) params.constraints = JSON.stringify(opts.constraints);

  return apiFetch<BubbleListResponse<BubbleEvento>>('eventos', params);
}

export function fetchEvento(id: string) {
  return apiFetch<BubbleSingleResponse<BubbleEvento>>(`eventos/${id}`);
}

// Bubble caps each response at 100 records. Paginate until remaining === 0.
export async function fetchAllEventos(
  opts?: { sortOrder?: 'asc' | 'desc' }
): Promise<BubbleEvento[]> {
  const all: BubbleEvento[] = [];
  let cursor = 0;

  while (true) {
    const r = await fetchEventos({
      limit: 100,
      cursor: cursor > 0 ? cursor : undefined,
      sortOrder: opts?.sortOrder ?? 'desc',
    });
    all.push(...r.response.results);
    if (r.response.remaining === 0) break;
    cursor += r.response.count;
  }

  return all;
}

// ── Locations ────────────────────────────────────────────────────────────────

export function fetchLocal(id: string) {
  return apiFetch<BubbleSingleResponse<BubbleLocal>>(`Locais_eventos/${id}`);
}

export async function fetchLocaisMap(
  eventos: Pick<BubbleEvento, 'LocalDoEvento'>[]
): Promise<Record<string, string>> {
  const ids = [
    ...new Set(eventos.map((e) => e.LocalDoEvento).filter(Boolean) as string[]),
  ];
  const results = await Promise.allSettled(ids.map((id) => fetchLocal(id)));
  const map: Record<string, string> = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') map[ids[i]] = r.value.response.Nome ?? '';
  });
  return map;
}

// ── Assessores ───────────────────────────────────────────────────────────────

export function fetchAssessoria(id: string) {
  return apiFetch<BubbleSingleResponse<BubbleAssessoria>>(`Assessores/${id}`);
}

// ── Produtos ─────────────────────────────────────────────────────────────────

export function fetchProduto(id: string) {
  return apiFetch<BubbleSingleResponse<BubbleProduto>>(`ProdutoRondello/${id}`);
}

// ── Tastings ─────────────────────────────────────────────────────────────────

export function fetchDegustacao(id: string) {
  return apiFetch<BubbleSingleResponse<BubbleDegustacao>>(`Degusta%C3%A7%C3%A3o/${id}`);
}

export function fetchDegustacoes(opts?: { cursor?: number }) {
  const params: Record<string, string> = {
    sort_field: 'data',
    sort_order: 'desc',
    limit: '100',
  };
  if (opts?.cursor) params.cursor = String(opts.cursor);
  return apiFetch<BubbleListResponse<BubbleDegustacao>>('Degusta%C3%A7%C3%A3o', params);
}

// Bubble caps each response at 100 records. Paginate until remaining === 0.
export async function fetchAllDegustacoes(): Promise<BubbleDegustacao[]> {
  const all: BubbleDegustacao[] = [];
  let cursor = 0;

  while (true) {
    const r = await fetchDegustacoes(cursor > 0 ? { cursor } : undefined);
    all.push(...r.response.results);
    if (r.response.remaining === 0) break;
    cursor += r.response.count;
  }

  return all;
}

// ── Financeiro ───────────────────────────────────────────────────────────────

export function fetchPagamentosForEvento(eventoId: string) {
  return apiFetch<BubbleListResponse<BubblePagamento>>('Pagamentos', {
    constraints: JSON.stringify([{ key: 'evento', constraint_type: 'equals', value: eventoId }]),
    sort_field: 'data',
    sort_order: 'asc',
    limit: '50',
  });
}

export function fetchValoresAdicionaisForEvento(eventoId: string) {
  return apiFetch<BubbleListResponse<BubbleValorAdicional>>('ValoresAdicionaisEventos', {
    constraints: JSON.stringify([{ key: 'evento', constraint_type: 'equals', value: eventoId }]),
    limit: '50',
  });
}
