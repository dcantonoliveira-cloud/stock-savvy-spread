import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, ChefHat, Home, ClipboardList, CalendarDays, Warehouse } from 'lucide-react';

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
    { to: '/', label: 'Estoque', icon: Home },
    { to: '/inventario', label: 'Inventário', icon: ClipboardList },
    { to: '/eventos', label: 'Eventos', icon: CalendarDays },
    ...(permissions.access_materials ? [{ to: '/materiais', label: 'Materiais', icon: Warehouse }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">

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
