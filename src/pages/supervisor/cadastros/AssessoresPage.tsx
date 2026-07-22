import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, X, Check, ExternalLink, Merge, Pencil, AlertTriangle, KeyRound, Send, Copy, CheckCheck, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { getStatus } from '@/lib/eventStatus';
import { sendWhatsApp } from '@/lib/whatsapp';

interface Assessora {
  id: string;
  name: string;
  notes?: string | null;
  phone?: string | null;
  email?: string | null;
  user_id?: string | null;
  must_change_password?: boolean | null;
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
  location_text: string | null;
}

const fmtDate = (d: string | null) =>
  d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—';

const fmBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

type ModalTab = 'eventos' | 'editar' | 'acesso';

function AssessoraModal({
  assessora: initialAssessora,
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
  const [assessora, setAssessora] = useState(initialAssessora);
  const [tab, setTab] = useState<ModalTab>('eventos');
  const [eventos, setEventos] = useState<EventoRow[]>([]);
  const [loadingEvt, setLoadingEvt] = useState(true);

  const [editName, setEditName]   = useState(assessora.name);
  const [editNotes, setEditNotes] = useState(assessora.notes ?? '');
  const [editPhone, setEditPhone] = useState(assessora.phone ?? '');
  const [saving, setSaving]       = useState(false);

  const [mergeTarget, setMergeTarget]   = useState('');
  const [merging, setMerging]           = useState(false);
  const [confirmMerge, setConfirmMerge] = useState(false);

  // Acesso
  const [accessEmail, setAccessEmail]       = useState(assessora.email ?? '');
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [tempPwd, setTempPwd]               = useState('');
  const [copied, setCopied]                 = useState(false);
  const [sendingWpp, setSendingWpp]         = useState(false);

  // Histórico de acessos
  const [accessLogs, setAccessLogs]         = useState<{ id: string; accessed_at: string }[]>([]);
  const [loadingLogs, setLoadingLogs]       = useState(false);

  useEffect(() => {
    if (tab !== 'acesso' || !assessora.id) return;
    setLoadingLogs(true);
    (supabase.from('supplier_access_logs' as any) as any)
      .select('id, accessed_at')
      .eq('supplier_id', assessora.id)
      .order('accessed_at', { ascending: false })
      .limit(50)
      .then(({ data }: { data: any }) => {
        setAccessLogs(data ?? []);
        setLoadingLogs(false);
      });
  }, [tab, assessora.id]);

  useEffect(() => {
    const load = async () => {
      setLoadingEvt(true);
      const { data } = await (supabase.from('events' as any) as any)
        .select('id, event_name, status, event_date, event_type, guest_count, total_value, location_text')
        .or(`organizer_id.eq.${assessora.id},organizer.eq.${assessora.name}`)
        .order('event_date', { ascending: false });
      const confirmed = new Set(['confirmed', 'completed']);
      const raw = (data ?? []) as EventoRow[];
      raw.sort((a, b) => {
        const aC = confirmed.has(a.status ?? ''), bC = confirmed.has(b.status ?? '');
        if (aC !== bC) return aC ? -1 : 1;
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
    const { error } = await (supabase.from('suppliers' as any) as any)
      .update({ name: newName, notes: editNotes || null, phone: editPhone || null })
      .eq('id', assessora.id);
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
    if (newName !== assessora.name) {
      await (supabase.from('events' as any) as any).update({ organizer: newName }).eq('organizer', assessora.name);
    }
    toast.success('Assessora atualizada!');
    setSaving(false);
    onRefresh();
    onClose();
  };

  const callEdgeFunction = async (body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-assessor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  };

  const resetPassword = async () => {
    if (!confirm('Redefinir a senha da assessora? A senha atual deixará de funcionar.')) return;
    setCreatingAccess(true);
    const res = await callEdgeFunction({ action: 'reset_password', supplier_id: assessora.id });
    const json = await res.json();
    setCreatingAccess(false);
    if (!res.ok) { toast.error(json.error ?? 'Erro ao redefinir'); return; }
    setTempPwd(json.temp_password);
    toast.success('Senha redefinida! Envie a nova senha para a assessora.');
  };

  const generateEmail = (name: string) => {
    const slug = name
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join('.');
    return `${slug}@assessora.rondellobuffet.com.br`;
  };

  const createAccess = async () => {
    const email = accessEmail.trim() || generateEmail(assessora.name);
    setCreatingAccess(true);
    const res = await callEdgeFunction({ supplier_id: assessora.id, email, display_name: assessora.name });
    const json = await res.json();
    setCreatingAccess(false);
    if (!res.ok) { toast.error(json.error ?? 'Erro ao criar acesso'); return; }
    setTempPwd(json.temp_password);
    setAssessora(prev => ({ ...prev, user_id: json.user_id, email }));
    await (supabase.from('suppliers' as any) as any).update({ email }).eq('id', assessora.id);
    toast.success('Acesso criado! Compartilhe a senha com a assessora.');
    onRefresh();
  };

  const copyCredentials = async () => {
    const text = await buildWppMessage(tempPwd || '••••••••••');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildWppMessage = async (pwd: string) => {
    const { buildMessage } = await import('@/lib/whatsapp');
    return buildMessage('assessor_invite', {
      assessorName: assessora.name,
      portalUrl: `${window.location.origin}/assessora`,
      email: assessora.email ?? accessEmail ?? '',
      password: pwd,
    });
  };

  const sendWpp = async () => {
    const phone = editPhone || assessora.phone;
    if (!phone) { toast.error('Salve o telefone da assessora antes de enviar'); return; }
    if (!tempPwd) { toast.error('Redefina a senha primeiro para incluí-la na mensagem'); return; }
    setSendingWpp(true);
    const result = await sendWhatsApp(phone, await buildWppMessage(tempPwd));
    setSendingWpp(false);
    if (result.ok) toast.success('Mensagem enviada!');
    else toast.error('Erro ao enviar: ' + result.error);
  };

  const doMerge = async () => {
    const target = allAssessoras.find(a => a.id === mergeTarget);
    if (!target) return;
    setMerging(true);
    await Promise.all([
      (supabase.from('events' as any) as any).update({ organizer_id: target.id, organizer: target.name }).eq('organizer_id', assessora.id),
      (supabase.from('events' as any) as any).update({ organizer: target.name }).eq('organizer', assessora.name),
    ]);
    await (supabase.from('suppliers' as any) as any).delete().eq('id', assessora.id);
    toast.success(`"${assessora.name}" mesclada em "${target.name}"!`);
    setMerging(false);
    onRefresh();
    onClose();
  };

  const totalReceita = eventos.reduce((s, e) => s + (e.total_value ?? 0), 0);
  const fechados = eventos.filter(e => e.status === 'confirmed' || e.status === 'completed').length;
  const hasAccess = !!assessora.user_id;

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
              <span className="text-sm font-bold text-primary">{(assessora.name ?? '?').charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{assessora.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {eventos.length} eventos · {fechados} fechados
                {hasAccess && <span className="ml-2 text-emerald-600 font-medium">· Acesso ativo</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 px-5 gap-1">
          {(['eventos', 'acesso', 'editar'] as ModalTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t === 'eventos' ? `Eventos (${eventos.length})` : t === 'acesso' ? 'Acesso' : 'Editar'}
            </button>
          ))}
        </div>

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
                        <td className="px-3 py-2.5 text-right text-xs font-semibold">{e.total_value != null ? fmBRL(e.total_value) : '—'}</td>
                        <td className="px-2 py-2.5 text-center">
                          <button onClick={() => navigate(`/events/${e.id}`, { state: { backTo: '/cadastros/assessores', backLabel: 'Assessoras' } })}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20 font-semibold text-xs">
                    <td colSpan={5} className="px-4 py-2.5">{eventos.length} eventos</td>
                    <td className="px-3 py-2.5 text-right">{totalReceita > 0 ? fmBRL(totalReceita) : '—'}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )
          )}

          {/* ── Tab Acesso ── */}
          {tab === 'acesso' && (
            <div className="p-5 max-w-md flex flex-col gap-5">
              {hasAccess ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <KeyRound className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Acesso ativo</p>
                      <p className="text-xs text-emerald-600">{assessora.email}</p>
                    </div>
                  </div>

                  {tempPwd && (
                    <div className="flex flex-col gap-3">
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-xs font-semibold text-amber-800 mb-1 uppercase tracking-wide">Senha temporária gerada</p>
                        <p className="text-lg font-mono font-bold text-amber-900 tracking-widest">{tempPwd}</p>
                        <p className="text-xs text-amber-600 mt-1">A assessora será solicitada a trocar na primeira entrada.</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={copyCredentials}
                          className="flex-1 flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium border border-border rounded-lg hover:bg-muted/50 transition-colors">
                          {copied ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          {copied ? 'Copiado!' : 'Copiar mensagem'}
                        </button>
                        <button onClick={sendWpp} disabled={sendingWpp || !editPhone}
                          className="flex-1 flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                          <Send className="w-4 h-4" />
                          {sendingWpp ? 'Enviando…' : 'Enviar WhatsApp'}
                        </button>
                      </div>
                      {!editPhone && !assessora.phone && (
                        <p className="text-xs text-amber-600">
                          Para enviar por WhatsApp, salve o telefone na aba <strong>Editar</strong> primeiro.
                        </p>
                      )}
                    </div>
                  )}

                  {!tempPwd && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button onClick={copyCredentials}
                          className="flex-1 flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium border border-border rounded-lg hover:bg-muted/50 transition-colors">
                          <Copy className="w-4 h-4" />
                          Copiar mensagem
                        </button>
                        <button onClick={sendWpp} disabled={sendingWpp || (!editPhone && !assessora.phone)}
                          className="flex-1 flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                          <Send className="w-4 h-4" />
                          {sendingWpp ? 'Enviando…' : 'Enviar WhatsApp'}
                        </button>
                      </div>
                      <button onClick={resetPassword} disabled={creatingAccess}
                        className="flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium border border-border rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors text-muted-foreground">
                        <RefreshCw className="w-3.5 h-3.5" />
                        {creatingAccess ? 'Redefinindo…' : 'Redefinir senha'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Criar acesso para {assessora.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Um login com senha temporária será criado automaticamente. A assessora deverá trocar a senha no primeiro acesso.
                    </p>
                  </div>
                  <button onClick={createAccess} disabled={creatingAccess}
                    className="flex items-center justify-center gap-2 h-10 px-5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    <KeyRound className="w-4 h-4" />
                    {creatingAccess ? 'Criando acesso…' : 'Criar acesso'}
                  </button>
                </div>
              )}

              {/* Histórico de acessos */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Histórico de acessos</p>
                </div>
                {loadingLogs ? (
                  <p className="text-xs text-muted-foreground">Carregando…</p>
                ) : accessLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum acesso registrado ainda.</p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
                    {accessLogs.map((log, i) => {
                      const dt = new Date(log.accessed_at);
                      const date = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      const time = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      const isFirst = i === accessLogs.length - 1;
                      return (
                        <div key={log.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-xs">
                          <span className="text-foreground font-medium">{date} às {time}</span>
                          {isFirst && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Primeiro acesso</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab Editar ── */}
          {tab === 'editar' && (
            <div className="p-5 flex flex-col gap-5 max-w-lg">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Nome</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Telefone / WhatsApp</label>
                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="(11) 99999-9999"
                  className="w-full h-10 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">Observações</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3}
                  placeholder="Notas internas sobre esta assessora..."
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
              </div>
              <button onClick={saveEdit} disabled={saving || !editName.trim()}
                className="flex items-center gap-2 h-10 px-5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors w-fit">
                <Check className="w-4 h-4" />
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>

              <div className="border-t border-border pt-5">
                <div className="flex items-center gap-2 mb-2">
                  <Merge className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold">Mesclar com outra assessora</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Todos os eventos de <strong>{assessora.name}</strong> serão transferidos para a assessora selecionada.
                </p>
                <select value={mergeTarget} onChange={e => { setMergeTarget(e.target.value); setConfirmMerge(false); }}
                  className="w-full h-10 px-3 text-sm border border-border rounded-lg bg-white mb-3">
                  <option value="">Selecionar assessora de destino…</option>
                  {allAssessoras.filter(a => a.id !== assessora.id).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {mergeTarget && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <label className="flex items-center gap-2 text-xs text-amber-800 cursor-pointer">
                        <input type="checkbox" checked={confirmMerge} onChange={e => setConfirmMerge(e.target.checked)} className="accent-amber-600" />
                        Entendi, quero mesclar {eventos.length} eventos para a assessora selecionada. Ação irreversível.
                      </label>
                    </div>
                  </div>
                )}
                <button onClick={doMerge} disabled={!mergeTarget || !confirmMerge || merging}
                  className="flex items-center gap-2 h-10 px-5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors w-fit">
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
  const [rows, setRows]       = useState<Assessora[]>([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Assessora | null>(null);
  const [adding, setAdding]   = useState(false);
  const [newName, setNewName] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from('suppliers' as any) as any)
      .select('id, name, notes, phone, email, user_id, must_change_password, created_at')
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
    const { error } = await (supabase.from('suppliers' as any) as any)
      .insert({ name: newName.trim(), type: 'organizer' });
    if (error) { toast.error('Erro: ' + error.message); return; }
    setNewName(''); setAdding(false);
    toast.success('Assessora adicionada!');
    load();
  };

  const fmtDateShort = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar assessoras…"
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" />
        </div>
        <button onClick={() => { setAdding(true); setNewName(''); }}
          className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shrink-0">
          <Plus className="w-4 h-4" />
          Nova
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="bg-white border border-border rounded-xl px-4 py-2.5">
          <p className="text-[11px] text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{rows.length}</p>
        </div>
        <div className="bg-white border border-border rounded-xl px-4 py-2.5">
          <p className="text-[11px] text-muted-foreground">Com acesso</p>
          <p className="text-lg font-bold text-emerald-600">{rows.filter(r => r.user_id).length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left w-8">#</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left">NOME</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left hidden md:table-cell">TELEFONE</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-center w-28">ACESSO</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground tracking-wide text-left w-28 hidden sm:table-cell">CADASTRADO EM</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="border-b border-border/50 bg-primary/5">
                <td className="px-4 py-2 text-muted-foreground text-xs">{rows.length + 1}</td>
                <td className="px-4 py-2" colSpan={3}>
                  <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }}
                    placeholder="Nome da assessora…"
                    className="w-full h-8 px-3 text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </td>
                <td className="px-4 py-2 text-muted-foreground text-xs hidden sm:table-cell">Hoje</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={add} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setAdding(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            )}

            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-4 py-3"><div className="h-3 w-4 bg-muted/40 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 bg-muted/40 rounded animate-pulse" style={{ width: `${40 + (i * 13) % 40}%` }} /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-3 w-24 bg-muted/40 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-16 bg-muted/40 rounded animate-pulse mx-auto" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><div className="h-3 w-16 bg-muted/40 rounded animate-pulse" /></td>
                  <td />
                </tr>
              ))
            ) : filtered.length === 0 && !adding ? (
              <tr><td colSpan={6} className="py-20 text-center text-sm text-muted-foreground">Nenhuma assessora encontrada.</td></tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 group transition-colors cursor-pointer" onClick={() => setSelected(row)}>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-primary">{row.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="font-medium text-foreground">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{row.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {row.user_id
                      ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Ativo
                        </span>
                      : <span className="text-[10px] text-muted-foreground/50">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{fmtDateShort(row.created_at)}</td>
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
