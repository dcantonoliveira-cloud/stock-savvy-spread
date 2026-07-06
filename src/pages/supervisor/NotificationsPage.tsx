import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Bell, CheckCheck, FileText, CalendarDays, DollarSign, CheckCircle2, UtensilsCrossed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────
type NotifType = 'novo_orcamento' | 'nova_degustacao' | 'novo_pagamento' | 'evento_fechado' | 'cardapio_alterado';

interface Notif {
  id: string;
  type: NotifType | string;
  title: string;
  message: string | null;
  data: { link?: string; event_id?: string; session_id?: string } | null;
  read: boolean;
  created_at: string;
}

// ── Config por tipo ────────────────────────────────────────────────────────────
const TYPE_CFG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  novo_orcamento:    { icon: <FileText className="w-4 h-4" />,         color: 'text-blue-600',   bg: 'bg-blue-50' },
  nova_degustacao:   { icon: <CalendarDays className="w-4 h-4" />,     color: 'text-purple-600', bg: 'bg-purple-50' },
  novo_pagamento:    { icon: <DollarSign className="w-4 h-4" />,       color: 'text-emerald-600',bg: 'bg-emerald-50' },
  evento_fechado:    { icon: <CheckCircle2 className="w-4 h-4" />,     color: 'text-green-600',  bg: 'bg-green-50' },
  cardapio_alterado: { icon: <UtensilsCrossed className="w-4 h-4" />,  color: 'text-orange-600', bg: 'bg-orange-50' },
};

const DEFAULT_CFG = { icon: <Bell className="w-4 h-4" />, color: 'text-muted-foreground', bg: 'bg-muted' };

// ── Relative time ─────────────────────────────────────────────────────────────
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs, setNotifs]     = useState<Notif[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<NotifType | 'all'>('all');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('app_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setNotifs((data ?? []) as Notif[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('notif-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const markRead = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from('app_notifications').update({ read: true } as any).eq('id', id);
  };

  const markAllRead = async () => {
    const ids = notifs.filter(n => !n.read).map(n => n.id);
    if (!ids.length) return;
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from('app_notifications').update({ read: true } as any).in('id', ids);
    toast.success('Todas marcadas como lidas');
  };

  const handleClick = async (n: Notif) => {
    if (!n.read) await markRead(n.id);
    if (n.data?.link) navigate(n.data.link);
  };

  const FILTERS: { key: NotifType | 'all'; label: string }[] = [
    { key: 'all',              label: 'Todas' },
    { key: 'evento_fechado',   label: 'Fechados' },
    { key: 'novo_orcamento',   label: 'Orçamentos' },
    { key: 'nova_degustacao',  label: 'Degustações' },
    { key: 'novo_pagamento',   label: 'Pagamentos' },
    { key: 'cardapio_alterado',label: 'Cardápios' },
  ];

  const visible = filter === 'all' ? notifs : notifs.filter(n => n.type === filter);
  const unread  = notifs.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notificações</h1>
          {unread > 0 && (
            <p className="text-sm text-muted-foreground">{unread} não {unread === 1 ? 'lida' : 'lidas'}</p>
          )}
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5 text-xs">
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              filter === f.key
                ? 'bg-primary text-white border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/30'
            }`}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1 opacity-70">
                {notifs.filter(n => n.type === f.key && !n.read).length > 0
                  ? `(${notifs.filter(n => n.type === f.key && !n.read).length})`
                  : ''}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhuma notificação</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/60">
          {visible.map(n => {
            const cfg = TYPE_CFG[n.type] ?? DEFAULT_CFG;
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-muted/30 ${!n.read ? 'bg-primary/[0.03]' : ''}`}
              >
                {/* Ícone */}
                <div className={`w-8 h-8 rounded-full ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 mt-0.5`}>
                  {cfg.icon}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                      {n.title}
                    </p>
                    <span className="text-[11px] text-muted-foreground shrink-0">{relTime(n.created_at)}</span>
                  </div>
                  {n.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                  )}
                </div>

                {/* Bolinha não lida */}
                {!n.read && (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
