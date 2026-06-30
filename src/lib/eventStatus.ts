export type EventStatusKey =
  | 'lead'
  | 'negotiating'
  | 'tasting_scheduled'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'lost';

export const EVENT_STATUS: Record<EventStatusKey, {
  label: string;
  bg: string;
  text: string;
  border: string;
  cls: string; // shorthand para className em pills
}> = {
  lead: {
    label: '1º Contato',
    bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200',
    cls: 'bg-sky-50 text-sky-600 border-sky-200',
  },
  negotiating: {
    label: 'Negociando',
    bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  tasting_scheduled: {
    label: 'Degustação',
    bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200',
    cls: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  confirmed: {
    label: 'Confirmado',
    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  completed: {
    label: 'Realizado',
    bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  cancelled: {
    label: 'Não fechou',
    bg: 'bg-rose-50', text: 'text-rose-500', border: 'border-rose-200',
    cls: 'bg-rose-50 text-rose-500 border-rose-200',
  },
  lost: {
    label: 'Cancelado',
    bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300',
    cls: 'bg-red-100 text-red-700 border-red-300',
  },
};

const FALLBACK = {
  label: '—', bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border',
  cls: 'bg-muted text-muted-foreground border-border',
};

export function getStatus(key: string) {
  return EVENT_STATUS[key as EventStatusKey] ?? FALLBACK;
}

export const STATUS_LABEL = (key: string) => getStatus(key).label;
export const STATUS_CLS   = (key: string) => getStatus(key).cls;

// Mapa simples label-only para selects/filtros
export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(EVENT_STATUS).map(([k, v]) => [k, v.label])
);

// Chaves em ordem de pipeline (para filtros e dropdowns)
export const PIPELINE_KEYS: EventStatusKey[] = ['lead', 'negotiating', 'tasting_scheduled'];
export const ALL_STATUS_KEYS: EventStatusKey[] = [
  'lead', 'negotiating', 'tasting_scheduled', 'confirmed', 'completed', 'cancelled', 'lost',
];
