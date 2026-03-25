/**
 * Formatação padrão de números — sempre pt-BR, 2 casas decimais
 * Exemplos: 1500 → "1.500,00" | 8 → "8,00" | 0.5 → "0,50"
 */

/** Formata número com casas decimais em pt-BR */
export const fmtNum = (n: number | null | undefined, decimals = 2): string =>
  (n ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** Formata valor monetário: "R$ 1.500,00" */
export const fmtCur = (n: number | null | undefined): string =>
  `R$ ${fmtNum(n)}`;

/** Formata percentual: 0.154 → "15,4%" */
export const fmtPct = (n: number, decimals = 1): string =>
  `${(n * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;

/** Formata data dd/mm/aaaa */
export const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
