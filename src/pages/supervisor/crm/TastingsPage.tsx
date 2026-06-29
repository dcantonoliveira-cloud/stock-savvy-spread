import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Plus, CalendarDays, AlertTriangle, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { X } from 'lucide-react';

const TIPOS = ['Jantar', 'Almoço'];

type ActiveTab = 'degustacoes' | 'aberto' | 'segunda';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Session {
  id: string;
  scheduled_date: string;
  type: string | null;
  max_couples: number | null;
  notes: string | null;
  created_at: string;
}

interface SessionStats {
  session_id: string;
  total: number;
  novos: number;
  em_aberto: number;
  fechados: number;
  guests: number;
  total_pago: number;
}

interface AbertoRow {
  event_id: string;
  event_name: string;
  event_date: string;
  status: string;
  assessor: string | null;
  budget_note: string | null;
  last_tasting_date: string | null;
}

interface SegundaRow {
  event_id: string;
  event_name: string;
  event_date: string;
  status: string;
  assessor: string | null;
  location_text: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${String(y).slice(2)}`;
};

const fmtMoney = (v: number) =>
  v === 0 ? null : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const STATUS_OPTIONS = [
  { value: 'lead',              label: '1º Contato',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'negotiating',       label: 'Negociando',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'tasting_scheduled', label: 'Deg. Agendada', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'confirmed',         label: 'Confirmado',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'cancelled',         label: 'Cancelado',     color: 'bg-red-100 text-red-700 border-red-200' },
];

function getStatus(value: string) {
  return STATUS_OPTIONS.find(s => s.value === value) ?? { label: value, color: 'bg-muted text-muted-foreground border-border' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TastingsPage() {
  const navigate = useNavigate();
  const [tab,            setTab]           = useState<ActiveTab>('degustacoes');
  const [sessions,       setSessions]      = useState<Session[]>([]);
  const [statsMap,       setStatsMap]      = useState<Record<string, SessionStats>>({});
  const [loading,        setLoading]       = useState(true);
  const [visibleCount,   setVisibleCount]  = useState(15);
  const [newOpen,        setNewOpen]       = useState(false);
  const [showSegunda,    setShowSegunda]   = useState(false);
  const [abertoRows,     setAbertoRows]    = useState<AbertoRow[]>([]);
  const [abertoLoading,  setAbertoLoading] = useState(false);
  const [segundaRows,    setSegundaRows]   = useState<SegundaRow[]>([]);
  const [segundaLoading, setSegundaLoading]= useState(false);

  // ── Load sessions + feature flags ──────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    const [{ data: sess }, { data: stats }, { data: company }] = await Promise.all([
      supabase.from('tasting_sessions' as any).select('id, scheduled_date, type, max_couples, created_at').order('scheduled_date', { ascending: false }),
      supabase.from('tasting_session_stats' as any).select('*'),
      supabase.from('companies').select('features').limit(1).single(),
    ]);
    setSessions((sess ?? []) as Session[]);
    const map: Record<string, SessionStats> = {};
    for (const r of (stats ?? []) as SessionStats[]) map[r.session_id] = r;
    setStatsMap(map);
    setShowSegunda(!!(company as any)?.features?.segunda_degustacao);
    setLoading(false);
  };

  // ── Load "Lista em aberto" ─────────────────────────────────────────────────
  const loadAberto = async () => {
    setAbertoLoading(true);
    // Get all event_ids + their most recent tasting date
    const { data: tse } = await supabase
      .from('tasting_session_events' as any)
      .select('event_id, tasting_sessions(scheduled_date)');

    if (!tse || tse.length === 0) { setAbertoRows([]); setAbertoLoading(false); return; }

    // Build map: event_id → latest tasting date
    const tastingDateMap: Record<string, string> = {};
    for (const row of tse as any[]) {
      if (!row.event_id) continue;
      const d = (row.tasting_sessions as any)?.scheduled_date;
      if (!d) continue;
      if (!tastingDateMap[row.event_id] || d > tastingDateMap[row.event_id])
        tastingDateMap[row.event_id] = d;
    }

    const eventIds = Object.keys(tastingDateMap);
    if (eventIds.length === 0) { setAbertoRows([]); setAbertoLoading(false); return; }

    const { data: evts, error } = await supabase
      .from('events')
      .select('id, event_name, event_date, status, budget_note, clients(name)')
      .in('id', eventIds)
      .in('status', ['lead', 'negotiating', 'tasting_scheduled'])
      .order('event_date', { ascending: true });

    if (error) console.error('[aberto]', error);

    setAbertoRows((evts ?? []).map((e: any) => ({
      event_id:          e.id,
      event_name:        e.event_name,
      event_date:        e.event_date,
      status:            e.status,
      assessor:          e.clients?.name ?? null,
      budget_note:       e.budget_note ?? null,
      last_tasting_date: tastingDateMap[e.id] ?? null,
    })));
    setAbertoLoading(false);
  };

  // ── Load "2ª Degustação" ───────────────────────────────────────────────────
  const loadSegunda = async () => {
    setSegundaLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const { data: tse } = await supabase
      .from('tasting_session_events' as any)
      .select('event_id');

    const eventIds = [...new Set((tse ?? []).map((r: any) => r.event_id).filter(Boolean))];
    if (eventIds.length === 0) { setSegundaRows([]); setSegundaLoading(false); return; }

    const { data: evts, error } = await supabase
      .from('events')
      .select('id, event_name, event_date, status, location_text, clients(name)')
      .in('id', eventIds)
      .in('status', ['lead', 'negotiating', 'tasting_scheduled'])
      .gte('event_date', today)
      .order('event_date', { ascending: true });

    if (error) console.error('[segunda]', error);

    setSegundaRows((evts ?? []).map((e: any) => ({
      event_id:      e.id,
      event_name:    e.event_name,
      event_date:    e.event_date,
      status:        e.status,
      assessor:      e.clients?.name ?? null,
      location_text: e.location_text ?? null,
    })));
    setSegundaLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'aberto')  loadAberto();  }, [tab]);
  useEffect(() => { if (tab === 'segunda') loadSegunda(); }, [tab]);

  // ── Sessions helpers ───────────────────────────────────────────────────────
  const now        = new Date().toISOString().split('T')[0];
  const allSorted  = [...sessions].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  const upcoming   = allSorted.filter(s => s.scheduled_date >= now);
  const past       = allSorted.filter(s => s.scheduled_date < now);
  const visiblePast = past.slice(0, Math.max(0, visibleCount - upcoming.length));

  const cols = 'grid-cols-[140px_90px_1fr_1fr_1fr_1fr_1fr_1fr_1fr]';

  const TableHeader = () => (
    <div className={`px-5 py-2.5 grid ${cols} gap-3 bg-muted/30`}>
      {['Data','Tipo','Eventos','Novos','Contratos fechados','Em aberto','Convidados','Conversão','Total pago'].map((h, i) => (
        <span key={h} className={`text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 text-center ${i <= 1 ? 'text-left' : ''} ${i === 7 ? 'border-l border-border pl-3' : ''}`}>{h}</span>
      ))}
    </div>
  );

  const SessionRow = ({ s, past: isPast }: { s: Session; past?: boolean }) => {
    const st       = statsMap[s.id];
    const total    = st?.total    ?? 0;
    const novos    = st?.novos    ?? 0;
    const fechados = st?.fechados ?? 0;
    const emAberto = st?.em_aberto ?? 0;
    const guests   = st?.guests   ?? 0;
    const totalPago= st?.total_pago ?? 0;
    const conv     = novos > 0 ? Math.round((fechados / novos) * 100) : null;
    const money    = fmtMoney(totalPago);
    const muted    = !!isPast;
    return (
      <div onClick={() => navigate(`/tastings/${s.id}`)}
        className={`px-5 ${isPast ? 'py-2' : 'py-2.5'} grid ${cols} gap-3 items-center hover:bg-slate-50 cursor-pointer transition-colors`}>
        <span className={`text-sm tabular-nums ${isPast ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>{fmtDate(s.scheduled_date)}</span>
        <span className={`text-sm ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>{s.type ?? '—'}</span>
        <Cell v={total}    bold muted={muted} />
        <Cell v={novos}         muted={muted} />
        <Cell v={fechados}      muted={muted} />
        <Cell v={emAberto > 0 ? emAberto : null} danger={emAberto > 0} muted={muted} />
        <Cell v={guests > 0 ? guests : null} muted={muted} />
        <div className="text-center border-l border-border/50 pl-3">
          {isPast && conv !== null
            ? <span className={`text-sm font-medium ${conv >= 50 ? 'text-emerald-600' : conv > 0 ? 'text-amber-500' : 'text-muted-foreground/60'}`}>{conv}%</span>
            : <span className="text-muted-foreground/25 text-sm">—</span>}
        </div>
        <div className="text-center">
          {money
            ? <span className={`text-sm tabular-nums ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>{money}</span>
            : <span className="text-muted-foreground/25 text-sm">—</span>}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header row */}
      <div className="mb-5 flex items-center justify-between gap-6">
        <div className="flex items-center gap-1 border-b border-border">
          <TabBtn active={tab === 'degustacoes'} onClick={() => setTab('degustacoes')}>Degustações</TabBtn>
          <TabBtn active={tab === 'aberto'}      onClick={() => setTab('aberto')}>Lista em aberto</TabBtn>
          {showSegunda && (
            <TabBtn active={tab === 'segunda'} onClick={() => setTab('segunda')}>2ª Degustação</TabBtn>
          )}
        </div>
        <button onClick={() => setNewOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Nova degustação
        </button>
      </div>

      {/* ── Degustações ──────────────────────────────────────────────────── */}
      {tab === 'degustacoes' && (
        <>
          <p className="text-sm text-muted-foreground mb-5">
            Sessões de degustação são o principal canal de conversão do Rondello. Acompanhe quantos casais novos participam, quantos fecham contrato e quanto já foi pago em cada sessão.
          </p>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-5">
            <CalendarDays className="w-4 h-4" />
            <span>{allSorted.length} sessões · {upcoming.length} agendadas</span>
          </div>

          {loading ? (
            <div className="bg-white border border-border rounded-2xl py-16 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : allSorted.length === 0 ? (
            <div className="bg-white border border-border rounded-2xl py-16 text-center text-muted-foreground text-sm">Nenhuma degustação cadastrada.</div>
          ) : (
            <div className="space-y-4">
              {upcoming.length > 0 && (
                <div className="bg-white border-2 border-primary/20 rounded-2xl overflow-hidden">
                  <div className="px-5 py-2 bg-primary/5 border-b border-primary/15 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary/70">Próximas sessões</span>
                    <span className="ml-auto text-xs text-primary/50">{upcoming.length} agendada{upcoming.length > 1 ? 's' : ''}</span>
                  </div>
                  <TableHeader />
                  <div className="divide-y divide-border/50">
                    {upcoming.map(s => <SessionRow key={s.id} s={s} />)}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <div className="bg-white border border-border rounded-2xl overflow-hidden mt-8">
                  <div className="px-5 py-2 bg-muted/20 border-b border-border/60 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">Histórico</span>
                    <span className="ml-auto text-xs text-muted-foreground/40">{past.length} sessão{past.length > 1 ? 'ões' : ''}</span>
                  </div>
                  <TableHeader />
                  <div className="divide-y divide-border/40">
                    {visiblePast.map(s => <SessionRow key={s.id} s={s} past />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {past.length > 15 && (
            <div className="flex items-center gap-3 mt-3 justify-center">
              {visibleCount < past.length + upcoming.length && (
                <button onClick={() => setVisibleCount(v => v + 15)}
                  className="px-4 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
                  Mostrar mais sessões
                </button>
              )}
              {visibleCount > 15 && (
                <button onClick={() => setVisibleCount(15)}
                  className="px-4 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
                  Mostrar menos
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Lista em aberto ──────────────────────────────────────────────── */}
      {tab === 'aberto' && (
        <ListaAbertoTab
          rows={abertoRows}
          loading={abertoLoading}
          onNavigate={id => navigate(`/events/${id}`)}
          onStatusChange={(id, status) => {
            setAbertoRows(prev => prev.map(r => r.event_id === id ? { ...r, status } : r));
            supabase.from('events').update({ status }).eq('id', id).then(({ error }) => {
              if (error) toast.error('Erro ao atualizar status');
            });
          }}
          onNoteChange={(id, note) => {
            setAbertoRows(prev => prev.map(r => r.event_id === id ? { ...r, budget_note: note } : r));
            supabase.from('events').update({ budget_note: note } as any).eq('id', id).then(({ error }) => {
              if (error) toast.error('Erro ao salvar');
            });
          }}
        />
      )}

      {/* ── 2ª Degustação ────────────────────────────────────────────────── */}
      {tab === 'segunda' && (
        <SegundaTab rows={segundaRows} loading={segundaLoading} onNavigate={id => navigate(`/events/${id}`)} />
      )}

      {newOpen && (
        <NewSessionModal
          onClose={() => setNewOpen(false)}
          onCreated={(s) => { setSessions(prev => [s, ...prev]); setNewOpen(false); navigate(`/tastings/${s.id}`); }}
        />
      )}
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}>
      {children}
    </button>
  );
}

// ─── Status badge com dropdown ────────────────────────────────────────────────
function StatusBadge({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLButtonElement>(null);
  const s = getStatus(value);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
    setOpen(o => !o);
  };

  return (
    <>
      <button ref={ref} onClick={handleClick}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${s.color}`}>
        {s.label}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[150px]"
            style={{ top: pos.top, left: pos.left }}>
            {STATUS_OPTIONS.map(opt => (
              <button key={opt.value} onClick={(e) => { e.stopPropagation(); onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${value === opt.value ? 'font-semibold' : ''}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// ─── Note inline editor ───────────────────────────────────────────────────────
function NoteCell({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (text !== (value ?? '')) onSave(text);
  };

  if (editing) {
    return (
      <input ref={inputRef} value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setText(value ?? ''); setEditing(false); } }}
        className="w-full text-sm border-0 border-b border-primary bg-transparent outline-none py-0.5 text-foreground"
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <span onClick={e => { e.stopPropagation(); setEditing(true); }}
      title={text || 'Clique para adicionar anotação'}
      className={`text-sm truncate cursor-text block ${text ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/30 italic hover:text-muted-foreground/60'} transition-colors`}>
      {text || 'Adicionar anotação…'}
    </span>
  );
}

// ─── Lista em aberto tab ──────────────────────────────────────────────────────
function ListaAbertoTab({ rows, loading, onNavigate, onStatusChange, onNoteChange }: {
  rows: AbertoRow[];
  loading: boolean;
  onNavigate: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onNoteChange: (id: string, note: string) => void;
}) {
  if (loading) return <div className="bg-white border border-border rounded-2xl py-16 text-center text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Lista de todos os casais que fizeram degustação e ainda estão com o status em aberto.
      </p>
      {rows.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl py-16 text-center text-muted-foreground text-sm">
          Nenhum evento em aberto com degustação realizada.
        </div>
      ) : (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_160px_150px_120px_110px_1fr] gap-3 px-5 py-2.5 bg-muted/30 border-b border-border">
            {['Evento', 'Assessor(a)', 'Status', 'Data do evento', 'Degustação', 'Atividade'].map(h => (
              <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-border/50">
            {rows.map(row => (
              <div key={row.event_id}
                className="grid grid-cols-[1fr_160px_150px_120px_110px_1fr] gap-3 px-5 py-3 items-center hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => onNavigate(row.event_id)}>
                <span className="text-sm font-medium text-foreground truncate">{row.event_name ?? '—'}</span>
                <span className="text-sm text-muted-foreground truncate">{row.assessor ?? '—'}</span>
                <div onClick={e => e.stopPropagation()}>
                  <StatusBadge value={row.status} onChange={v => onStatusChange(row.event_id, v)} />
                </div>
                <span className="text-sm tabular-nums text-foreground">{fmtDate(row.event_date)}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{fmtDate(row.last_tasting_date)}</span>
                <NoteCell value={row.budget_note} onSave={note => onNoteChange(row.event_id, note)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Urgency helpers ──────────────────────────────────────────────────────────
function urgency(eventDate: string) {
  const days = Math.ceil((new Date(eventDate).getTime() - Date.now()) / 86_400_000);
  if (days > 90) return null;
  if (days > 60) return { label: 'Baixa', days, color: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: CheckCircle2 };
  if (days > 30) return { label: 'Média', days, color: 'text-amber-700 bg-amber-50 border-amber-200',   Icon: AlertCircle   };
  return           { label: 'Alta',  days, color: 'text-red-700 bg-red-50 border-red-200',         Icon: AlertTriangle };
}

// ─── 2ª Degustação tab ────────────────────────────────────────────────────────
function SegundaTab({ rows, loading, onNavigate }: {
  rows: SegundaRow[];
  loading: boolean;
  onNavigate: (id: string) => void;
}) {
  if (loading) return <div className="bg-white border border-border rounded-2xl py-16 text-center text-muted-foreground text-sm">Carregando...</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Eventos que já participaram de uma degustação mas ainda estão com orçamento em aberto. Agende a segunda degustação para aumentar as chances de conversão.
      </p>
      {rows.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl py-16 text-center text-muted-foreground text-sm">
          Nenhum evento pendente para segunda degustação.
        </div>
      ) : (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_180px_140px_120px_110px] gap-3 px-5 py-2.5 bg-muted/30 border-b border-border">
            {['Evento', 'Assessor(a)', 'Local', 'Data do evento', 'Urgência'].map(h => (
              <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-border/50">
            {rows.map(row => {
              const u = urgency(row.event_date);
              return (
                <div key={row.event_id}
                  onClick={() => onNavigate(row.event_id)}
                  className="grid grid-cols-[1fr_180px_140px_120px_110px] gap-3 px-5 py-3 items-center hover:bg-slate-50 cursor-pointer transition-colors">
                  <span className="text-sm font-medium text-foreground truncate">{row.event_name ?? '—'}</span>
                  <span className="text-sm text-muted-foreground truncate">{row.assessor ?? '—'}</span>
                  <span className="text-sm text-muted-foreground truncate">{row.location_text ?? '—'}</span>
                  <div>
                    <span className="text-sm tabular-nums text-foreground">{fmtDate(row.event_date)}</span>
                    {u && <span className="ml-1.5 text-xs text-muted-foreground/50">{u.days}d</span>}
                  </div>
                  <div>
                    {u ? (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${u.color}`}>
                        <u.Icon className="w-3 h-3" />
                        {u.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">+90 dias</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Cell ──────────────────────────────────────────────────────────────
function Cell({ v, bold, danger, muted }: { v: number | null | undefined; bold?: boolean; danger?: boolean; muted?: boolean }) {
  return (
    <div className="text-center">
      {v != null && v > 0
        ? <span className={`text-sm ${bold ? 'font-semibold' : ''} ${danger ? 'text-red-500 font-semibold' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>{v}</span>
        : <span className="text-muted-foreground/25 text-sm">—</span>}
    </div>
  );
}

// ─── New Session Modal ────────────────────────────────────────────────────────
function NewSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Session) => void }) {
  const [date,   setDate]   = useState('');
  const [type,   setType]   = useState('Jantar');
  const [maxC,   setMaxC]   = useState('4');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!date) { toast.error('Informe a data'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('tasting_sessions' as any)
      .insert({ scheduled_date: date, type, max_couples: parseInt(maxC) || 4 })
      .select().single();
    if (error) { toast.error('Erro ao criar'); setSaving(false); return; }
    toast.success('Degustação criada');
    onCreated(data as Session);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Nova degustação</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Tipo</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20">
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Limite de casais</label>
            <input type="number" value={maxC} onChange={e => setMaxC(e.target.value)} min={1}
              className="w-full h-10 px-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? 'Criando...' : 'Criar degustação'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
