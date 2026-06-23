import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, CalendarDays, Users, CheckCircle2, Clock, Loader2 } from 'lucide-react';

type Tasting = {
  id: string;
  event_id: string;
  client_id: string;
  scheduled_date: string;
  guest_count: number | null;
  confirmed: boolean | null;
  status: string | null;
  menu_notes: string | null;
  feedback: string | null;
  created_at: string;
  clients: { name: string } | null;
  events: { event_name: string } | null;
};

export default function TastingsPage() {
  const [tastings, setTastings] = useState<Tasting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('tastings')
        .select('*, clients(name), events(event_name)')
        .order('scheduled_date', { ascending: false });
      if (data) setTastings(data as Tasting[]);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = tastings.filter((t) => {
    const q = search.toLowerCase();
    return (
      (t.clients?.name ?? '').toLowerCase().includes(q) ||
      (t.events?.event_name ?? '').toLowerCase().includes(q) ||
      (t.menu_notes ?? '').toLowerCase().includes(q)
    );
  });

  const total = tastings.length;
  const confirmed = tastings.filter((t) => t.confirmed === true).length;
  const pending = tastings.filter((t) => t.confirmed === false || t.confirmed === null).length;
  const now = new Date();
  const thisMonth = tastings.filter((t) => {
    const d = new Date(t.scheduled_date + 'T12:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Degustações</h1>
          <p className="text-sm text-muted-foreground">{total} degustação{total !== 1 ? 'ões' : ''} registrada{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por cliente, evento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-8 w-8 text-primary opacity-80" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 opacity-80" />
              <div>
                <p className="text-xs text-muted-foreground">Confirmadas</p>
                <p className="text-2xl font-bold text-emerald-600">{confirmed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-500 opacity-80" />
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-amber-500">{pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary opacity-80" />
              <div>
                <p className="text-xs text-muted-foreground">Este mês</p>
                <p className="text-2xl font-bold text-primary">{thisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary">Lista de Degustações</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{search ? 'Nenhuma degustação encontrada.' : 'Nenhuma degustação cadastrada ainda.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-start justify-between gap-3 p-4 rounded-xl border border-border bg-white hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-primary truncate">
                        {t.clients?.name ?? '—'}
                      </span>
                      <span className="text-muted-foreground text-xs">•</span>
                      <span className="text-sm text-muted-foreground truncate">
                        {t.events?.event_name ?? '—'}
                      </span>
                    </div>
                    {t.menu_notes && (
                      <p className="text-xs text-muted-foreground">
                        {t.menu_notes.length > 60 ? t.menu_notes.slice(0, 60) + '…' : t.menu_notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {t.guest_count !== null && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {t.guest_count}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(t.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </div>
                    <Badge
                      className={
                        t.confirmed
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100'
                      }
                      variant="outline"
                    >
                      {t.confirmed ? 'Confirmada' : 'Pendente'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
