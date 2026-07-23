import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Bell, CheckCheck, AlertTriangle, Clock, DollarSign,
  CalendarDays, FileText, Stethoscope, CheckCircle2, Loader2,
  ExternalLink, Send, ListChecks, ClipboardCheck, PenLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

type AlertSeverity = 'urgent' | 'warning';

interface SmartAlert {
  id: string; type: string; severity: AlertSeverity;
  title: string; description: string | null;
  entity_type: string | null; entity_id: string | null;
  resolved_at: string | null; resolved_by_name: string | null; created_at: string;
}

const TYPE_META: Record<string, { emoji: string; icon: React.ReactNode; label: string }> = {
  payment_pending:  { emoji: '💸', icon: <DollarSign className="w-3.5 h-3.5" />,  label: 'Pagamento' },
  menu_change:      { emoji: '🍽️', icon: <CalendarDays className="w-3.5 h-3.5" />, label: 'Cardápio' },
  field_change:     { emoji: '✏️', icon: <CalendarDays className="w-3.5 h-3.5" />,  label: 'Alteração' },
  payslip_unsigned: { emoji: '📄', icon: <FileText className="w-3.5 h-3.5" />,     label: 'Holerite' },
  exames:           { emoji: '🩺', icon: <Stethoscope className="w-3.5 h-3.5" />,  label: 'Exame' },
  contract_form:    { emoji: '📋', icon: <ClipboardCheck className="w-3.5 h-3.5" />, label: 'Formulário' },
  zapsign_signed:   { emoji: '✍️', icon: <PenLine className="w-3.5 h-3.5" />,        label: 'Assinatura' },
};

const SEV_STYLE = {
  urgent:  { dot: 'bg-red-500',   badge: 'bg-red-50 text-red-700 border-red-200',       border: 'border-l-red-500' },
  warning: { dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200', border: 'border-l-amber-400' },
};

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function NotificationsPage() {
  const navigate   = useNavigate();
  const { profile, user } = useAuth();
  const [alerts, setAlerts]         = useState<SmartAlert[]>([]);
  const [ackedIds, setAckedIds]     = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'active' | 'resolved'>('active');
  const [resolving, setResolving]   = useState<string | null>(null);
  const [resolvingAll, setResolvingAll] = useState(false);
  const [resending, setResending]   = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: alertsData }, { data: acksData }] = await Promise.all([
      (supabase as any).from('smart_alerts').select('*')
        .order('severity', { ascending: true })
        .order('created_at', { ascending: false }).limit(300),
      (supabase as any).from('smart_alert_acks').select('alert_id'),
    ]);
    setAlerts((alertsData ?? []) as SmartAlert[]);
    setAckedIds(new Set((acksData ?? []).map((a: any) => a.alert_id)));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = (supabase as any).channel('smart-alerts-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smart_alerts' }, load).subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);

  async function resolve(id: string) {
    setResolving(id);
    const { error } = await (supabase as any).from('smart_alert_acks')
      .upsert({ alert_id: id, user_id: user?.id }, { onConflict: 'alert_id,user_id' });
    if (error) toast.error('Erro ao marcar como ciente');
    else {
      setAckedIds(prev => new Set([...prev, id]));
      toast.success('Marcado como ciente');
    }
    setResolving(null);
  }

  async function resolveAll() {
    setResolvingAll(true);
    const ids = active.map(a => a.id);
    const rows = ids.map(alert_id => ({ alert_id, user_id: user?.id }));
    const { error } = await (supabase as any).from('smart_alert_acks')
      .upsert(rows, { onConflict: 'alert_id,user_id' });
    if (error) toast.error('Erro ao marcar todos como ciente');
    else {
      setAckedIds(prev => new Set([...prev, ...ids]));
      toast.success(`${ids.length} alertas marcados como ciente`);
    }
    setResolvingAll(false);
  }

  async function reopen(id: string) {
    await (supabase as any).from('smart_alert_acks').delete().eq('alert_id', id);
    setAckedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  async function resend(alert: SmartAlert) {
    setResending(alert.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-smart-alerts`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' } }
      );
      if (res.ok) toast.success('Mensagem reenviada pelo WhatsApp');
      else toast.error('Erro ao reenviar mensagem');
    } catch {
      toast.error('Erro ao reenviar mensagem');
    }
    setResending(null);
  }

  // Filtra por ack do usuário atual
  const allActive  = alerts.filter(a => !ackedIds.has(a.id));
  const active     = allActive.filter(a => Date.now() - new Date(a.created_at).getTime() <= SEVEN_DAYS_MS);
  const resolved   = alerts.filter(a => ackedIds.has(a.id));
  const urgent     = active.filter(a => a.severity === 'urgent');
  const warning    = active.filter(a => a.severity === 'warning');
  const shown      = tab === 'active' ? active : resolved;

  function navigateTo(a: SmartAlert) {
    if (a.entity_type === 'event'    && a.entity_id) navigate(`/events/${a.entity_id}`);
    if (a.entity_type === 'employee' && a.entity_id) navigate(`/users/${a.entity_id}`);
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Alertas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Situações que precisam de atenção da equipe.</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          {!loading && tab === 'active' && active.length > 0 && (
            <button
              onClick={resolveAll}
              disabled={resolvingAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {resolvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
              Marcar todos como ciente
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-red-600 leading-none">{urgent.length}</p>
              <p className="text-xs text-red-700 font-medium mt-0.5">Urgentes</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-amber-600 leading-none">{warning.length}</p>
              <p className="text-xs text-amber-700 font-medium mt-0.5">Atenção</p>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-600 leading-none">{resolved.length}</p>
              <p className="text-xs text-emerald-700 font-medium mt-0.5">Resolvidos</p>
            </div>
          </div>
          <div className="bg-muted/40 border border-border rounded-xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground leading-none">{active.length + resolved.length}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">Total (7d)</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 p-1 bg-muted/40 rounded-xl w-fit">
        {([['active','Ativos',active.length],['resolved','Resolvidos',resolved.length]] as const).map(([key,label,count]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab===key?'bg-white shadow-sm text-foreground':'text-muted-foreground hover:text-foreground'}`}>
            {label}
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${tab===key?'bg-primary/10 text-primary':'bg-muted text-muted-foreground'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse"/>)}</div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400"/>
          <p className="text-base font-semibold text-foreground">{tab==='active'?'Tudo certo! Nenhum alerta ativo.':'Nenhum alerta resolvido ainda.'}</p>
          {tab==='active'&&<p className="text-sm text-muted-foreground">Alertas aparecem aqui automaticamente quando algo precisa de atenção.</p>}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-6"></th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">Quando</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-52">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map(a => {
                const sev  = SEV_STYLE[a.severity] ?? SEV_STYLE.warning;
                const meta = TYPE_META[a.type] ?? { emoji: '🚨', icon: <Bell className="w-3.5 h-3.5"/>, label: a.type };
                const canNav = (a.entity_type==='event'||a.entity_type==='employee') && a.entity_id;
                const isPayslip = a.type === 'payslip_unsigned';
                return (
                  <tr key={a.id} className={`hover:bg-muted/20 transition-colors ${a.resolved_at ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-4">
                      <span className={`inline-block w-2 h-2 rounded-full ${sev.dot}`} />
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${sev.badge}`}>
                        {meta.emoji} {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-foreground text-[13px] leading-snug">{a.title}</p>
                      {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                      {a.resolved_at && a.resolved_by_name && (
                        <p className="text-[11px] text-emerald-600 mt-1">✓ Ciente: {a.resolved_by_name} · {relTime(a.resolved_at)}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-muted-foreground whitespace-nowrap">{relTime(a.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {canNav && (
                          <button onClick={() => navigateTo(a)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Ir para o evento">
                            <ExternalLink className="w-3.5 h-3.5"/>
                          </button>
                        )}
                        {!a.resolved_at && isPayslip && (
                          <button onClick={() => resend(a)} disabled={resending === a.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors disabled:opacity-50"
                            title="Reenviar mensagem WhatsApp">
                            {resending === a.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Send className="w-3 h-3"/>}
                            Reenviar
                          </button>
                        )}
                        {!a.resolved_at ? (
                          <button onClick={() => resolve(a.id)} disabled={resolving === a.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50">
                            {resolving === a.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <CheckCheck className="w-3 h-3"/>}
                            Ciente
                          </button>
                        ) : (
                          <button onClick={() => reopen(a.id)}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
                            Reabrir
                          </button>
                        )}
                      </div>
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
