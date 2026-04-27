const PALETTE: Record<string, string> = {
  confirmado: 'bg-emerald-100 text-emerald-800',
  pendente:   'bg-gold-100 text-ron-800',
  cancelado:  'bg-red-100 text-red-700',
  realizado:  'bg-blue-100 text-blue-800',
  agendada:   'bg-violet-100 text-violet-800',
  realizada:  'bg-blue-100 text-blue-800',
};

const DOT: Record<string, string> = {
  confirmado: 'bg-emerald-500',
  pendente:   'bg-gold-400',
  cancelado:  'bg-red-400',
  realizado:  'bg-blue-400',
  agendada:   'bg-violet-400',
  realizada:  'bg-blue-400',
};

export default function StatusBadge({ status }: { status?: string }) {
  const key = (status ?? 'pendente').toLowerCase();
  const cls = PALETTE[key] ?? 'bg-stone-100 text-stone-600';
  const dot = DOT[key] ?? 'bg-stone-400';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {status ?? 'Pendente'}
    </span>
  );
}
