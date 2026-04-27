import type { BubbleEvento } from '../types';

// Statuses that explicitly exclude a record from being a "Reserva"
// Note: API returns "Não fechou" (lowercase 'f'), not "Não Fechou"
const RESERVA_EXCLUDED = new Set(['Fechado', 'Cancelado', 'Não fechou']);

/** Evento confirmado/fechado — aparece em Eventos e no Dashboard */
export function isFechado(e: BubbleEvento): boolean {
  return e.status === 'Fechado';
}

/**
 * Reserva = status diferente de Fechado, Cancelado e Não fechou
 *           E campo Data_reservada === true
 * Aparece apenas no Calendário.
 */
export function isReserva(e: BubbleEvento): boolean {
  return !RESERVA_EXCLUDED.has(e.status ?? '') && e.Data_reservada === true;
}
