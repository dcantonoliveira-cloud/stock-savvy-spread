// day: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
export interface DaySchedule {
  start: string;        // "HH:MM"
  expected_minutes: number;
}

export type WeekSchedule = Partial<Record<number, DaySchedule>>;

export const DEFAULT_SCHEDULE: WeekSchedule = {
  1: { start: '07:30', expected_minutes: 8 * 60 },   // Seg 8h
  2: { start: '07:30', expected_minutes: 9 * 60 },   // Ter 9h
  3: { start: '07:30', expected_minutes: 9 * 60 },   // Qua 9h
  4: { start: '07:30', expected_minutes: 9 * 60 },   // Qui 9h
  5: { start: '07:30', expected_minutes: 9 * 60 },   // Sex 9h
};

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export interface TimeEntryLike {
  type: 'entry' | 'exit' | 'adjustment';
  recorded_at: string;
  adjustment_minutes?: number | null;
}

// Retorna saldo em minutos para um dia (positivo = banco a favor, negativo = débito)
export function calcDayBalance(
  entries: TimeEntryLike[],
  schedule: WeekSchedule,
  day: Date,
): number {
  const dow = day.getDay();
  const sched = schedule[dow];

  const adjustments = entries
    .filter(e => e.type === 'adjustment')
    .reduce((s, e) => s + (e.adjustment_minutes ?? 0), 0);

  if (!sched) return adjustments;

  const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const entry = sorted.find(e => e.type === 'entry');
  const exit  = sorted.filter(e => e.type === 'exit').pop();
  if (!entry || !exit) return adjustments;

  const schedStartMin = timeToMinutes(sched.start);
  const entryDate = new Date(entry.recorded_at);
  const exitDate  = new Date(exit.recorded_at);

  const entryMin = entryDate.getHours() * 60 + entryDate.getMinutes();
  const exitMin  = exitDate.getHours()  * 60 + exitDate.getMinutes();

  // Entrada antes do horário não conta como extra
  const effectiveEntry = Math.max(entryMin, schedStartMin);
  const workedMin = Math.max(0, exitMin - effectiveEntry);

  return workedMin - sched.expected_minutes + adjustments;
}

export function formatBalance(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = minutes >= 0 ? '+' : '-';
  return `${sign}${h}h${m.toString().padStart(2, '0')}`;
}
