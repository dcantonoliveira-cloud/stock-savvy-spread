import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, ChevronDown, Info, Trash2, ChevronsUpDown, ChevronUp } from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface Orcamento {
  id: string;
  event_name: string | null;
  location_text: string | null;
  organizer: string | null;
  event_date: string | null;
  created_at: string | null;
  status: string;
  date_reserved: boolean | null;
  clients: { name: string | null } | null;
}

// ── Status ─────────────────────────────────────────────────────────────────────
const PIPELINE_STATUSES = ['lead', 'negotiating', 'tasting_scheduled'];
const LOST_STATUSES = ['cancelled', 'lost'];

const TODAY = new Date().toISOString().split('T')[0];

const isExpired = (r: Orcamento) =>
  PIPELINE_STATUSES.includes(r.status) && !!r.event_date && r.event_date < TODAY;

import { EVENT_STATUS, getStatus } from '@/lib/eventStatus';
const STATUS_CONFIG = EVENT_STATUS;

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
  const [filter, setFilter]   = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'orcamentos' | 'gerador'>('orcamentos');
  const [showGerador, setShowGerador] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('id, event_name, location_text, organizer, event_date, created_at, status, date_reserved, clients(name)')
      .in('status', [...PIPELINE_STATUSES, 'cancelled'])
      .not('event_name', 'is', null)
      .neq('event_name', '')
      .order('created_at', { ascending: false });
    if (error) console.error('[OrcamentosPage]', error);
    const sorted = (data ?? []).sort((a: any, b: any) => {
      if (!a.event_date && !b.event_date) return 0;
      if (!a.event_date) return 1;
      if (!b.event_date) return -1;
      return b.event_date.localeCompare(a.event_date);
    });
    setRows(sorted as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from('companies').select('features').limit(1).single().then(({ data }) => {
      if ((data as any)?.features?.gerador_orcamentos) setShowGerador(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setIframeToken(data.session?.access_token ?? null);
    });
  }, []);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const updateStatus = async (id: string, status: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    await supabase.from('events').update({ status }).eq('id', id);
  };

  const deleteRow = async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    setConfirmDelete(null);
    await supabase.from('events').delete().eq('id', id);
  };

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === 'all') {
      // Em aberto: pipeline + data futura (ou sem data)
      list = list.filter(r => PIPELINE_STATUSES.includes(r.status) && !isExpired(r));
    } else if (filter === 'lost') {
      list = list.filter(r => LOST_STATUSES.includes(r.status));
    } else if (filter === 'vencidos') {
      list = list.filter(r => isExpired(r));
    } else {
      // Sub-filtros de pipeline também excluem vencidos
      list = list.filter(r => r.status === filter && !isExpired(r));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.event_name ?? '').toLowerCase().includes(q) ||
        (r.location_text ?? '').toLowerCase().includes(q) ||
        (r.organizer ?? '').toLowerCase().includes(q),
      );
    }
    if (sortCol) {
      list = [...list].sort((a, b) => {
        let va: string | number = '';
        let vb: string | number = '';
        if (sortCol === 'event_name')  { va = a.event_name ?? ''; vb = b.event_name ?? ''; }
        if (sortCol === 'location')    { va = a.location_text ?? ''; vb = b.location_text ?? ''; }
        if (sortCol === 'organizer')   { va = a.organizer ?? ''; vb = b.organizer ?? ''; }
        if (sortCol === 'event_date')  { va = a.event_date ?? ''; vb = b.event_date ?? ''; }
        if (sortCol === 'em_aberto')   {
          va = a.created_at ? Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86_400_000) : -1;
          vb = b.created_at ? Math.floor((Date.now() - new Date(b.created_at).getTime()) / 86_400_000) : -1;
        }
        if (sortCol === 'status')      { va = a.status; vb = b.status; }
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [rows, filter, search, sortCol, sortAsc]);

  const countFor = (s: string) => {
    if (s === 'all')      return rows.filter(r => PIPELINE_STATUSES.includes(r.status) && !isExpired(r)).length;
    if (s === 'lost')     return rows.filter(r => LOST_STATUSES.includes(r.status)).length;
    if (s === 'vencidos') return rows.filter(r => isExpired(r)).length;
    return rows.filter(r => r.status === s && !isExpired(r)).length;
  };

  return (
    <div>
      {/* ── Tabs (só aparecem se gerador estiver habilitado) ── */}
      {showGerador && (
        <div className="flex gap-1 mb-5 border-b border-border">
          {(['orcamentos', 'gerador'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'orcamentos' ? 'Orçamentos' : 'Gerador de Orçamentos'}
            </button>
          ))}
        </div>
      )}

      {/* ── Gerador (iframe) ── */}
      {activeTab === 'gerador' && (
        <iframe
          src={iframeToken ? `/orcamento.html?token=${iframeToken}` : '/orcamento.html'}
          className="w-full rounded-2xl border border-border"
          style={{ height: 'calc(100vh - 160px)' }}
          title="Gerador de Orçamentos"
        />
      )}

      {/* ── Lista de orçamentos ── */}
      {activeTab === 'orcamentos' && <>

      {/* ── Descrição ── */}
      <div className="mb-5 p-4 bg-white border border-border rounded-2xl flex gap-3">
        <Info className="w-4 h-4 text-primary/60 shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
          <p>
            <span className="font-semibold text-foreground">Orçamentos</span> reúne eventos em processo comercial.
            <span className="font-medium text-foreground"> Vencidos</span> são orçamentos com data já passada que ainda não tiveram uma definição.
            <span className="font-medium text-foreground"> Não fechado</span> indica que nenhum contrato foi assinado.
          </p>
        </div>
      </div>

      {/* ── Filtros e busca ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 bg-white border border-border rounded-xl p-1">
          {/* Pipeline ativo */}
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

          {/* Vencidos — âmbar */}
          <FilterBtn active={filter === 'vencidos'} onClick={() => setFilter('vencidos')} variant="amber">
            Vencidos <Count n={countFor('vencidos')} />
          </FilterBtn>

          {/* Não fechados — vermelho claro, sem contagem */}
          <FilterBtn active={filter === 'lost'} onClick={() => setFilter('lost')} variant="rose">
            Não fechados
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
          onClick={() => navigate('/events', { state: { openNew: true, backTo: '/orcamentos' } })}
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
              <Th col="event_name"  sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>Evento</Th>
              <Th col="location"    sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>Local</Th>
              <Th col="organizer"   sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>Assessoria</Th>
              <Th col="event_date"  sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>Data do evento</Th>
              <Th col="em_aberto"   sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>Em aberto</Th>
              <Th col="status"      sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort}>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">Nenhum orçamento encontrado.</td></tr>
            ) : filtered.map((row, i) => (
              <tr
                key={row.id}
                onClick={() => navigate(`/orcamentos/${row.id}`)}
                className={`border-b border-border/50 hover:bg-slate-50 transition-colors cursor-pointer ${i === filtered.length - 1 ? 'border-0' : ''}`}
              >
                <Td>
                  <div className="font-medium text-foreground leading-tight">{row.event_name ?? '—'}</div>
                </Td>
                <Td className="text-muted-foreground">{row.location_text || '—'}</Td>
                <Td className="text-muted-foreground">{row.organizer || '—'}</Td>
                <Td className={`tabular-nums ${isExpired(row) ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                  <div className="flex items-center gap-1.5">
                    {fmtDate(row.event_date)}
                    {row.date_reserved && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-600 border border-violet-200 leading-none">
                        Reservado
                      </span>
                    )}
                  </div>
                </Td>
                <Td className="text-muted-foreground tabular-nums">{diasEmAberto(row.created_at)}</Td>
                <Td onClick={e => e.stopPropagation()}>
                  <StatusDropdown status={row.status} onChange={s => updateStatus(row.id, s)} />
                </Td>
                <Td onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setConfirmDelete(row.id)}
                    className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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

      {/* ── Modal de confirmação de exclusão ── */}
      {confirmDelete && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Excluir orçamento</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5 pl-12">
              Essa ação não pode ser desfeita. O orçamento será removido permanentemente.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteRow(confirmDelete)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </>}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Th({ children, col, sortCol, sortAsc, onSort }: {
  children?: React.ReactNode;
  col?: string;
  sortCol?: string | null;
  sortAsc?: boolean;
  onSort?: (col: string) => void;
}) {
  const active = col && sortCol === col;
  return (
    <th
      className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap select-none ${col ? 'cursor-pointer' : ''} ${active ? 'text-primary' : 'text-muted-foreground/60'}`}
      onClick={() => col && onSort?.(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {col && (
          active
            ? <ChevronUp className={`w-3 h-3 transition-transform ${sortAsc ? '' : 'rotate-180'}`} />
            : <ChevronsUpDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

function Td({ children, className = '', onClick }: {
  children?: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void;
}) {
  return <td className={`px-4 py-3 text-sm ${className}`} onClick={onClick}>{children}</td>;
}

function FilterBtn({ active, onClick, children, variant }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'amber' | 'rose';
}) {
  const styles = {
    amber: active ? 'bg-amber-400 text-white' : 'text-amber-600 hover:bg-amber-50',
    rose:  active ? 'bg-rose-400 text-white'  : 'text-rose-400 hover:bg-rose-50',
    default: active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
  };
  const cls = variant ? styles[variant] : styles.default;
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${cls}`}>
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 opacity-60">({n})</span>;
}

const ALL_STATUS_OPTIONS = [
  ...PIPELINE_STATUSES.map(s => ({ key: s, ...STATUS_CONFIG[s] })),
  { key: 'confirmed', label: 'Confirmado', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  { key: 'cancelled', label: 'Não fechou', bg: 'bg-rose-50', text: 'text-rose-500', border: 'border-rose-200' },
  { key: 'lost', label: 'Cancelado', bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
];

function StatusDropdown({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const cfg = getStatus(status);

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const dropH = ALL_STATUS_OPTIONS.length * 36 + 8;
      const below = r.bottom + 4 + dropH < window.innerHeight;
      setPos(below
        ? { top: r.bottom + 4, left: r.left }
        : { top: r.top - dropH - 4, left: r.left });
    }
    setOpen(o => !o);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
      >
        {cfg.label}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[160px]"
               style={{ top: pos.top, left: pos.left }}>
            {ALL_STATUS_OPTIONS.map(o => (
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
        </>,
        document.body
      )}
    </div>
  );
}
