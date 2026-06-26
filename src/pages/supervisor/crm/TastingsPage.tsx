import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, CalendarDays } from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { X } from 'lucide-react';

const TIPOS = ['Jantar', 'Almoço'];

interface Session {
  id: string;
  scheduled_date: string;
  type: string | null;
  max_couples: number | null;
  menu_text: string | null;
  notes: string | null;
  created_at: string;
}

interface SessionEvent {
  id: string;
  session_id: string;
  event_id: string | null;
  situation_snapshot: string | null;
  guest_count: number | null;
  paid_amount: number | null;
  is_second_tasting: boolean | null;
  events: { status: string } | null;
}

const PIPELINE = ['lead', 'negotiating', 'tasting_scheduled'];
const CLOSED   = ['confirmed', 'completed'];

function sessionStats(evs: SessionEvent[]) {
  const total    = evs.length;
  const novos    = evs.filter(e => e.situation_snapshot === 'new').length;
  const emAberto = evs.filter(e => e.situation_snapshot === 'new' && e.events && PIPELINE.includes(e.events.status)).length;
  const fechados = evs.filter(e => e.situation_snapshot === 'new' && e.events && CLOSED.includes(e.events.status)).length;
  const conv     = novos > 0 ? Math.round((fechados / novos) * 100) : null;
  const totalPago = evs.reduce((s, e) => s + (e.paid_amount ?? 0), 0);
  return { total, novos, emAberto, conv, totalPago };
}

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${String(y).slice(2)}`;
};

const fmtMoney = (v: number) =>
  v === 0 ? null : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function TastingsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions]       = useState<Session[]>([]);
  const [sessionEvts, setSessionEvts] = useState<Record<string, SessionEvent[]>>({});
  const [loading, setLoading]         = useState(true);
  const [visibleCount, setVisibleCount] = useState(15);
  const [newOpen, setNewOpen]         = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: sess } = await supabase
      .from('tasting_sessions' as any)
      .select('*')
      .order('scheduled_date', { ascending: false });

    const { data: evts } = await supabase
      .from('tasting_session_events' as any)
      .select('*, events(status)');

    setSessions((sess ?? []) as Session[]);
    const map: Record<string, SessionEvent[]> = {};
    for (const e of (evts ?? []) as SessionEvent[]) {
      if (!map[e.session_id]) map[e.session_id] = [];
      map[e.session_id].push(e);
    }
    setSessionEvts(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const now = new Date().toISOString().split('T')[0];
  const allSorted = [...sessions].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  const upcoming  = allSorted.filter(s => s.scheduled_date >= now);
  const past      = allSorted.filter(s => s.scheduled_date < now);
  const allOrdered = [...upcoming, ...past];
  const visible = allOrdered.slice(0, visibleCount);

  const updateTipo = async (id: string, tipo: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, type: tipo } : s));
    await supabase.from('tasting_sessions' as any).update({ type: tipo }).eq('id', id);
  };

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <CalendarDays className="w-4 h-4" />
          <span>{allSorted.length} sessões · {upcoming.length} futuras</span>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova degustação
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <Th>Data</Th>
              <Th>Tipo</Th>
              <Th center>Eventos</Th>
              <Th center>Novos</Th>
              <Th center>Em aberto</Th>
              <Th center>Conversão</Th>
              <Th right>Total pago</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">Carregando...</td></tr>
            ) : allSorted.length === 0 ? (
              <tr><td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">Nenhuma degustação cadastrada.</td></tr>
            ) : visible.map((s, i) => {
              const evs   = sessionEvts[s.id] ?? [];
              const st    = sessionStats(evs);
              const isPast = s.scheduled_date < now;
              const isLast = i === visible.length - 1;
              const money  = fmtMoney(st.totalPago);

              return (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/tastings/${s.id}`)}
                  className={`${isLast ? '' : 'border-b border-border/50'} hover:bg-slate-50 cursor-pointer transition-colors ${isPast ? 'opacity-60' : ''}`}
                >
                  <Td>
                    <span className={`font-medium ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {fmtDate(s.scheduled_date)}
                    </span>
                  </Td>
                  <Td>
                    <TipoCell
                      value={s.type}
                      isPast={isPast}
                      onChange={tipo => updateTipo(s.id, tipo)}
                    />
                  </Td>
                  <Td center>
                    {st.total > 0
                      ? <span className="font-semibold text-foreground">{st.total}</span>
                      : <span className="text-muted-foreground/30">—</span>}
                  </Td>
                  <Td center>
                    {st.novos > 0
                      ? <span>{st.novos}</span>
                      : <span className="text-muted-foreground/30">—</span>}
                  </Td>
                  <Td center>
                    {st.emAberto > 0
                      ? <span className="font-semibold text-red-500">{st.emAberto}</span>
                      : <span className="text-muted-foreground/30">—</span>}
                  </Td>
                  <Td center>
                    {isPast && st.conv !== null
                      ? <span className={st.conv > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>{st.conv}%</span>
                      : <span className="text-muted-foreground/30">—</span>}
                  </Td>
                  <Td right>
                    {money
                      ? <span className="text-foreground tabular-nums">{money}</span>
                      : <span className="text-muted-foreground/30">—</span>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {allOrdered.length > 15 && (
        <div className="flex items-center gap-3 mt-3 justify-center">
          {visibleCount < allOrdered.length && (
            <button onClick={() => setVisibleCount(v => v + 15)}
              className="px-4 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
              Mostrar mais
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

      {newOpen && (
        <NewSessionModal
          onClose={() => setNewOpen(false)}
          onCreated={(s) => { setSessions(prev => [s, ...prev]); setNewOpen(false); navigate(`/tastings/${s.id}`); }}
        />
      )}
    </div>
  );
}

function TipoCell({ value, isPast, onChange }: { value: string | null; isPast: boolean; onChange: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
    setOpen(o => !o);
  };

  return (
    <>
      <div ref={ref} className={`flex items-center gap-1 group cursor-pointer ${isPast ? 'text-muted-foreground' : 'text-foreground'}`} onClick={handleClick}>
        <span>{value ?? '—'}</span>
        <Pencil className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
      </div>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[120px]"
            style={{ top: pos.top, left: pos.left }}>
            {TIPOS.map(t => (
              <button key={t} onClick={(e) => { e.stopPropagation(); onChange(t); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${value === t ? 'font-semibold text-primary' : 'text-foreground'}`}>
                {t}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function NewSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Session) => void }) {
  const [date, setDate]      = useState('');
  const [type, setType]      = useState('Jantar');
  const [maxC, setMaxC]      = useState('4');
  const [saving, setSaving]  = useState(false);

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
              <option>Jantar</option>
              <option>Almoço</option>
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

function Th({ children, center, right }: { children?: React.ReactNode; center?: boolean; right?: boolean }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap ${center ? 'text-center' : right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '', center, right }: { children?: React.ReactNode; className?: string; center?: boolean; right?: boolean }) {
  return <td className={`px-4 py-3 text-sm ${center ? 'text-center' : right ? 'text-right' : ''} ${className}`}>{children}</td>;
}
