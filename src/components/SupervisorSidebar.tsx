import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import {
  LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle, FileText,
  Users, LogOut, Brain, FolderOpen, ClipboardCheck, Building2, UtensilsCrossed,
  ArrowRightLeft, ChevronDown, Truck, ShoppingCart, Warehouse, ClipboardList,
  AlertTriangle, BookMarked, Tag, UserRound, CalendarDays, Coffee, Bell,
  TrendingUp, DollarSign, Calendar, LibraryBig, MapPin, Sparkles, UserCheck,
  Palette, ScrollText, ChefHat, ListChecks, Settings, MessageCircle, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import logoRondello from '@/assets/logo-rondello.png';

type NavItem = { path: string; label: string; icon: any };
type NavGroup = { label: string; icon: any; items: NavItem[] } | NavItem;

const navStructure: NavGroup[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },

  { path: '/calendar', label: 'Calendário', icon: Calendar },

  { label: 'Comercial', icon: UserRound, items: [
    { path: '/orcamentos', label: 'Orçamentos', icon: FileText },
    { path: '/events', label: 'Eventos', icon: CalendarDays },
    { path: '/clients', label: 'Clientes', icon: UserRound },
    { path: '/tastings', label: 'Degustações', icon: Coffee },
  ]},

  { path: '/estatisticas', label: 'Estatísticas', icon: BarChart3 },

  { label: 'Financeiro', icon: DollarSign, items: [
    { path: '/financeiro',                  label: 'Visão Geral',      icon: TrendingUp },
    { path: '/financeiro/fluxo',            label: 'Fluxo de Caixa',   icon: ArrowRightLeft },
    { path: '/financeiro/contas-receber',   label: 'Contas a Receber', icon: ArrowDownCircle },
    { path: '/financeiro/contas-pagar',     label: 'Contas a Pagar',   icon: ArrowUpCircle },
    { path: '/financeiro/cartoes',          label: 'Cartões',          icon: Tag },
    { path: '/financeiro/dre',             label: 'DRE',              icon: FileText },
    { path: '/financeiro/relatorios',       label: 'Relatórios',       icon: BookMarked },
  ]},

  { label: 'Operações', icon: UtensilsCrossed, items: [
    { path: '/event-menus', label: 'Cardápios', icon: UtensilsCrossed },
    { path: '/sheets', label: 'Fichas Técnicas', icon: FileText },
    { path: '/shopping-lists', label: 'Compras', icon: ShoppingCart },
  ]},

  { label: 'Estoque', icon: Package, items: [
    { path: '/items', label: 'Estoque Geral', icon: Package },
    { path: '/inventory', label: 'Inventários', icon: ClipboardCheck },
    { path: '/entries', label: 'Entradas', icon: ArrowUpCircle },
    { path: '/outputs', label: 'Saídas', icon: ArrowDownCircle },
    { path: '/batch-movement', label: 'Em Lote', icon: ArrowRightLeft },
    { path: '/transfers', label: 'Transferências', icon: ArrowRightLeft },
    { path: '/fornecedores', label: 'Fornecedores', icon: Truck },
    { path: '/categories', label: 'Insumos', icon: FolderOpen },
    { path: '/tags', label: 'Tags', icon: Tag },
    { path: '/kitchens', label: 'Centros de Custo', icon: Building2 },
  ]},

  { label: 'Materiais', icon: Warehouse, items: [
    { path: '/materiais', label: 'Inventário', icon: Package },
    { path: '/materiais/emprestimos', label: 'Por Evento', icon: ClipboardList },
    { path: '/materiais/lista-base', label: 'Lista Base', icon: BookMarked },
    { path: '/materiais/perdas', label: 'Perdas & Avarias', icon: AlertTriangle },
    { path: '/materiais/categorias', label: 'Categorias', icon: FolderOpen },
  ]},

  { label: 'Cadastros', icon: LibraryBig, items: [
    { path: '/cadastros/assessores', label: 'Assessores', icon: UserCheck },
    { path: '/cadastros/checklists', label: 'Checklists', icon: ListChecks },
    { path: '/cadastros/contratos', label: 'Contratos', icon: ScrollText },
    { path: '/cadastros/decoradores', label: 'Decoradores', icon: Palette },
    { path: '/cadastros/mensagens', label: 'Mensagens WhatsApp', icon: MessageCircle },
    { path: '/cadastros/produtos', label: 'Produtos', icon: ChefHat },
    { path: '/cadastros/saloes', label: 'Salões & Locais', icon: MapPin },
    { path: '/cadastros/tipos-festa', label: 'Tipos de Festa', icon: Sparkles },
  ]},

  { label: 'Administração', icon: Users, items: [
    { path: '/users', label: 'Funcionários', icon: Users },
    { path: '/holerites', label: 'Holerites', icon: FileText },
    { path: '/analysis', label: 'Análise IA', icon: Brain },
    { path: '/notifications', label: 'Notificações', icon: Bell },
    { path: '/configuracoes', label: 'Configurações', icon: Settings },
  ]},
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
      if (isGroup(item) && item.items.some(i => pathname === i.path || pathname.startsWith(i.path + '/')))
        open.add(item.label);
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
    ?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?';

  return (
    <aside className="fixed left-0 top-0 h-screen glass-sidebar flex flex-col z-50 w-[180px] xl:w-[210px]">

      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
        <img src={logoRondello} alt="Rondello" className="h-7 object-contain shrink-0" />
        <p className="text-[9px] tracking-[0.15em] uppercase font-semibold hidden xl:block"
           style={{ color: 'hsl(220 40% 55%)' }}>
          Sistema de Gestão
        </p>
      </div>

      <div className="mx-3 h-px" style={{ background: 'hsl(220 40% 16%)' }} />

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {navStructure.map((item) => {
          if (!isGroup(item)) {
            const active = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${active ? 'nav-item-active' : 'hover:bg-white/5'}`}
                style={{ color: active ? undefined : 'hsl(220 20% 62%)' }}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          }

          const Icon = item.icon;
          const isOpen = openGroups.has(item.label);
          const isActiveGroup = item.items.some(i => pathname === i.path || pathname.startsWith(i.path + '/'));

          return (
            <div key={item.label}>
              <button onClick={() => toggleGroup(item.label)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${isActiveGroup ? 'bg-white/5' : 'hover:bg-white/5'}`}
                style={{ color: isActiveGroup ? 'hsl(220 25% 75%)' : 'hsl(220 15% 55%)' }}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left truncate">{item.label}</span>
                <ChevronDown className="w-3 h-3 shrink-0 transition-transform duration-200"
                  style={{ opacity: 0.5, transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
              </button>

              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: isOpen ? '1fr' : '0fr',
                  transition: 'grid-template-rows 220ms cubic-bezier(0.4,0,0.2,1)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div className="mt-0.5 mb-1 ml-3 border-l space-y-0.5 pl-2"
                       style={{ borderColor: 'hsl(220 35% 20%)' }}>
                    {item.items.map(sub => {
                      const SubIcon = sub.icon;
                      const active = pathname === sub.path || (
                        pathname.startsWith(sub.path + '/') &&
                        !item.items.some(sib => sib.path !== sub.path && (pathname === sib.path || pathname.startsWith(sib.path + '/')))
                      );
                      return (
                        <Link key={sub.path} to={sub.path}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${active ? 'nav-item-active' : 'hover:bg-white/5'}`}
                          style={{ color: active ? undefined : 'hsl(220 15% 52%)' }}>
                          <SubIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Online users */}
      {onlineUsers.length > 0 && (
        <div className="mx-2 mb-2 px-3 py-2 rounded-lg" style={{ background: 'hsl(220 45% 15%)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: 'hsl(220 20% 48%)' }}>
              Online · {onlineUsers.length}
            </span>
          </div>
          <div className="space-y-1">
            {onlineUsers.map(u => {
              const uInitials = u.display_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
              return (
                <div key={u.user_id} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                       style={{ background: 'hsl(220 55% 28% / 0.6)', color: 'hsl(220 80% 72%)' }}>
                    {uInitials}
                  </div>
                  <span className="text-[11px] truncate" style={{ color: 'hsl(220 20% 58%)' }}>{u.display_name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mx-3 h-px" style={{ background: 'hsl(220 40% 16%)' }} />

      {/* User footer */}
      <div className="p-2 space-y-1">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
               style={{ background: 'hsl(220 60% 28%)', color: 'hsl(220 80% 82%)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate" style={{ color: 'hsl(220 25% 82%)' }}>{profile?.display_name}</p>
            <p className="text-[10px] truncate" style={{ color: 'hsl(220 15% 48%)' }}>{profile?.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}
          className="w-full justify-start rounded-lg text-[12px] h-8 hover:bg-red-500/10 hover:text-red-400"
          style={{ color: 'hsl(220 15% 45%)' }}>
          <LogOut className="w-3.5 h-3.5 mr-2 shrink-0" />
          <span className="truncate">Sair da conta</span>
        </Button>
      </div>
    </aside>
  );
}
