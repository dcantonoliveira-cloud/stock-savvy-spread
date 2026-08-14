import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Clock, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface TimeEntry {
  id: string;
  type: 'entry' | 'exit';
  recorded_at: string;
  note: string | null;
}

function diffHours(entry: string, exit: string) {
  const ms = new Date(exit).getTime() - new Date(entry).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export default function PontoPage() {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [now, setNow] = useState(new Date());

  // relógio em tempo real
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('time_entries' as any)
      .select('id, type, recorded_at, note')
      .eq('employee_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(100);
    setEntries((data ?? []) as unknown as TimeEntry[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const lastEntry = entries[0] ?? null;
  const nextType: 'entry' | 'exit' = lastEntry?.type === 'entry' ? 'exit' : 'entry';

  const punch = async () => {
    if (!user || punching) return;
    setPunching(true);
    const { data, error } = await supabase
      .from('time_entries' as any)
      .insert({ employee_id: user.id, type: nextType })
      .select('id, type, recorded_at, note')
      .single();
    if (error) { toast.error('Erro ao registrar ponto'); setPunching(false); return; }
    setEntries(prev => [data as unknown as TimeEntry, ...prev]);
    toast.success(nextType === 'entry' ? 'Entrada registrada!' : 'Saída registrada!');
    setPunching(false);
  };

  // Agrupa registros de hoje para exibir pares entrada/saída
  const todayEntries = entries.filter(e => isToday(parseISO(e.recorded_at)));

  // Agrupa por dia para histórico
  const byDay = entries.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    const day = e.recorded_at.slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});

  const days = Object.entries(byDay)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 14); // últimos 14 dias

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Meu Ponto</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Olá, {profile?.display_name?.split(' ')[0]}
        </p>
      </div>

      {/* Relógio + botão */}
      <div className="bg-white border border-border rounded-2xl p-6 flex flex-col items-center gap-5">
        <div className="text-center">
          <p className="text-4xl font-bold tabular-nums text-foreground tracking-tight">
            {format(now, 'HH:mm:ss')}
          </p>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <button
          onClick={punch}
          disabled={punching}
          className={`w-full max-w-xs py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 transition-all active:scale-95 disabled:opacity-60 ${
            nextType === 'entry'
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'bg-rose-500 hover:bg-rose-600 text-white'
          }`}
        >
          {nextType === 'entry'
            ? <><LogIn className="w-5 h-5" /> Registrar Entrada</>
            : <><LogOut className="w-5 h-5" /> Registrar Saída</>}
        </button>

        {lastEntry && (
          <p className="text-xs text-muted-foreground text-center">
            Último registro: <span className="font-medium text-foreground">
              {lastEntry.type === 'entry' ? 'Entrada' : 'Saída'}
            </span> às {format(parseISO(lastEntry.recorded_at), 'HH:mm')}
            {isToday(parseISO(lastEntry.recorded_at)) ? ' (hoje)' : ` em ${format(parseISO(lastEntry.recorded_at), 'dd/MM')}`}
          </p>
        )}
      </div>

      {/* Registros de hoje */}
      {todayEntries.length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <p className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 border-b border-border bg-muted/30">
            Hoje
          </p>
          <div className="divide-y divide-border/50">
            {[...todayEntries].reverse().map(e => (
              <div key={e.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {e.type === 'entry'
                    ? <LogIn className="w-4 h-4 text-emerald-500" />
                    : <LogOut className="w-4 h-4 text-rose-500" />}
                  <span className="text-sm font-medium text-foreground">
                    {e.type === 'entry' ? 'Entrada' : 'Saída'}
                  </span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground font-medium">
                  {format(parseISO(e.recorded_at), 'HH:mm')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico */}
      {days.filter(([day]) => !isToday(parseISO(day + 'T00:00:00'))).length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <p className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 border-b border-border bg-muted/30">
            Histórico
          </p>
          <div className="divide-y divide-border/50">
            {days.filter(([day]) => !isToday(parseISO(day + 'T00:00:00'))).map(([day, dayEntries]) => {
              const sorted = [...dayEntries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
              const entryE = sorted.find(e => e.type === 'entry');
              const exitE  = sorted.filter(e => e.type === 'exit').pop();
              const total  = entryE && exitE ? diffHours(entryE.recorded_at, exitE.recorded_at) : null;
              return (
                <div key={day} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">
                      {format(parseISO(day), "EEE, dd 'de' MMM", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entryE ? format(parseISO(entryE.recorded_at), 'HH:mm') : '—'}
                      {' → '}
                      {exitE ? format(parseISO(exitE.recorded_at), 'HH:mm') : '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    {total
                      ? <span className="text-sm font-bold text-foreground">{total}</span>
                      : <span className="text-xs text-muted-foreground">em aberto</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
      )}
    </div>
  );
}
