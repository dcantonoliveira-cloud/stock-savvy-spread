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

// Retorna saldo em minutos para um dia (positivo = banco a favor, negativo = débito)
export function calcDayBalance(
  entries: { type: 'entry' | 'exit'; recorded_at: string }[],
  schedule: WeekSchedule,
  day: Date,
): number {
  const dow = day.getDay();
  const sched = schedule[dow];
  if (!sched) return 0; // dia não trabalhado

  const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const entry = sorted.find(e => e.type === 'entry');
  const exit  = sorted.filter(e => e.type === 'exit').pop();
  if (!entry || !exit) return 0;

  const schedStartMin = timeToMinutes(sched.start);
  const entryDate = new Date(entry.recorded_at);
  const exitDate  = new Date(exit.recorded_at);

  // Minutos locais do dia
  const entryMin = entryDate.getHours() * 60 + entryDate.getMinutes();
  const exitMin  = exitDate.getHours()  * 60 + exitDate.getMinutes();

  // Entrada antes do horário não conta como extra
  const effectiveEntry = Math.max(entryMin, schedStartMin);
  const workedMin = Math.max(0, exitMin - effectiveEntry);

  return workedMin - sched.expected_minutes;
}

export function formatBalance(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = minutes >= 0 ? '+' : '-';
  return `${sign}${h}h${m.toString().padStart(2, '0')}`;
}
