import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, X, Check, ExternalLink, ChevronLeft, Merge, Pencil, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getStatus } from '@/lib/eventStatus';

interface Assessora {
  id: string;
  name: string;
  notes?: string | null;
  created_at: string;
}

interface EventoRow {
  id: string;
  event_name: string | null;
  status: string | null;
  event_date: string | null;
  event_type: string | null;
  guest_count: number | null;
  total_value: number | null;
  contract_signed_date: string | null;
  location_text: string | null;
}

const fmtDate = (d: string | null) =>
  d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—';

const fmBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

type ModalTab = 'eventos' | 'editar';

function AssessoraModal({
  assessora,
  allAssessoras,
  onClose,
  onRefresh,
}: {
  assessora: Assessora;
  allAssessoras: Assessora[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ModalTab>('eventos');
  const [eventos, setEventos] = useState<EventoRow[]>([]);
  const [loadingEvt, setLoadingEvt] = useState(true);

  const [editName, setEditName] = useState(assessora.name);
  const [editNotes, setEditNotes] = useState(assessora.notes ?? '');
  const [saving, setSaving] = useState(false);

  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [merging, setMerging] = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingEvt(true);
      const { data, error } = await supabase
        .from('events' as any)
        .select('id, event_name, status, event_date, event_type, guest_count, total_value, contract_signed_date, location_text')
        .or(`organizer_id.eq.${assessora.id},organizer.eq.${assessora.name}`)
        .order('event_date', { ascending: false });
      if (error) toast.error('Erro ao carregar eventos: ' + error.message);
      const raw = (data ?? []) as EventoRow[];
      const confirmed = new Set(['confirmed', 'completed']);
      raw.sort((a, b) => {
        const aConf = confirmed.has(a.status ?? '');
        const bConf = confirmed.has(b.status ?? '');
        if (aConf !== bConf) return aConf ? -1 : 1;
        return (b.event_date ?? '').localeCompare(a.event_date ?? '');
      });
      setEventos(raw);
      setLoadingEvt(false);
    };
    load();
  }, [assessora.id, assessora.name]);

  const saveEdit = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    const newName = editName.trim();
    const oldName = assessora.name;

    const { error: supErr } = await supabase
      .from('suppliers' as any)
      .update({ name: newName, notes: editNotes || null })
      .eq('id', assessora.id);

    if (supErr) { toast.error('Erro: ' + supErr.message); setSaving(false); return; }

    if (newName !== oldName) {
      await supabase.from('events' as any)
        .update({ organizer: newName })
        .eq('organizer', oldName);
    }

    toast.success('Assessora atualizada!');
    setSaving(false);
    onRefresh();
    onClose();
  };

  const mergeTargetObj = allAssessoras.find(a => a.id === mergeTarget);

  const doMerge = async () => {
    if (!mergeTarget || !mergeTargetObj) return;
    setMerging(true);

    const survivorId   = mergeTarget;
    const survivorName = mergeTargetObj.name;
    const deadId       = assessora.id;
    const deadName     = assessora.name;

    const steps = [
      supabase.from('events' as any)
        .update({ organizer_id: survivorId, organizer: survivorName })
        .eq('organizer_id', deadId),
      supabase.from('events' as any)
        .update({ organizer: survivorName })
        .eq('organizer', deadName),
    ];

    const results = await Promise.all(steps);
    const errs = results.map(r => r.error).filter(Boolean);
    if (errs.length) {
      toast.error('Erro durante merge: ' + errs[0]!.message);
      setMerging(false);
      return;
    }

    const { error: delErr } = await supabase
      .from('suppliers' as any)
      .delete()
      .eq('id', deadId);

    if (delErr) {
      toast.error('Erro ao remover: ' + delErr.message);
      setMerging(false);
      return;
    }

    toast.success(`"${deadName}" mesclada em "${survivorName}" com sucesso!`);
    setMerging(false);
    onRefresh();
    onClose();
  };

  const mergeOptions = allAssessoras.filter(a => a.id !== assessora.id);

  const totalReceita = eventos.reduce((s, e) => s + (e.total_value ?? 0), 0);
  const fechados = eventos.filter(e => e.status === 'confirmed' || e.status === 'completed').length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 860, maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">
                {(assessora.name ?? '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{assessora.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {eventos.length} eventos · {fechados} fechados · {totalReceita > 0 ? fmBRL(totalReceita) : 'sem receita'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 px-5 gap-1">
          {(['eventos', 'editar'] as ModalTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'eventos' ? `Eventos (${eventos.length})` : 'Editar'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {/* ── Tab Eventos ── */}
          {tab === 'eventos' && (
            loadingEvt ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Carregando eventos…</div>
            ) : eventos.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Nenhum evento encontrado.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/20 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    <th className="px-4 py-2.5 text-left w-[100px]">Data</th>
                    <th className="px-4 py-2.5 text-left">Nome</th>
                    <th className="px-3 py-2.5 text-center w-[90px]">Tipo</th>
                    <th className="px-3 py-2.5 text-center w-[50px]">Pax</th>
                    <th className="px-3 py-2.5 text-center w-[80px]">Status</th>
                    <th className="px-3 py-2.5 text-right w-[100px]">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {eventos.map(e => {
                    const st = getStatus(e.status ?? '');
                    return (
                      <tr key={e.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDate(e.event_date)}</td>
                        <td className="px-4 py-2.5 font-medium text-foreground">{e.event_name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{e.event_type ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center text-muted-foreground">{e.guest_count ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-semibold text-foreground">
                          {e.total_value != null ? fmBRL(e.total_value) : '—'}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <button
                            onClick={() => navigate(`/events/${e.id}`, { state: { backTo: '/cadastros/assessores', backLabel: 'Assessoras' } })}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                            title="Abrir evento"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20 font-semibold text-xs">
                    <td colSpan={5} className="px-4 py-2.5 text-foreground">{eventos.length} eventos</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{totalReceita > 0 ? fmBRL(totalReceita) : '—'}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )
          )}

          {/* ── Tab Editar ── */}
          {tab === 'editar' && (
            <div className="p-5 flex flex-col gap-6 max-w-lg">
              {/* Nome */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">
                  Nome
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">
                  Observações
                </label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Notas internas sobre esta assessora..."
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              <button
                onClick={saveEdit}
                disabled={saving || !editName.trim()}
                className="flex items-center gap-2 h-10 px-5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors w-fit"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>

              {/* Divider */}
              <div className="border-t border-border pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <Merge className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold text-foreground">Mesclar com outra assessora</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Todos os eventos de <strong>{assessora.name}</strong> serão transferidos para a assessora selecionada.
                  O registro atual será removido permanentemente.
                </p>

                <select
                  value={mergeTarget}
                  onChange={e => { setMergeTarget(e.target.value); setConfirmMerge(false); }}
                  className="w-full h-10 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white mb-3"
                >
                  <option value="">Selecionar assessora de destino…</option>
                  {mergeOptions.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>

                {mergeTarget && mergeTargetObj && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">
                        <p className="font-semibold mb-1">Confirmar mesclagem?</p>
                        <p>
                          <strong>{eventos.length} eventos</strong> de <em>{assessora.name}</em> serão
                          transferidos para <em>{mergeTargetObj.name}</em>.
                          Esta ação não pode ser desfeita.
                        </p>
                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmMerge}
                            onChange={e => setConfirmMerge(e.target.checked)}
                            className="accent-amber-600"
                          />
                          Entendi, quero mesclar
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={doMerge}
                  disabled={!mergeTarget || !confirmMerge || merging}
                  className="flex items-center gap-2 h-10 px-5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors w-fit"
                >
                  <Merge className="w-4 h-4" />
                  {merging ? 'Mesclando…' : 'Mesclar agora'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssessoresPage() {
  const [rows, setRows] = useState<Assessora[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Assessora | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers' as any)
      .select('id, name, notes, created_at')
      .eq('type', 'organizer')
      .order('name');
    if (error) toast.error('Erro: ' + error.message);
    setRows((data ?? []) as Assessora[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const add = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase
      .from('suppliers' as any)
      .insert({ name: newName.trim(), type: 'organizer' });
    if (error) { toast.error('Erro: ' + error.message); return; }
    setNewName('');
    setAdding(false);
    toast.success('Assessora adicionada!');
    load();
  };

  const fmtDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar assessoras…"
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
        <button
          onClick={() => { setAdding(true); setNewName(''); }}
          className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <div className="bg-white border border-border rounded-xl px-4 py-2.5">
          <p className="text-[11px] text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{rows.length}</p>
        </div>
        {search && (
          <div className="bg-white border border-border rounded-xl px-4 py-2.5">
            <p className="text-[11px] text-muted-foreground">Filtradas</p>
            <p className="text-lg font-bold text-primary">{filtered.length}</p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left w-8">#</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left">NOME</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left w-32">CADASTRADO EM</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="border-b border-border/50 bg-primary/5">
                <td className="px-4 py-2 text-muted-foreground text-xs">{rows.length + 1}</td>
                <td className="px-4 py-2">
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }}
                    placeholder="Nome da assessora…"
                    className="w-full h-8 px-3 text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </td>
                <td className="px-4 py-2 text-muted-foreground text-xs">Hoje</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={add} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setAdding(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-4 py-3"><div className="h-3 w-4 bg-muted/40 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 bg-muted/40 rounded animate-pulse" style={{ width: `${40 + (i * 13) % 40}%` }} /></td>
                  <td className="px-4 py-3"><div className="h-3 w-16 bg-muted/40 rounded animate-pulse" /></td>
                  <td />
                </tr>
              ))
            ) : filtered.length === 0 && !adding ? (
              <tr>
                <td colSpan={4} className="py-20 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma assessora encontrada.</p>
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr
                  key={row.id}
                  className="border-b border-border/50 hover:bg-muted/30 group transition-colors cursor-pointer"
                  onClick={() => setSelected(row)}
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-primary">{row.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="font-medium text-foreground">{row.name}</span>
                      {row.notes && (
                        <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full truncate max-w-[160px]">
                          {row.notes}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(row.created_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <AssessoraModal
          assessora={selected}
          allAssessoras={rows}
          onClose={() => setSelected(null)}
          onRefresh={() => { load(); setSelected(null); }}
        />
      )}
    </div>
  );
}
