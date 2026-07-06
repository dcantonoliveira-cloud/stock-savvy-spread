import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Bell, FileText, CalendarDays, DollarSign, CheckCircle2, UtensilsCrossed, ChevronRight } from 'lucide-react';

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string | null;
  actor_name: string | null;
  data: { link?: string } | null;
  read: boolean;
  created_at: string;
}

const TYPE_CFG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  novo_orcamento:    { icon: <FileText className="w-3.5 h-3.5" />,        color: 'text-blue-600',    bg: 'bg-blue-100' },
  nova_degustacao:   { icon: <CalendarDays className="w-3.5 h-3.5" />,    color: 'text-purple-600',  bg: 'bg-purple-100' },
  novo_pagamento:    { icon: <DollarSign className="w-3.5 h-3.5" />,      color: 'text-emerald-600', bg: 'bg-emerald-100' },
  evento_fechado:    { icon: <CheckCircle2 className="w-3.5 h-3.5" />,    color: 'text-green-600',   bg: 'bg-green-100' },
  cardapio_alterado: { icon: <UtensilsCrossed className="w-3.5 h-3.5" />, color: 'text-orange-600',  bg: 'bg-orange-100' },
};
const DEFAULT_CFG = { icon: <Bell className="w-3.5 h-3.5" />, color: 'text-muted-foreground', bg: 'bg-muted' };

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d` : new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function Initials({ name }: { name: string | null }) {
  const letters = (name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
      {letters}
    </div>
  );
}

export default function NotificationsPanel({ fullHeight }: { fullHeight?: boolean }) {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) console.error('[NotificationsPanel] erro:', error.message);
    setNotifs((data ?? []) as Notif[]);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('notif-panel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_notifications' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const handleClick = async (n: Notif) => {
    if (!n.read) {
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      await supabase.from('app_notifications').update({ read: true } as any).eq('id', n.id);
    }
    if (n.data?.link) navigate(n.data.link);
  };

  const unread = notifs.filter(n => !n.read).length;

  const wrapCls = fullHeight
    ? 'flex flex-col'
    : 'bg-white border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col';

  return (
    <div className={wrapCls}>
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">Notificações</p>
          {unread > 0 && (
            <span className="text-[10px] font-bold bg-destructive text-white rounded-full px-1.5 py-0.5 leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/notifications')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
        >
          Ver todas <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Lista */}
      {notifs.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          <Bell className="w-7 h-7 mx-auto mb-2 opacity-20" />
          <p className="text-xs">Sem notificações</p>
        </div>
      ) : (
        <div className={`divide-y divide-border/50 overflow-y-auto ${fullHeight ? 'max-h-[calc(100vh-220px)]' : 'max-h-[420px]'}`}>
          {notifs.map(n => {
            const cfg = TYPE_CFG[n.type] ?? DEFAULT_CFG;
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors ${!n.read ? 'bg-primary/[0.025]' : ''}`}
              >
                <Initials name={n.actor_name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`w-5 h-5 rounded-full ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0`}>
                      {cfg.icon}
                    </span>
                    <p className={`text-xs leading-snug truncate ${!n.read ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                      {n.title}
                    </p>
                  </div>
                  {n.message && (
                    <p className="text-[11px] text-muted-foreground truncate">{n.message}</p>
                  )}
                  {n.actor_name && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{n.actor_name}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{relTime(n.created_at)}</span>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
