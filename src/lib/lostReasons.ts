export const LOST_REASONS = [
  { key: 'price',      label: 'Preço ficou acima' },
  { key: 'competitor', label: 'Se identificou mais com o concorrente' },
  { key: 'process',    label: 'Não gostou de algo no processo' },
  { key: 'date',       label: 'Data indisponível' },
  { key: 'no_return',  label: 'Não retornou mais' },
  { key: 'no_reason',  label: 'Não passou o motivo' },
  { key: 'other',      label: 'Outro' },
] as const;

export type LostReasonKey = typeof LOST_REASONS[number]['key'];

export function getLostReasonLabel(key: string | null | undefined): string {
  if (!key) return '—';
  return LOST_REASONS.find(r => r.key === key)?.label ?? key;
}
