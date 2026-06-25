import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Info, Pencil } from 'lucide-react';
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
  const segundas = evs.filter(e => e.is_second_tasting).length;
  const guests   = evs.reduce((s, e) => s + (e.guest_count ?? 0), 0);
  const emAberto = evs.filter(
    e => e.situation_snapshot === 'new' && e.events && PIPELINE.includes(e.events.status)
  ).length;
  const fechados = evs.filter(
    e => e.situation_snapshot === 'new' && e.events && CLOSED.includes(e.events.status)
  ).length;
  const conv = novos > 0 ? Math.round((fechados / novos) * 100) : null;
  return { total, novos, segundas, guests, emAberto, conv };
}

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${String(y).slice(2)}`;
};

export default function TastingsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions]       = useState<Session[]>([]);
  const [sessionEvts, setSessionEvts] = useState<Record<string, SessionEvent[]>>({});
  const [loading, setLoading]         = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);
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
  const visible = allSorted.slice(0, visibleCount);

  const updateTipo = async (id: string, tipo: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, type: tipo } : s));
    await supabase.from('tasting_sessions' as any).update({ type: tipo }).eq('id', id);
  };

  return (
    <div>
      {/* Descrição */}
      <div className="mb-5 p-4 bg-white border border-border rounded-2xl flex gap-3">
        <Info className="w-4 h-4 text-primary/60 shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground leading-relaxed">
          <p>
            <span className="font-semibold text-foreground">Degustações</span> são sessões onde casais conhecem o buffet.
            A coluna <span className="font-medium text-foreground">Em aberto</span> indica novos clientes que ainda não fecharam contrato.
            <span className="font-medium text-foreground"> Conversão</span> mostra o percentual de novos que confirmaram.
          </p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end mb-4">
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
              <Th center>2ª Deg.</Th>
              <Th center>Convidados</Th>
              <Th center>Em aberto</Th>
              <Th center>Conversão</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-16 text-center text-muted-foreground text-sm">Carregando...</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={8} className="py-16 text-center text-muted-foreground text-sm">Nenhuma degustação cadastrada.</td></tr>
            ) : visible.map((s, i) => {
              const evs  = sessionEvts[s.id] ?? [];
              const st   = sessionStats(evs);
              const past = s.scheduled_date < now;
              const dim  = past ? 'text-muted-foreground/50' : '';
              return (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/tastings/${s.id}`)}
                  className={`border-b border-border/50 hover:bg-slate-50 cursor-pointer transition-colors ${i === visible.length - 1 ? 'border-0' : ''}`}
                >
                  <Td className={`font-medium ${past ? 'text-muted-foreground/60' : 'text-foreground'}`}>{fmtDate(s.scheduled_date)}</Td>
                  <Td>
                    <TipoCell
                      value={s.type}
                      dim={dim}
                      onChange={tipo => updateTipo(s.id, tipo)}
                    />
                  </Td>
                  <Td center className={`font-semibold ${dim}`}>{st.total > 0 ? st.total : <span className="text-muted-foreground/30">0</span>}</Td>
                  <Td center className={dim}>{st.novos > 0 ? st.novos : <span className="text-muted-foreground/30">0</span>}</Td>
                  <Td center className={dim}>{st.segundas > 0 ? st.segundas : <span className="text-muted-foreground/30">0</span>}</Td>
                  <Td center className={dim}>{st.guests > 0 ? st.guests : <span className="text-muted-foreground/30">—</span>}</Td>
                  <Td center className={st.emAberto > 0 ? 'text-red-500 font-semibold' : dim}>{st.emAberto}</Td>
                  <Td center className={dim}>
                    {past && st.conv !== null ? `${st.conv}%` : <span className="text-muted-foreground/30">—</span>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {allSorted.length > 10 && (
        <div className="flex items-center gap-3 mt-3 justify-center">
          {visibleCount < allSorted.length && (
            <button onClick={() => setVisibleCount(v => v + 10)}
              className="px-4 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
              Mostrar mais
            </button>
          )}
          {visibleCount > 10 && (
            <button onClick={() => setVisibleCount(10)}
              className="px-4 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
              Mostrar menos
            </button>
          )}
        </div>
      )}

      {!loading && (
        <p className="text-xs text-muted-foreground mt-3">{allSorted.length} degustação{allSorted.length !== 1 ? 'ões' : ''}</p>
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

function TipoCell({ value, dim, onChange }: { value: string | null; dim: string; onChange: (t: string) => void }) {
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
      <div ref={ref} className={`flex items-center gap-1 group cursor-pointer ${dim}`} onClick={handleClick}>
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

function Th({ children, center }: { children?: React.ReactNode; center?: boolean }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap ${center ? 'text-center' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '', center }: { children?: React.ReactNode; className?: string; center?: boolean }) {
  return <td className={`px-4 py-3 text-sm ${center ? 'text-center' : ''} ${className}`}>{children}</td>;
}
