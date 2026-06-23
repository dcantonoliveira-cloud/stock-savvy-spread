import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, CalendarDays, CheckCircle2, Clock, CalendarX } from 'lucide-react';

type EventRow = {
  id: string;
  event_name: string;
  event_type: string | null;
  status: string;
  event_date: string | null;
  location_text: string | null;
  guest_count: number | null;
  total_value: number | null;
  is_paid_in_full: boolean | null;
  notes: string | null;
  clients: { name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  lead: '1º Contato',
  negotiating: 'Negociando',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
};

const STATUS_CLASSES: Record<string, string> = {
  lead: 'bg-blue-100 text-blue-700',
  negotiating: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const FILTER_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'lead', label: '1º Contato' },
  { key: 'negotiating', label: 'Negociando' },
  { key: 'confirmed', label: 'Confirmado' },
  { key: 'cancelled', label: 'Cancelado' },
];

function fmtCurrency(value: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function fmtDate(date: string | null) {
  if (!date) return '—';
  return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('events')
        .select('*, clients(name)')
        .order('event_date', { ascending: false });
      setEvents((data as EventRow[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const confirmed = events.filter(e => e.status === 'confirmed');
  const totalConfirmedValue = confirmed.reduce((sum, e) => sum + (e.total_value ?? 0), 0);
  const totalReceivable = confirmed
    .filter(e => !e.is_paid_in_full)
    .reduce((sum, e) => sum + (e.total_value ?? 0), 0);

  const filtered = events.filter(e => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const clientName = e.clients?.name ?? '';
      if (
        !e.event_name.toLowerCase().includes(q) &&
        !clientName.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-display font-bold text-primary">Eventos</h1>
          <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {events.length}
          </span>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por evento ou cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Eventos</p>
            <p className="text-2xl font-bold text-primary">{events.length}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Confirmados</p>
            <p className="text-2xl font-bold text-green-700">{confirmed.length}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Valor Total (Confirmados)</p>
            <p className="text-lg font-bold text-primary truncate">{fmtCurrency(totalConfirmedValue)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">A Receber</p>
            <p className="text-lg font-bold text-amber-700 truncate">{fmtCurrency(totalReceivable)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setStatusFilter(opt.key)}
            className={`text-xs font-medium px-3.5 py-1.5 rounded-full border transition-colors ${
              statusFilter === opt.key
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs bg-muted/30">
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground">EVENTO</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">CLIENTE</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">DATA</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">CONVIDADOS</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden xl:table-cell">LOCAL</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">VALOR</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">STATUS</th>
              <th className="text-center px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">PGTO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {[30, 20, 10, 8, 15, 10, 10, 7].map((w, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-muted/40 rounded animate-pulse" style={{ width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center text-muted-foreground">
                  <CalendarX className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {search || statusFilter !== 'all'
                    ? 'Nenhum evento encontrado para os filtros selecionados.'
                    : 'Nenhum evento cadastrado.'}
                </td>
              </tr>
            ) : filtered.map(event => (
              <tr
                key={event.id}
                className="hover:bg-primary/5 transition-colors cursor-pointer"
                onClick={() => console.log('event', event.id)}
              >
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-foreground truncate max-w-[200px]">{event.event_name}</p>
                  {event.event_type && (
                    <p className="text-xs text-muted-foreground">{event.event_type}</p>
                  )}
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <span className="text-muted-foreground truncate max-w-[150px] block">
                    {event.clients?.name ?? <span className="opacity-30">—</span>}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                  {fmtDate(event.event_date)}
                </td>
                <td className="px-4 py-3.5 text-right text-muted-foreground hidden lg:table-cell">
                  {event.guest_count != null ? (
                    <span>{event.guest_count} <span className="text-xs">pax</span></span>
                  ) : (
                    <span className="opacity-30">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-muted-foreground hidden xl:table-cell">
                  <span className="truncate max-w-[160px] block">
                    {event.location_text ?? <span className="opacity-30">—</span>}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right font-medium text-foreground whitespace-nowrap">
                  {fmtCurrency(event.total_value)}
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CLASSES[event.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {STATUS_LABELS[event.status] ?? event.status}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center hidden sm:table-cell">
                  {event.status === 'confirmed' ? (
                    event.is_paid_in_full ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                    ) : (
                      <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Pendente</span>
                    )
                  ) : (
                    <span className="text-muted-foreground/30 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
