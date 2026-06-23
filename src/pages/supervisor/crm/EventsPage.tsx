import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Plus, ChevronLeft, ChevronRight,
  CalendarDays, CheckCircle2, MoreVertical,
  Download, SlidersHorizontal, CalendarX,
} from 'lucide-react';

type EventRow = {
  id: string;
  event_name: string;
  event_type: string | null;
  status: string;
  event_date: string | null;
  location_text: string | null;
  guest_count: number | null;
  price_per_person: number | null;
  total_value: number | null;
  is_paid_in_full: boolean | null;
  contract_signed_date: string | null;
  clients: { name: string } | null;
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_LABELS: Record<string, string> = {
  lead: '1º Contato',
  negotiating: 'Negociando',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
};

const STATUS_CLASSES: Record<string, string> = {
  lead: 'bg-blue-100 text-blue-700',
  negotiating: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

function fmtCurrency(v: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function fmtShortDate(d: string | null) {
  if (!d) return null;
  const dt = new Date(d + 'T12:00:00');
  return (dt.getMonth() + 1).toString().padStart(2, '0') + '/' + String(dt.getFullYear()).slice(2);
}

function fmtFullDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function EventsPage() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(today.getMonth());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('events')
        .select('id, event_name, event_type, status, event_date, location_text, guest_count, price_per_person, total_value, is_paid_in_full, contract_signed_date, clients(name)')
        .order('event_date', { ascending: true });
      setEvents((data as EventRow[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const monthsWithEvents = useMemo(() => {
    const set = new Set<number>();
    events.forEach(e => {
      if (!e.event_date) return;
      const d = new Date(e.event_date + 'T12:00:00');
      if (d.getFullYear() === selectedYear) set.add(d.getMonth());
    });
    return set;
  }, [events, selectedYear]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (!e.event_date) return selectedMonth === null;
      const d = new Date(e.event_date + 'T12:00:00');
      if (d.getFullYear() !== selectedYear) return false;
      if (selectedMonth !== null && d.getMonth() !== selectedMonth) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.event_name.toLowerCase().includes(q) &&
          !(e.clients?.name ?? '').toLowerCase().includes(q) &&
          !(e.location_text ?? '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [events, selectedYear, selectedMonth, search]);

  const isPast = (date: string | null) => !!date && date < todayStr;
  const isToday = (date: string | null) => date === todayStr;

  return (
    <div className="flex gap-0 -mx-8 -mt-8 min-h-[calc(100vh-56px)]">

      {/* ── Sidebar mensal ── */}
      <aside className="w-52 shrink-0 border-r border-border bg-card/60 pt-6 pb-4 flex flex-col">

        {/* Year navigation */}
        <div className="flex items-center justify-between px-4 mb-4">
          <button
            onClick={() => setSelectedYear(y => y - 1)}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-foreground">{selectedYear}</span>
          <button
            onClick={() => setSelectedYear(y => y + 1)}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Month list */}
        <nav className="flex-1 px-2 space-y-0.5">
          {/* "Ano Completo" option */}
          <button
            onClick={() => setSelectedMonth(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedMonth === null
                ? 'bg-primary text-white font-semibold'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            Ano Completo
          </button>

          {MONTHS.map((name, idx) => {
            const isCurrentMonth = idx === today.getMonth() && selectedYear === today.getFullYear();
            const isPastMonth =
              selectedYear < today.getFullYear() ||
              (selectedYear === today.getFullYear() && idx < today.getMonth());
            const isSelected = selectedMonth === idx;
            const hasEvents = monthsWithEvents.has(idx);

            return (
              <button
                key={idx}
                onClick={() => setSelectedMonth(idx)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isSelected
                    ? 'bg-primary text-white font-semibold'
                    : isPastMonth
                    ? 'text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground'
                    : isCurrentMonth
                    ? 'text-primary font-semibold hover:bg-primary/8'
                    : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                }`}
              >
                {/* Checkbox visual */}
                <span className={`w-3.5 h-3.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'border-white bg-white'
                    : isPastMonth
                    ? 'border-muted-foreground/30 bg-muted-foreground/10'
                    : isCurrentMonth
                    ? 'border-primary bg-primary/10'
                    : 'border-border'
                }`}>
                  {(isPastMonth || isSelected) && (
                    <svg className={`w-2 h-2 ${isSelected ? 'text-primary' : 'text-muted-foreground/50'}`} fill="currentColor" viewBox="0 0 8 8">
                      <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    </svg>
                  )}
                </span>
                <span className="flex-1 text-left">{name}</span>
                {hasEvents && !isSelected && (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPastMonth ? 'bg-muted-foreground/30' : 'bg-primary/50'}`} />
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col pt-6 px-6 pb-6 min-w-0">

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, cliente ou local..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>

          <button className="p-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors text-muted-foreground" title="Exportar">
            <Download className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors text-muted-foreground" title="Filtros">
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <Button className="gap-2 shrink-0 rounded-lg">
            <Plus className="w-4 h-4" />
            Novo Evento
          </Button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Neste período', value: filtered.length, cls: 'text-foreground' },
            { label: 'Confirmados', value: filtered.filter(e => e.status === 'confirmed').length, cls: 'text-emerald-700' },
            { label: 'Valor total', value: fmtCurrency(filtered.filter(e=>e.status==='confirmed').reduce((s,e)=>s+(e.total_value??0),0)), cls: 'text-primary' },
            { label: 'A receber', value: fmtCurrency(filtered.filter(e=>e.status==='confirmed'&&!e.is_paid_in_full).reduce((s,e)=>s+(e.total_value??0),0)), cls: 'text-amber-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-border px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-0.5">{s.label}</p>
              <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wide">DATA</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wide">NOME DO CONTRATANTE</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wide">LOCAL DO EVENTO</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wide">TIPO DO EVENTO</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wide">PREÇO/PAX</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wide">CONVIDADOS</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wide">STATUS</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wide">PGTO</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-3.5 bg-muted/40 rounded animate-pulse" style={{ width: `${[50,35,30,20,18,15,18,15,5][j]}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-muted-foreground">
                    <CalendarX className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhum evento neste período</p>
                  </td>
                </tr>
              ) : (
                filtered.map(event => {
                  const past = isPast(event.event_date);
                  const today_ = isToday(event.event_date);
                  const contractShort = fmtShortDate(event.contract_signed_date);

                  return (
                    <tr
                      key={event.id}
                      className={`border-b border-border/50 transition-colors cursor-pointer group ${
                        today_
                          ? 'bg-primary/5 hover:bg-primary/8'
                          : past
                          ? 'opacity-55 hover:opacity-80 hover:bg-muted/30'
                          : 'hover:bg-primary/4'
                      }`}
                    >
                      {/* Data */}
                      <td className="px-4 py-3">
                        <span className={`text-sm whitespace-nowrap ${
                          today_ ? 'font-bold text-primary' : past ? 'text-muted-foreground' : 'font-semibold text-foreground'
                        }`}>
                          {fmtFullDate(event.event_date)}
                        </span>
                        {today_ && (
                          <span className="ml-1.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Hoje</span>
                        )}
                      </td>

                      {/* Cliente */}
                      <td className="px-4 py-3">
                        <p className={`font-medium truncate max-w-[180px] ${past ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {event.clients?.name ?? event.event_name}
                        </p>
                        {event.event_name && event.clients?.name && (
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{event.event_name}</p>
                        )}
                      </td>

                      {/* Local */}
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground truncate max-w-[140px] block text-sm">
                          {event.location_text || '—'}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">{event.event_type || '—'}</span>
                      </td>

                      {/* Preço/pax */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-foreground">
                          {fmtCurrency(event.price_per_person)}
                        </span>
                      </td>

                      {/* Convidados */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-muted-foreground">
                          {event.guest_count ?? '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_CLASSES[event.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {STATUS_LABELS[event.status] ?? event.status}
                        </span>
                      </td>

                      {/* Pagamento */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {event.status === 'confirmed' ? (
                            <>
                              {contractShort && (
                                <span className="text-[10px] text-muted-foreground font-mono">{contractShort}</span>
                              )}
                              <div className="flex items-center gap-1">
                                {event.is_paid_in_full ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-[11px] font-bold text-emerald-600">100%</span>
                                  </>
                                ) : (
                                  <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Pendente</span>
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="px-2 py-3">
                        <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all text-muted-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 text-right">
            {filtered.length} evento{filtered.length !== 1 ? 's' : ''} · eventos passados aparecem com opacidade reduzida
          </p>
        )}
      </div>
    </div>
  );
}
