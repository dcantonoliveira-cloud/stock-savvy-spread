import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import {
  LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle, FileText,
  Users, LogOut, Brain, FolderOpen, ClipboardCheck, Building2, UtensilsCrossed,
  ArrowRightLeft, ChevronDown, Truck, ShoppingCart, Warehouse, ClipboardList,
  AlertTriangle, BookMarked, Tag, UserRound, CalendarDays, Coffee, Bell,
  TrendingUp, DollarSign, Calendar, LibraryBig, MapPin, Sparkles, UserCheck,
  Palette, ScrollText, ChefHat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import logoRondello from '@/assets/logo-rondello.png';

type NavItem = { path: string; label: string; icon: any };
type NavGroup = { label: string; icon: any; items: NavItem[] } | NavItem;

const navStructure: NavGroup[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },

  {
    label: 'CRM', icon: UserRound,
    items: [
      { path: '/clients', label: 'Clientes', icon: UserRound },
      { path: '/events', label: 'Eventos', icon: CalendarDays },
      { path: '/tastings', label: 'Degustações', icon: Coffee },
      { path: '/calendar', label: 'Calendário', icon: Calendar },
    ]
  },

  {
    label: 'Financeiro', icon: DollarSign,
    items: [
      { path: '/financeiro', label: 'Visão Geral', icon: TrendingUp },
    ]
  },

  {
    label: 'Operações', icon: UtensilsCrossed,
    items: [
      { path: '/event-menus', label: 'Cardápios', icon: UtensilsCrossed },
      { path: '/sheets', label: 'Fichas Técnicas', icon: FileText },
      { path: '/shopping-lists', label: 'Compras', icon: ShoppingCart },
    ]
  },

  {
    label: 'Estoque', icon: Package,
    items: [
      { path: '/items', label: 'Estoque Geral', icon: Package },
      { path: '/inventory', label: 'Inventários', icon: ClipboardCheck },
      { path: '/kitchens', label: 'Centros de Custo', icon: Building2 },
      { path: '/fornecedores', label: 'Fornecedores', icon: Truck },
      { path: '/categories', label: 'Insumos', icon: FolderOpen },
      { path: '/tags', label: 'Tags', icon: Tag },
    ]
  },

  {
    label: 'Movimentações', icon: ArrowRightLeft,
    items: [
      { path: '/batch-movement', label: 'Lançamento em Lote', icon: ArrowRightLeft },
      { path: '/entries', label: 'Entradas', icon: ArrowUpCircle },
      { path: '/outputs', label: 'Saídas', icon: ArrowDownCircle },
      { path: '/transfers', label: 'Transferências', icon: ArrowRightLeft },
    ]
  },

  {
    label: 'Materiais', icon: Warehouse,
    items: [
      { path: '/materiais', label: 'Inventário', icon: Package },
      { path: '/materiais/categorias', label: 'Categorias', icon: FolderOpen },
      { path: '/materiais/emprestimos', label: 'Por Evento', icon: ClipboardList },
      { path: '/materiais/lista-base', label: 'Lista Base', icon: BookMarked },
      { path: '/materiais/perdas', label: 'Perdas & Avarias', icon: AlertTriangle },
    ]
  },

  {
    label: 'Cadastros', icon: LibraryBig,
    items: [
      { path: '/cadastros/produtos', label: 'Produtos', icon: ChefHat },
      { path: '/cadastros/saloes', label: 'Salões & Locais', icon: MapPin },
      { path: '/cadastros/tipos-festa', label: 'Tipos de Festa', icon: Sparkles },
      { path: '/cadastros/assessores', label: 'Assessores', icon: UserCheck },
      { path: '/cadastros/decoradores', label: 'Decoradores', icon: Palette },
      { path: '/cadastros/contratos', label: 'Contratos', icon: ScrollText },
    ]
  },

  {
    label: 'Administração', icon: Users,
    items: [
      { path: '/users', label: 'Funcionários', icon: Users },
      { path: '/analysis', label: 'Análise IA', icon: Brain },
      { path: '/notifications', label: 'Notificações', icon: Bell },
    ]
  },
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
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const initials = profile?.display_name
    ?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?';

  return (
    <aside className="fixed left-0 top-0 h-screen w-[252px] glass-sidebar flex flex-col z-50">

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-3">
        <img src={logoRondello} alt="Rondello" className="h-8 object-contain" />
        <div>
          <p className="text-[10px] tracking-[0.18em] uppercase font-semibold"
             style={{ color: 'hsl(220 40% 55%)' }}>
            Sistema de Gestão
          </p>
        </div>
      </div>

      <div className="mx-4 h-px" style={{ background: 'hsl(220 40% 16%)' }} />

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-0.5">
        {navStructure.map((item) => {
          if (!isGroup(item)) {
            const active = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                  active ? 'nav-item-active' : 'hover:bg-white/5'
                }`}
                style={{ color: active ? undefined : 'hsl(220 20% 62%)' }}
              >
                <Icon className="w-4 h-4 shrink-0" />
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
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                  isActiveGroup ? 'bg-white/5' : 'hover:bg-white/5'
                }`}
                style={{ color: isActiveGroup ? 'hsl(220 25% 75%)' : 'hsl(220 15% 55%)' }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown
                  className="w-3.5 h-3.5 transition-transform duration-200"
                  style={{
                    opacity: 0.5,
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                  }}
                />
              </button>

              {isOpen && (
                <div className="mt-0.5 mb-1 ml-3 border-l space-y-0.5 pl-2.5"
                     style={{ borderColor: 'hsl(220 35% 20%)' }}>
                  {item.items.map(sub => {
                    const SubIcon = sub.icon;
                    const active = pathname === sub.path || pathname.startsWith(sub.path + '/');
                    return (
                      <Link
                        key={sub.path}
                        to={sub.path}
                        className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                          active ? 'nav-item-active' : 'hover:bg-white/5'
                        }`}
                        style={{ color: active ? undefined : 'hsl(220 15% 52%)' }}
                      >
                        <SubIcon className="w-3.5 h-3.5 shrink-0" />
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
        <div className="mx-2.5 mb-2 px-3 py-2.5 rounded-lg" style={{ background: 'hsl(220 45% 15%)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'hsl(220 20% 48%)' }}>
              Online · {onlineUsers.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {onlineUsers.map(u => {
              const uInitials = u.display_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
              return (
                <div key={u.user_id} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                       style={{ background: 'hsl(220 55% 28% / 0.6)', color: 'hsl(220 80% 72%)' }}>
                    {uInitials}
                  </div>
                  <span className="text-[11px] truncate" style={{ color: 'hsl(220 20% 58%)' }}>
                    {u.display_name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mx-4 h-px" style={{ background: 'hsl(220 40% 16%)' }} />

      {/* User footer */}
      <div className="p-3 space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
               style={{ background: 'hsl(220 60% 28%)', color: 'hsl(220 80% 82%)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: 'hsl(220 25% 82%)' }}>
              {profile?.display_name}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'hsl(220 15% 48%)' }}>
              {profile?.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start rounded-lg text-[12px] h-8 hover:bg-red-500/10 hover:text-red-400"
          style={{ color: 'hsl(220 15% 45%)' }}
          onClick={signOut}
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sair da conta
        </Button>
      </div>
    </aside>
  );
}
