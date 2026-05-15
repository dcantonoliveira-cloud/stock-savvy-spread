// ---------------------------------------------------------------------------
// Bubble.io Data API client for Rondello Buffet management.
// ---------------------------------------------------------------------------

import type {
  BubbleAssessoria,
  BubbleConvidadoDeg,
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

// In-memory response cache — avoids redundant requests when navigating between pages.
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const _cache = new Map<string, { data: unknown; ts: number }>();

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}/${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const key = url.toString();
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data as T;

  const res = await fetch(key, { headers: HEADERS });
  if (!res.ok) throw new Error(`Bubble API ${res.status}: ${path}`);
  const data = await res.json() as T;
  _cache.set(key, { data, ts: Date.now() });
  return data;
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

// Fetch first page, then fire all remaining pages in parallel.
export async function fetchAllEventos(
  opts?: { sortOrder?: 'asc' | 'desc' }
): Promise<BubbleEvento[]> {
  const first = await fetchEventos({ limit: 100, sortOrder: opts?.sortOrder ?? 'desc' });
  const all = [...first.response.results];
  if (first.response.remaining === 0) return all;

  const pageSize = first.response.count;
  const extraPages = Math.ceil(first.response.remaining / pageSize);
  const pages = await Promise.all(
    Array.from({ length: extraPages }, (_, i) =>
      fetchEventos({ limit: 100, cursor: pageSize * (i + 1), sortOrder: opts?.sortOrder ?? 'desc' })
    )
  );
  pages.forEach((p) => all.push(...p.response.results));
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

// Fetch first page, then fire all remaining pages in parallel.
export async function fetchAllDegustacoes(): Promise<BubbleDegustacao[]> {
  const first = await fetchDegustacoes();
  const all = [...first.response.results];
  if (first.response.remaining === 0) return all;

  const pageSize = first.response.count;
  const extraPages = Math.ceil(first.response.remaining / pageSize);
  const pages = await Promise.all(
    Array.from({ length: extraPages }, (_, i) =>
      fetchDegustacoes({ cursor: pageSize * (i + 1) })
    )
  );
  pages.forEach((p) => all.push(...p.response.results));
  return all;
}

// ── ConvidadosDeg ────────────────────────────────────────────────────────────

/** All guest records linked to a specific degustação */
export function fetchConvidadosDegForDeg(degId: string) {
  return apiFetch<BubbleListResponse<BubbleConvidadoDeg>>('ConvidadosDeg', {
    constraints: JSON.stringify([
      { key: 'Degustação', constraint_type: 'equals', value: degId },
    ]),
    limit: '100',
  });
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
