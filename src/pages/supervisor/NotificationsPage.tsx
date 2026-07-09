import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Bell, CheckCheck, AlertTriangle, Clock, DollarSign,
  CalendarDays, FileText, Stethoscope, CheckCircle2, Loader2, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

type AlertSeverity = 'urgent' | 'warning';
type AlertType = 'financeiro' | 'eventos' | 'holerites' | 'exames';

interface SmartAlert {
  id: string; type: AlertType; severity: AlertSeverity;
  title: string; description: string | null;
  entity_type: string | null; entity_id: string | null;
  resolved_at: string | null; resolved_by_name: string | null; created_at: string;
}

const TYPE_META: Record<AlertType, { icon: React.ReactNode; label: string }> = {
  financeiro: { icon: <DollarSign className="w-4 h-4" />,  label: 'Financeiro' },
  eventos:    { icon: <CalendarDays className="w-4 h-4" />, label: 'Evento' },
  holerites:  { icon: <FileText className="w-4 h-4" />,     label: 'Holerite' },
  exames:     { icon: <Stethoscope className="w-4 h-4" />,  label: 'Exame' },
};

const SEV_STYLE = {
  urgent:  { dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700 border-red-200',      border: 'border-l-red-500' },
  warning: { dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 border-amber-200', border: 'border-l-amber-400' },
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

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [alerts, setAlerts]       = useState<SmartAlert[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'active' | 'resolved'>('active');
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('smart_alerts').select('*')
      .order('severity', { ascending: true })
      .order('created_at', { ascending: false }).limit(300);
    setAlerts((data ?? []) as SmartAlert[]);
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
    const now = new Date().toISOString();
    const { error } = await (supabase as any).from('smart_alerts')
      .update({ resolved_at: now, resolved_by_name: profile?.display_name ?? 'Usuário' }).eq('id', id);
    if (error) toast.error('Erro ao marcar como resolvido');
    else {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved_at: now, resolved_by_name: profile?.display_name ?? 'Usuário' } : a));
      toast.success('Marcado como resolvido');
    }
    setResolving(null);
  }

  async function reopen(id: string) {
    await (supabase as any).from('smart_alerts').update({ resolved_at: null, resolved_by_name: null }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved_at: null, resolved_by_name: null } : a));
  }

  const active   = alerts.filter(a => !a.resolved_at);
  const resolved = alerts.filter(a => !!a.resolved_at);
  const urgent   = active.filter(a => a.severity === 'urgent');
  const warning  = active.filter(a => a.severity === 'warning');
  const shown    = tab === 'active' ? active : resolved;

  function navigateTo(a: SmartAlert) {
    if (a.entity_type === 'event'    && a.entity_id) navigate(`/events/${a.entity_id}`);
    if (a.entity_type === 'employee' && a.entity_id) navigate(`/users/${a.entity_id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Alertas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Situações que precisam de atenção da equipe.</p>
        </div>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
      </div>

      {!loading && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div><p className="text-2xl font-black text-red-600">{urgent.length}</p><p className="text-xs text-red-700 font-medium">Urgentes</p></div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            <div><p className="text-2xl font-black text-amber-600">{warning.length}</p><p className="text-xs text-amber-700 font-medium">Atenção</p></div>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-4 p-1 bg-muted/40 rounded-xl w-fit">
        {([['active','Ativos',active.length],['resolved','Resolvidos',resolved.length]] as const).map(([key,label,count]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab===key?'bg-white shadow-sm text-foreground':'text-muted-foreground hover:text-foreground'}`}>
            {label}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${tab===key?'bg-primary/10 text-primary':'bg-muted text-muted-foreground'}`}>{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse"/>)}</div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400"/>
          <p className="text-base font-semibold text-foreground">{tab==='active'?'Tudo certo! Nenhum alerta ativo.':'Nenhum alerta resolvido ainda.'}</p>
          {tab==='active'&&<p className="text-sm text-muted-foreground">Os alertas aparecem aqui automaticamente quando algo precisa de atenção.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map(a => {
            const sev  = SEV_STYLE[a.severity] ?? SEV_STYLE.warning;
            const meta = TYPE_META[a.type] ?? { icon: <Bell className="w-4 h-4"/>, label: a.type };
            const canNav = (a.entity_type==='event'||a.entity_type==='employee') && a.entity_id;
            return (
              <div key={a.id} className={`bg-white border border-border border-l-4 ${sev.border} rounded-xl px-4 py-3 flex items-start gap-3 ${a.resolved_at?'opacity-60':''}`}>
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sev.dot}`}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${sev.badge}`}>{meta.icon}{meta.label}</span>
                    <span className="text-[11px] text-muted-foreground">{relTime(a.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-1 leading-snug">{a.title}</p>
                  {a.description&&<p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                  {a.resolved_at&&a.resolved_by_name&&(
                    <p className="text-[11px] text-emerald-600 mt-1">✓ Resolvido por {a.resolved_by_name} · {relTime(a.resolved_at)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {canNav&&(
                    <button onClick={()=>navigateTo(a)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Ir para o evento">
                      <ExternalLink className="w-3.5 h-3.5"/>
                    </button>
                  )}
                  {!a.resolved_at?(
                    <button onClick={()=>resolve(a.id)} disabled={resolving===a.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50">
                      {resolving===a.id?<Loader2 className="w-3 h-3 animate-spin"/>:<CheckCheck className="w-3 h-3"/>}Ciente
                    </button>
                  ):(
                    <button onClick={()=>reopen(a.id)} className="px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">Reabrir</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
