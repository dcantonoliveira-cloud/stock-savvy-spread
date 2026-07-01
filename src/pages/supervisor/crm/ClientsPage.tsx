import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Search, Loader2, UserX } from 'lucide-react';

type EventRow = { id: string; status: string; event_date: string | null; total_value: number | null; event_name: string | null; event_type: string | null };

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  events: EventRow[];
};

import { STATUS_LABELS, STATUS_CLS, ALL_STATUS_KEYS } from '@/lib/eventStatus';
const STATUS_CLASSES: Record<string, string> = Object.fromEntries(ALL_STATUS_KEYS.map(k => [k, STATUS_CLS(k)]));

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function latestEvent(events: EventRow[]): EventRow | null {
  if (!events.length) return null;
  return [...events].sort((a, b) => {
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
  })[0];
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, email, address, notes, created_at, events(id, status, event_date, total_value, event_name, event_type)')
        .order('name');
      setClients((data as Client[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = clients.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  });

  const totalLeads = clients.filter(c => c.events.some(e => e.status === 'lead')).length;
  const totalNeg = clients.filter(c => c.events.some(e => e.status === 'negotiating')).length;
  const totalConf = clients.filter(c => c.events.some(e => e.status === 'confirmed')).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-display font-bold text-primary">Clientes</h1>
          <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {clients.length}
          </span>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Clientes', value: clients.length, color: 'text-primary' },
          { label: 'Leads', value: totalLeads, color: 'text-blue-700' },
          { label: 'Negociando', value: totalNeg, color: 'text-amber-700' },
          { label: 'Confirmados', value: totalConf, color: 'text-green-700' },
        ].map(stat => (
          <Card key={stat.label} className="glass-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs bg-muted/30">
              <th className="text-left px-5 py-2.5 font-semibold text-muted-foreground">CLIENTE</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground hidden md:table-cell">TELEFONE</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground hidden lg:table-cell">E-MAIL</th>
              <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground">EVENTOS</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground hidden md:table-cell">ÚLTIMO EVENTO</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground hidden lg:table-cell">TIPO</th>
              <th className="text-right px-5 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">DATA DO EVENTO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {[40, 15, 20, 20, 8, 12, 10].map((w, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-muted/40 rounded animate-pulse" style={{ width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-muted-foreground">
                  <UserX className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {search ? 'Nenhum cliente encontrado para essa busca.' : 'Nenhum cliente cadastrado.'}
                </td>
              </tr>
            ) : filtered.map(client => {
              const latest = latestEvent(client.events);
              return (
                <tr
                  key={client.id}
                  className="hover:bg-primary/5 transition-colors cursor-pointer"
                  onClick={() => console.log('client', client.id)}
                >
                  <td className="px-5 py-2.5">
                    <span className="font-semibold text-foreground truncate max-w-[200px] block">{client.name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-sm hidden md:table-cell">
                    {client.phone ?? <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-sm hidden lg:table-cell">
                    <span className="truncate max-w-[180px] block">{client.email ?? <span className="opacity-30">—</span>}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {client.events.length > 0 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {client.events.length}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground hidden md:table-cell truncate max-w-[180px]">
                    {latest?.event_name ?? <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground hidden lg:table-cell">
                    {latest?.event_type ?? <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right text-muted-foreground text-sm hidden sm:table-cell">
                    {latest?.event_date ? fmtDate(latest.event_date) : <span className="opacity-30">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
