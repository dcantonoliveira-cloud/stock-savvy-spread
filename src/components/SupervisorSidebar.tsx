import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle, FileText, BarChart3, Users, LogOut, Bell, Brain, FolderOpen, ClipboardCheck, Building2, UtensilsCrossed, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoRondello from '@/assets/logo-rondello.png';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/categories', label: 'Categorias', icon: FolderOpen },
  { path: '/items', label: 'Estoque', icon: Package },
  { path: '/invoices', label: 'Notas Fiscais', icon: Receipt },
  { path: '/entries', label: 'Entradas', icon: ArrowUpCircle },
  { path: '/outputs', label: 'Saídas', icon: ArrowDownCircle },
  { path: '/sheets', label: 'Fichas Técnicas', icon: FileText },
  { path: '/event-menus', label: 'Cardápios', icon: UtensilsCrossed },
  { path: '/comparison', label: 'Comparativo', icon: BarChart3 },
  { path: '/inventory', label: 'Inventário', icon: ClipboardCheck },
  { path: '/kitchens', label: 'Cozinhas', icon: Building2 },
  { path: '/notifications', label: 'Notificações', icon: Bell },
  { path: '/analysis', label: 'Análise IA', icon: Brain },
  { path: '/users', label: 'Funcionários', icon: Users },
];

export default function SupervisorSidebar() {
  const { pathname } = useLocation();
  const { signOut, profile } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] glass-sidebar flex flex-col z-50">
      <div className="p-5 pb-3">
        <img src={logoRondello} alt="Rondello Buffet" className="h-10 object-contain" />
        <p className="text-[10px] text-muted-foreground mt-1 tracking-[0.2em] uppercase font-medium">
          Painel do Supervisor
        </p>
      </div>
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto mt-2">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                active ? 'nav-item-active' : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
            {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{profile?.display_name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl text-xs"
          onClick={signOut}
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />Sair
        </Button>
      </div>
    </aside>
  );
}
