import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata uma data "pura" (coluna DATE do banco, ex: "2026-09-13") como dd/mm/aaaa
 * sem passar por `new Date(...)`, que interpreta a string como meia-noite UTC e,
 * no fuso do Brasil, exibe um dia a menos. */
export function formatDateOnlyBR(value: string | null | undefined): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

/** Data de hoje no formato "aaaa-mm-dd" usando o fuso LOCAL do navegador
 * (diferente de `new Date().toISOString()`, que usa UTC e pode "virar o dia"
 * errado perto da meia-noite no fuso do Brasil). */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
