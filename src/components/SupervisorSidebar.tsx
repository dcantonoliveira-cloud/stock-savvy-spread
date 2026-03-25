import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import {
  LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle, FileText,
  Users, LogOut, Brain, FolderOpen, ClipboardCheck, Building2, UtensilsCrossed,
  ArrowRightLeft, ChevronDown, ChevronRight, Truck, ShoppingCart, Warehouse, ClipboardList,
  AlertTriangle, BookMarked
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
      { path: '/fornecedores', label: 'Fornecedores', icon: Truck },
    ]
  },
  {
    label: 'Movimentações', icon: ArrowRightLeft,
    items: [
      { path: '/entries', label: 'Entradas', icon: ArrowUpCircle },
      { path: '/outputs', label: 'Saídas', icon: ArrowDownCircle },
      { path: '/transfers', label: 'Transferências', icon: ArrowRightLeft },
    ]
  },
  { label: 'Cardápios', icon: UtensilsCrossed, items: [
    { path: '/event-menus', label: 'Cardápios de Eventos', icon: UtensilsCrossed },
    { path: '/shopping-lists', label: 'Listas de Compras', icon: ShoppingCart },
  ]},
  {
    label: 'Materiais', icon: Warehouse,
    items: [
      { path: '/materiais', label: 'Inventário', icon: Package },
      { path: '/materiais/categorias', label: 'Categorias', icon: FolderOpen },
      { path: '/materiais/emprestimos', label: 'Eventos', icon: ClipboardList },
      { path: '/materiais/lista-base', label: 'Lista Base', icon: BookMarked },
      { path: '/materiais/perdas', label: 'Perdas & Avarias', icon: AlertTriangle },
    ]
  },
  { path: '/analysis', label: 'Análise IA', icon: Brain },
  { path: '/users', label: 'Funcionários', icon: Users },
];

function isGroup(item: NavGroup): item is { label: string; icon: any; items: NavItem[] } {
  return 'items' in item;
}

export default function SupervisorSidebar() {
  const { pathname } = useLocation();
  const { signOut, profile } = useAuth();
  const onlineUsers = useOnlineUsers();

  const getDefaultOpen = () => {
    const open = new Set<string>();
    navStructure.forEach(item => {
      if (isGroup(item) && item.items.some(i => pathname === i.path || pathname.startsWith(i.path + '/'))) {
        open.add(item.label);
      }
    });
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Set<string>>(getDefaultOpen);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      if (prev.has(label)) return new Set<string>();
      return new Set([label]);
    });
  };

  const initials = profile?.display_name
    ?.split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase() || '?';

  return (
    <aside className="fixed left-0 top-0 h-screen w-[256px] glass-sidebar flex flex-col z-50">

      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <img src={logoRondello} alt="Rondello Buffet" className="h-9 object-contain" />
        <p className="text-[10px] mt-1.5 tracking-[0.2em] uppercase font-semibold"
           style={{ color: 'hsl(38 75% 52% / 0.7)' }}>
          Painel do Supervisor
        </p>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px" style={{ background: 'hsl(222 25% 18%)' }} />

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navStructure.map((item) => {
          if (!isGroup(item)) {
            const active = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? 'nav-item-active'
                    : 'hover:bg-white/5'
                }`}
                style={{ color: active ? undefined : 'hsl(210 25% 65%)' }}
              >
                <Icon className="w-[17px] h-[17px] flex-shrink-0" />
                {item.label}
              </Link>
            );
          }

          const Icon = item.icon;
          const isOpen = openGroups.has(item.label);
          const isActiveGroup = item.items.some(i => pathname === i.path || pathname.startsWith(i.path + '/'));

          return (
            <div key={item.label}>
              <button
                onClick={() => toggleGroup(item.label)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  isActiveGroup ? 'bg-white/5' : 'hover:bg-white/5'
                }`}
                style={{ color: isActiveGroup ? 'hsl(210 30% 85%)' : 'hsl(210 25% 60%)' }}
              >
                <Icon className="w-[17px] h-[17px] flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {isOpen
                  ? <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                  : <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                }
              </button>

              {isOpen && (
                <div className="ml-5 mt-0.5 space-y-0.5 border-l pl-3"
                     style={{ borderColor: 'hsl(222 25% 20%)' }}>
                  {item.items.map(sub => {
                    const SubIcon = sub.icon;
                    const active = pathname === sub.path;
                    return (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-150 ${
                          active ? 'nav-item-active' : 'hover:bg-white/5'
                        }`}
                        style={{ color: active ? undefined : 'hsl(210 20% 55%)' }}
                      >
                        <SubIcon className="w-[14px] h-[14px] flex-shrink-0" />
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

      {/* Online users */}
      {onlineUsers.length > 0 && (
        <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl" style={{ background: 'hsl(222 25% 14%)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'hsl(210 20% 50%)' }}>
              Online ({onlineUsers.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {onlineUsers.map(u => {
              const initials = u.display_name
                .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
              const isSupervisor = u.role === 'supervisor';
              return (
                <div key={u.user_id} className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{
                      background: isSupervisor ? 'hsl(38 75% 52% / 0.25)' : 'hsl(210 50% 52% / 0.25)',
                      color: isSupervisor ? 'hsl(38 80% 62%)' : 'hsl(210 70% 70%)',
                    }}
                  >
                    {initials}
                  </div>
                  <span className="text-[11px] truncate" style={{ color: 'hsl(210 25% 65%)' }}>
                    {u.display_name}
                  </span>
                  {isSupervisor && (
                    <span className="text-[9px] px-1 rounded" style={{ background: 'hsl(38 75% 52% / 0.15)', color: 'hsl(38 80% 62%)' }}>
                      sup
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mx-5 h-px" style={{ background: 'hsl(222 25% 18%)' }} />

      {/* User */}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
               style={{
                 background: 'hsl(38 75% 52% / 0.2)',
                 color: 'hsl(38 80% 62%)',
                 border: '1px solid hsl(38 75% 52% / 0.3)'
               }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'hsl(210 30% 88%)' }}>
              {profile?.display_name}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'hsl(210 20% 50%)' }}>
              {profile?.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start rounded-xl text-xs hover:bg-red-500/10 hover:text-red-400"
          style={{ color: 'hsl(210 20% 48%)' }}
          onClick={signOut}
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />Sair
        </Button>
      </div>
    </aside>
  );
}
