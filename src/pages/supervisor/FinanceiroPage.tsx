import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, TrendingUp, CheckCircle2, Clock, Loader2 } from 'lucide-react';

type EventRow = {
  id: string;
  event_name: string;
  event_date: string;
  status: string | null;
  total_value: number | null;
  is_paid_in_full: boolean | null;
  guest_count: number | null;
  clients: { name: string } | null;
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

const SHORT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtCur(v: number | null | undefined) {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function buildChartData(events: EventRow[]) {
  const now = new Date();
  const months: { label: string; year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: SHORT_MONTHS[d.getMonth()], year: d.getFullYear(), month: d.getMonth() });
  }
  return months.map(({ label, year, month }) => {
    const monthEvents = events.filter((ev) => {
      if (ev.status !== 'confirmed') return false;
      const d = new Date(ev.event_date + 'T12:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const total = monthEvents.reduce((s, ev) => s + (ev.total_value ?? 0), 0);
    const recebido = monthEvents
      .filter((ev) => ev.is_paid_in_full)
      .reduce((s, ev) => s + (ev.total_value ?? 0), 0);
    return { label, total, recebido };
  });
}

const formatYAxis = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);

const formatTooltip = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function FinanceiroPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('events')
        .select('id, event_name, event_date, status, total_value, is_paid_in_full, guest_count, clients(name)')
        .order('event_date', { ascending: false })
        .limit(100);
      if (data) setEvents(data as EventRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const receitaTotal = events.reduce((s, ev) => s + (ev.total_value ?? 0), 0);
  const confirmado = events
    .filter((ev) => ev.status === 'confirmed')
    .reduce((s, ev) => s + (ev.total_value ?? 0), 0);
  const recebido = events
    .filter((ev) => ev.is_paid_in_full)
    .reduce((s, ev) => s + (ev.total_value ?? 0), 0);
  const aReceber = events
    .filter((ev) => ev.status === 'confirmed' && !ev.is_paid_in_full)
    .reduce((s, ev) => s + (ev.total_value ?? 0), 0);

  const chartData = buildChartData(events);

  const tableEvents = events
    .filter((ev) => ev.status === 'confirmed' || ev.status === 'negotiating')
    .slice(0, 30);

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <h1 className="text-2xl font-bold text-primary">Financeiro</h1>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-primary opacity-80" />
                  <div>
                    <p className="text-xs text-muted-foreground">Receita Total</p>
                    <p className="text-lg font-bold text-primary leading-tight">{fmtCur(receitaTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 opacity-80" />
                  <div>
                    <p className="text-xs text-muted-foreground">Confirmado</p>
                    <p className="text-lg font-bold text-emerald-600 leading-tight">{fmtCur(confirmado)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-emerald-500 opacity-80" />
                  <div>
                    <p className="text-xs text-muted-foreground">Recebido</p>
                    <p className="text-lg font-bold text-emerald-500 leading-tight">{fmtCur(recebido)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-amber-500 opacity-80" />
                  <div>
                    <p className="text-xs text-muted-foreground">A Receber</p>
                    <p className="text-lg font-bold text-amber-500 leading-tight">{fmtCur(aReceber)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-primary">Receita Mensal — últimos 6 meses</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatTooltip(value),
                      name === 'total' ? 'Valor Total' : 'Recebido',
                    ]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
                  />
                  <Legend
                    formatter={(value) => (value === 'total' ? 'Valor Total' : 'Recebido')}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="total" name="total" fill="hsl(220, 70%, 42%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recebido" name="recebido" fill="hsl(152, 58%, 38%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-primary">Eventos — Confirmados & Negociando</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tableEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Nenhum evento encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left px-4 py-3 font-medium">Evento</th>
                        <th className="text-left px-4 py-3 font-medium">Cliente</th>
                        <th className="text-left px-4 py-3 font-medium">Data</th>
                        <th className="text-right px-4 py-3 font-medium">Convidados</th>
                        <th className="text-right px-4 py-3 font-medium">Valor</th>
                        <th className="text-center px-4 py-3 font-medium">Status</th>
                        <th className="text-center px-4 py-3 font-medium">Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableEvents.map((ev, i) => (
                        <tr
                          key={ev.id}
                          className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                        >
                          <td className="px-4 py-3 font-medium text-primary max-w-[180px] truncate">{ev.event_name}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">{ev.clients?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{ev.guest_count ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">{fmtCur(ev.total_value)}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className={`text-xs ${STATUS_BADGE[ev.status ?? ''] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {STATUS_LABEL[ev.status ?? ''] ?? ev.status ?? '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-medium ${ev.is_paid_in_full ? 'text-emerald-600' : 'text-amber-500'}`}>
                              {ev.is_paid_in_full ? 'Sim' : 'Não'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
