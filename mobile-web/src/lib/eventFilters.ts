import type { Event } from '../types';

/** Evento confirmado/fechado — status 'confirmed' ou 'completed' */
export function isFechado(e: Event): boolean {
  return e.status === 'confirmed' || e.status === 'completed';
}

/** Reserva — não existe como campo direto no Supabase; sempre false */
export function isReserva(_e: Event): boolean {
  return false;
}

/** Label legível do status Supabase */
export function statusLabel(status: string): string {
  const MAP: Record<string, string> = {
    confirmed:         'Confirmado',
    completed:         'Realizado',
    lead:              '1º Contato',
    negotiating:       'Negociando',
    tasting_scheduled: 'Degustação',
    lost:              'Não fechou',
    cancelled:         'Cancelado',
  };
  return MAP[status] ?? status;
}

/** Classe CSS de badge para o status */
export function statusBadgeClass(status: string): string {
  const MAP: Record<string, string> = {
    confirmed:         'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed:         'bg-emerald-100 text-emerald-800 border-emerald-300',
    lead:              'bg-violet-50  text-violet-700  border-violet-200',
    negotiating:       'bg-blue-50    text-blue-700    border-blue-200',
    tasting_scheduled: 'bg-purple-50  text-purple-700  border-purple-200',
    lost:              'bg-gray-100   text-gray-600    border-gray-200',
    cancelled:         'bg-red-50     text-red-700     border-red-200',
  };
  return MAP[status] ?? 'bg-gray-100 text-gray-500 border-gray-200';
}

/** Nome a exibir para o evento */
export function eventDisplayName(e: Event): string {
  return e.event_name ?? (e.clients as any)?.name ?? '—';
}

/** Nome do local — usa location_text (já denormalizado) */
export function eventLocationName(e: Event): string {
  return (e.event_locations as any)?.name ?? e.location_text ?? '';
}
