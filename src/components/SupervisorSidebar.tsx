import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle, FileText, BarChart3,
  Users, LogOut, Bell, Brain, FolderOpen, ClipboardCheck, Building2, UtensilsCrossed,
  ArrowRightLeft, Receipt, ChevronDown, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import logoRondello from '@/assets/logo-rondello.png';

type NavItem = { path: string; label: string; icon: any };
type NavGroup = { label: string; icon: any; items: NavItem[] } | NavItem;

const navStructure: NavGroup[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Categorias', icon: FolderOpen,
    items: [
      { path: '/categories', label: 'Insumos', icon: Package },
      { path: '/sheets', label: 'Fichas Técnicas', icon: FileText },
    ]
  },
  {
    label: 'Estoque', icon: Package,
    items: [
      { path: '/items', label: 'Estoque Geral', icon: Package },
      { path: '/inventory', label: 'Inventários', icon: ClipboardCheck },
      { path: '/kitchens', label: 'Centros de Custo', icon: Building2 },
    ]
  },
  {
    label: 'Movimentações', icon: ArrowRightLeft,
    items: [
      { path: '/entries', label: 'Entradas', icon: ArrowUpCircle },
      { path: '/outputs', label: 'Saídas', icon: ArrowDownCircle },
      { path: '/comparison', label: 'Transferências', icon: ArrowRightLeft },
    ]
  },
  { path: '/event-menus', label: 'Cardápios', icon: UtensilsCrossed },
  { path: '/invoices', label: 'Notas Fiscais', icon: Receipt },
  { path: '/analysis', label: 'Análise IA', icon: Brain },
  { path: '/users', label: 'Funcionários', icon: Users },
];

function isGroup(item: NavGroup): item is { label: string; icon: any; items: NavItem[] } {
  return 'items' in item;
}

export default function SupervisorSidebar() {
  const { pathname } = useLocation();
  const { signOut, profile } = useAuth();

  const getDefaultOpen = () => {
    const open = new Set<string>();
    navStructure.forEach(item => {
      if (isGroup(item) && item.items.some(i => pathname === i.path)) {
        open.add(item.label);
      }
    });
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Set<string>>(getDefaultOpen);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

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
        {navStructure.map((item) => {
          if (!isGroup(item)) {
            const active = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? 'nav-item-active'
                    : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </Link>
            );
          }

          const Icon = item.icon;
          const isOpen = openGroups.has(item.label);
          const isActiveGroup = item.items.some(i => pathname === i.path);

          return (
            <div key={item.label}>
              <button
                onClick={() => toggleGroup(item.label)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  isActiveGroup
                    ? 'text-sidebar-foreground bg-sidebar-accent/50'
                    : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span className="flex-1 text-left">{item.label}</span>
                {isOpen
                  ? <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  : <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                }
              </button>

              {isOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/50 pl-3">
                  {item.items.map(sub => {
                    const SubIcon = sub.icon;
                    const active = pathname === sub.path;
                    return (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 ${
                          active
                            ? 'nav-item-active'
                            : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                        }`}
                      >
                        <SubIcon className="w-[15px] h-[15px]" />
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
