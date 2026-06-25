import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, ChevronDown, ExternalLink } from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Orcamento {
  id: string;
  event_name: string | null;
  location_text: string | null;
  organizer: string | null;
  event_date: string | null;
  created_at: string | null;
  status: string;
  clients: { name: string | null } | null;
}

// ── Status pipeline (excluir confirmed, completed, cancelled) ──────────────────
const PIPELINE_STATUSES = ['lead', 'negotiating', 'tasting_scheduled'];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  lead:              { label: '1° Contato',  bg: 'bg-sky-50',    text: 'text-sky-700',    border: 'border-sky-200' },
  negotiating:       { label: 'Negociando',  bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  tasting_scheduled: { label: 'Degustação',  bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
};

const diasEmAberto = (created: string | null) => {
  if (!created) return '—';
  const diff = Math.floor((Date.now() - new Date(created).getTime()) / 86_400_000);
  return `${diff} dia${diff !== 1 ? 's' : ''}`;
};

// ── Page ───────────────────────────────────────────────────────────────────────
export default function OrcamentosPage() {
  const navigate = useNavigate();
  const [rows, setRows]       = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<'all' | string>('all');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('id, event_name, location_text, organizer, event_date, created_at, status, clients(name)')
      .in('status', PIPELINE_STATUSES)
      .order('created_at', { ascending: false });
    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    await supabase.from('events').update({ status }).eq('id', id);
  };

  const filtered = useMemo(() => {
    let list = rows;
    if (filter !== 'all') list = list.filter(r => r.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.event_name ?? '').toLowerCase().includes(q) ||
        (r.clients?.name ?? '').toLowerCase().includes(q) ||
        (r.location_text ?? '').toLowerCase().includes(q) ||
        (r.organizer ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, filter, search]);

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pipeline comercial — eventos ainda em negociação</p>
        </div>
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo orçamento
        </button>
      </div>

      {/* ── Filtros e busca ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Status filters */}
        <div className="flex items-center gap-1.5 bg-white border border-border rounded-xl p-1">
          <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>
            Todos <Count n={rows.length} />
          </FilterBtn>
          {PIPELINE_STATUSES.map(s => (
            <FilterBtn key={s} active={filter === s} onClick={() => setFilter(s)}>
              {STATUS_CONFIG[s].label} <Count n={rows.filter(r => r.status === s).length} />
            </FilterBtn>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-xl text-sm text-muted-foreground flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <input
            className="bg-transparent outline-none flex-1 text-foreground placeholder:text-muted-foreground"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <Th>Cliente / Evento</Th>
              <Th>Local</Th>
              <Th>Assessoria</Th>
              <Th>Data do evento</Th>
              <Th>Em aberto</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">
                  Nenhum orçamento encontrado.
                </td>
              </tr>
            ) : filtered.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-border/50 hover:bg-slate-50 transition-colors ${i === filtered.length - 1 ? 'border-0' : ''}`}
              >
                <Td>
                  <div className="font-medium text-foreground leading-tight">
                    {row.event_name ?? '—'}
                  </div>
                  {row.clients?.name && (
                    <div className="text-xs text-muted-foreground mt-0.5">{row.clients.name}</div>
                  )}
                </Td>
                <Td className="text-muted-foreground">{row.location_text || '—'}</Td>
                <Td className="text-muted-foreground">{row.organizer || '—'}</Td>
                <Td className="text-muted-foreground tabular-nums">{fmtDate(row.event_date)}</Td>
                <Td className="text-muted-foreground tabular-nums">{diasEmAberto(row.created_at)}</Td>
                <Td>
                  <StatusDropdown status={row.status} onChange={s => updateStatus(row.id, s)} />
                </Td>
                <Td>
                  <button
                    onClick={() => navigate(`/events/${row.id}`)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Abrir evento"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Contagem */}
      {!loading && (
        <p className="text-xs text-muted-foreground mt-3">
          {filtered.length} orçamento{filtered.length !== 1 ? 's' : ''}
          {filter !== 'all' && ` · ${STATUS_CONFIG[filter]?.label}`}
        </p>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 opacity-60">({n})</span>;
}

function StatusDropdown({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
      >
        {cfg.label}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-7 z-20 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[150px]">
            {PIPELINE_STATUSES.map(s => {
              const c = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => { onChange(s); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted transition-colors ${s === status ? 'opacity-50' : ''}`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.bg.replace('bg-', 'bg-').replace('-50', '-400')}`} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
