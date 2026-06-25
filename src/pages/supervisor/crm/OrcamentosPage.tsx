import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, ChevronDown } from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Orcamento {
  id: string;
  event_name: string | null;
  location_text: string | null;
  organizer: string | null;
  event_date: string | null;
  created_at: string | null;
  status: string;
}

// ── Status ─────────────────────────────────────────────────────────────────────
const PIPELINE_STATUSES = ['lead', 'negotiating', 'tasting_scheduled'];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  lead:              { label: '1° Contato', bg: 'bg-sky-50',    text: 'text-sky-700',    border: 'border-sky-200' },
  negotiating:       { label: 'Negociando', bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  tasting_scheduled: { label: 'Degustação', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  cancelled:         { label: 'Cancelado',  bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-200' },
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
};

const diasEmAberto = (created: string | null) => {
  if (!created) return '—';
  const diff = Math.floor((Date.now() - new Date(created).getTime()) / 86_400_000);
  return `${diff}d`;
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
      .select('id, event_name, location_text, organizer, event_date, created_at, status')
      .in('status', [...PIPELINE_STATUSES, 'cancelled'])
      .order('event_date', { ascending: true });
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
    if (filter === 'all') {
      list = list.filter(r => PIPELINE_STATUSES.includes(r.status));
    } else {
      list = list.filter(r => r.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.event_name ?? '').toLowerCase().includes(q) ||
        (r.location_text ?? '').toLowerCase().includes(q) ||
        (r.organizer ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, filter, search]);

  const countFor = (s: string) => s === 'all'
    ? rows.filter(r => PIPELINE_STATUSES.includes(r.status)).length
    : rows.filter(r => r.status === s).length;

  return (
    <div>
      {/* ── Filtros e busca ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 bg-white border border-border rounded-xl p-1">
          <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>
            Em aberto <Count n={countFor('all')} />
          </FilterBtn>
          {PIPELINE_STATUSES.map(s => (
            <FilterBtn key={s} active={filter === s} onClick={() => setFilter(s)}>
              {STATUS_CONFIG[s].label} <Count n={countFor(s)} />
            </FilterBtn>
          ))}
          {/* Divisor */}
          <div className="w-px h-5 bg-border mx-0.5" />
          <FilterBtn active={filter === 'cancelled'} onClick={() => setFilter('cancelled')} danger>
            Cancelados <Count n={countFor('cancelled')} />
          </FilterBtn>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-xl text-sm text-muted-foreground flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <input
            className="bg-transparent outline-none flex-1 text-foreground placeholder:text-muted-foreground"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <button
          onClick={() => navigate('/events')}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo orçamento
        </button>
      </div>

      {/* ── Tabela ── */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <Th>Evento</Th>
              <Th>Local</Th>
              <Th>Assessoria</Th>
              <Th>Data do evento</Th>
              <Th>Em aberto</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-muted-foreground text-sm">
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-muted-foreground text-sm">
                  Nenhum orçamento encontrado.
                </td>
              </tr>
            ) : filtered.map((row, i) => (
              <tr
                key={row.id}
                onClick={() => navigate(`/events/${row.id}`)}
                className={`border-b border-border/50 hover:bg-slate-50 transition-colors cursor-pointer ${i === filtered.length - 1 ? 'border-0' : ''}`}
              >
                <Td>
                  <div className="font-medium text-foreground leading-tight">
                    {row.event_name ?? '—'}
                  </div>
                </Td>
                <Td className="text-muted-foreground">{row.location_text || '—'}</Td>
                <Td className="text-muted-foreground">{row.organizer || '—'}</Td>
                <Td className="text-muted-foreground tabular-nums">{fmtDate(row.event_date)}</Td>
                <Td className="text-muted-foreground tabular-nums">{diasEmAberto(row.created_at)}</Td>
                <Td onClick={e => e.stopPropagation()}>
                  <StatusDropdown status={row.status} onChange={s => updateStatus(row.id, s)} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="text-xs text-muted-foreground mt-3">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
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

function Td({ children, className = '', onClick }: { children?: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  return <td className={`px-4 py-3 text-sm ${className}`} onClick={onClick}>{children}</td>;
}

function FilterBtn({ active, onClick, children, danger }: {
  active: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? danger ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'
          : danger ? 'text-red-500 hover:bg-red-50' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
  const options = status === 'cancelled'
    ? [...PIPELINE_STATUSES.map(s => STATUS_CONFIG[s] ? { key: s, ...STATUS_CONFIG[s] } : null).filter(Boolean), { key: 'cancelled', ...STATUS_CONFIG.cancelled }]
    : [...PIPELINE_STATUSES.map(s => ({ key: s, ...STATUS_CONFIG[s] })), { key: 'cancelled', ...STATUS_CONFIG.cancelled }];

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
            {(options as any[]).map(o => (
              <button
                key={o.key}
                onClick={() => { onChange(o.key); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted transition-colors ${o.key === status ? 'opacity-40' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full ${o.bg.replace('-50', '-400')}`} />
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
