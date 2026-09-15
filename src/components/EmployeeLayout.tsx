import { ReactNode, useEffect, useState } from 'react';
import { ConnectionHealthBanner } from './ConnectionHealthBanner';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, ChefHat, Home, ClipboardList, CalendarDays, Warehouse, FileText, UtensilsCrossed, Timer, ListChecks, Bell, BellOff, Loader2 } from 'lucide-react';
import { isPushSupported, hasLocalPushSubscription, subscribeToPush, unsubscribeFromPush } from '@/lib/pushNotifications';
import { toast } from 'sonner';

function PushBell() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    setSupported(true);
    hasLocalPushSubscription().then(setSubscribed);
  }, []);

  if (!supported || !user) return null;

  const handleClick = async () => {
    setWorking(true);
    if (subscribed) {
      const res = await unsubscribeFromPush(user.id);
      if (res.ok) { setSubscribed(false); toast.success('Notificações desativadas'); }
      else toast.error(res.error ?? 'Erro ao desativar');
    } else {
      const res = await subscribeToPush(user.id);
      if (res.ok) { setSubscribed(true); toast.success('Notificações ativadas!'); }
      else toast.error(res.error ?? 'Erro ao ativar notificações');
    }
    setWorking(false);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={working}
      title={subscribed ? 'Notificações ativadas — clique pra desativar' : 'Ativar notificações'}
      className={`rounded-xl w-8 h-8 ${subscribed ? 'text-primary hover:bg-primary/10' : 'hover:bg-muted'}`}
    >
      {working ? <Loader2 className="w-4 h-4 animate-spin" /> : subscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
    </Button>
  );
}

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  const { signOut, profile, permissions } = useAuth();
  const { pathname } = useLocation();

  const initials = profile?.display_name
    ?.split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase() || '?';

  const tabs = [
    ...(permissions.access_stock ? [
      { to: '/', label: 'Estoque', icon: Home },
      { to: '/eventos', label: 'Eventos', icon: CalendarDays },
    ] : []),
    ...((permissions.access_inventory || permissions.access_stock) ? [
      { to: '/inventario', label: 'Inventário', icon: ClipboardList },
    ] : []),
    ...(permissions.access_materials ? [{ to: '/materiais', label: 'Materiais', icon: Warehouse }] : []),
    ...(permissions.access_stock ? [{ to: '/separacao', label: 'Separação', icon: ListChecks }] : []),
    ...(permissions.access_producao ? [{ to: '/producao', label: 'Produção', icon: UtensilsCrossed }] : []),
    { to: '/meus-holerites', label: 'Holerites', icon: FileText },
    { to: '/meu-ponto', label: 'Ponto', icon: Timer },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ConnectionHealthBanner />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: 'hsl(222 35% 10%)' }}>
            <ChefHat className="w-4 h-4" style={{ color: 'hsl(38 75% 52%)' }} />
          </div>
          <span className="text-base font-bold tracking-wide gold-text">RONDELLO</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                 style={{
                   background: 'hsl(222 35% 10%)',
                   color: 'hsl(38 75% 52%)',
                 }}>
              {initials}
            </div>
            <span className="text-sm text-muted-foreground hidden sm:block font-medium">
              {profile?.display_name}
            </span>
          </div>
          <PushBell />
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="hover:bg-destructive/10 hover:text-destructive rounded-xl w-8 h-8"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 max-w-2xl mx-auto pb-24">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border flex z-50">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-semibold transition-colors ${
                active ? '' : 'text-muted-foreground'
              }`}
              style={active ? { color: 'hsl(38 75% 45%)' } : {}}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
