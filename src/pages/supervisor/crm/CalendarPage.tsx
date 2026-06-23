import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

type EventRow = {
  id: string;
  event_name: string;
  event_date: string;
  status: string | null;
  total_value: number | null;
  clients: { name: string } | null;
};

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const STATUS_COLOR: Record<string, string> = {
  lead: 'bg-blue-500',
  negotiating: 'bg-amber-500',
  confirmed: 'bg-emerald-500',
  cancelled: 'bg-red-400',
};

const STATUS_BADGE: Record<string, string> = {
  lead: 'bg-blue-100 text-blue-700 border-blue-200',
  negotiating: 'bg-amber-100 text-amber-700 border-amber-200',
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-500 border-red-200',
};

const STATUS_LABEL: Record<string, string> = {
  lead: 'Lead',
  negotiating: 'Negociando',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
};

function fmtCur(v: number | null) {
  if (v === null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setSelectedDay(null);
      const firstDay = new Date(year, month, 1).toISOString().slice(0, 10);
      const lastDay = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('events')
        .select('id, event_name, event_date, status, total_value, clients(name)')
        .gte('event_date', firstDay)
        .lte('event_date', lastDay)
        .order('event_date');
      if (data) setEvents(data as EventRow[]);
      setLoading(false);
    };
    load();
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const eventsByDay = events.reduce<Record<number, EventRow[]>>((acc, ev) => {
    const day = new Date(ev.event_date + 'T12:00:00').getDate();
    if (!acc[day]) acc[day] = [];
    acc[day].push(ev);
    return acc;
  }, {});

  const firstDow = getFirstDayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : [];

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-primary">Calendário de Eventos</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-base font-semibold text-primary min-w-[160px] text-center">
            {MONTHS[month]} {year}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card className="glass-card lg:col-span-2">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="text-xs font-semibold text-muted-foreground text-center py-2">
                  {wd}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="h-24 rounded-lg" />;
                  }
                  const dayEvents = eventsByDay[day] ?? [];
                  const selected = selectedDay === day;
                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(selected ? null : day)}
                      className={`h-24 rounded-lg p-1.5 cursor-pointer border transition-all flex flex-col ${
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:border-border hover:bg-muted/40'
                      }`}
                    >
                      <span
                        className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 self-start ${
                          isToday(day)
                            ? 'bg-primary text-white'
                            : 'text-foreground'
                        }`}
                      >
                        {day}
                      </span>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-center gap-1 min-w-0"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_COLOR[ev.status ?? ''] ?? 'bg-gray-400'}`}
                            />
                            <span className="text-[10px] text-foreground truncate leading-tight">
                              {ev.event_name}
                            </span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-primary">
              {selectedDay
                ? `${selectedDay} de ${MONTHS[month]}`
                : 'Selecione um dia'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDay ? (
              <p className="text-sm text-muted-foreground">Clique em um dia no calendário para ver os eventos.</p>
            ) : selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento neste dia.</p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-xl border border-border bg-white space-y-1">
                    <p className="font-semibold text-sm text-primary leading-tight">{ev.event_name}</p>
                    <p className="text-xs text-muted-foreground">{ev.clients?.name ?? '—'}</p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Badge variant="outline" className={`text-xs ${STATUS_BADGE[ev.status ?? ''] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {STATUS_LABEL[ev.status ?? ''] ?? ev.status ?? '—'}
                      </Badge>
                      <span className="text-xs font-medium text-foreground">{fmtCur(ev.total_value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
