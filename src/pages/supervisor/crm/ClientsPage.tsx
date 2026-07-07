import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Search, Loader2, UserX, Smartphone, BarChart2, Clock } from 'lucide-react';

type AccessLog = {
  id: string;
  page: string;
  accessed_at: string;
  event_id: string;
  events?: { event_name: string | null; clients?: { name: string | null } | null } | null;
};

const PAGE_LABELS: Record<string, string> = {
  inicio:      'Início',
  financeiro:  'Financeiro',
  arquivos:    'Arquivos',
  informacoes: 'Informações',
  checklist:   'Checklist',
};

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
  const [clients,  setClients]  = useState<Client[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [tab,      setTab]      = useState<'clientes' | 'acessos'>('clientes');
  const [logs,     setLogs]     = useState<AccessLog[]>([]);
  const [logsLoad, setLogsLoad] = useState(false);

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

  useEffect(() => {
    if (tab !== 'acessos') return;
    setLogsLoad(true);
    (supabase.from as any)('portal_access_logs')
      .select('id, page, pages, accessed_at, accessed_date, event_id, events(event_name, clients(name))')
      .order('accessed_at', { ascending: false })
      .limit(200)
      .then(({ data }: any) => { setLogs(data ?? []); setLogsLoad(false); });
  }, [tab]);

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

  // stats de páginas mais acessadas
  const pageCounts = logs.reduce<Record<string, number>>((acc, l) => {
    const pages: string[] = l.pages?.length ? l.pages : (l.page ? [l.page] : []);
    pages.forEach(p => { acc[p] = (acc[p] ?? 0) + 1; });
    return acc;
  }, {});
  const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]);
  const totalAccesses = Object.values(pageCounts).reduce((s, n) => s + n, 0);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-display font-bold text-primary">Clientes</h1>
          <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {clients.length}
          </span>
        </div>
        {tab === 'clientes' && (
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou e-mail..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-5 bg-muted/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('clientes')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'clientes' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Users className="w-3.5 h-3.5" /> Clientes
        </button>
        <button
          onClick={() => setTab('acessos')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'acessos' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Smartphone className="w-3.5 h-3.5" /> Acessos ao app
        </button>
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

      {tab === 'acessos' ? (
        <div className="space-y-5">
          {/* Stats de páginas */}
          {!logsLoad && logs.length > 0 && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {topPages.map(([page, count]) => (
                <Card key={page} className="glass-card">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <BarChart2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{PAGE_LABELS[page] ?? page}</p>
                      <p className="text-xl font-bold text-foreground">{count}</p>
                      <p className="text-[10px] text-muted-foreground">{Math.round(count / totalAccesses * 100)}% dos acessos</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Lista de acessos recentes */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Últimos acessos</span>
              {logs.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{logs.length} registros</span>}
            </div>
            {logsLoad ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : logs.length === 0 ? (
              <div className="py-14 text-center text-sm text-muted-foreground">
                <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Nenhum acesso registrado ainda.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs bg-muted/30">
                    <th className="text-left px-5 py-2.5 font-semibold text-muted-foreground">CLIENTE / EVENTO</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">PÁGINAS VISITADAS</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-muted-foreground">QUANDO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-2.5">
                        <p className="font-medium text-foreground">{(log.events as any)?.clients?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{(log.events as any)?.event_name ?? '—'}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(log.pages?.length ? log.pages : (log.page ? [log.page] : [])).map((p: string) => (
                            <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              <Smartphone className="w-3 h-3" />
                              {PAGE_LABELS[p] ?? p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.accessed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
