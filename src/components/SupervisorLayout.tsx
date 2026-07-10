import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SupervisorSidebar from './SupervisorSidebar';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Search, Receipt, LogOut, ChevronDown, Settings, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/orcamentos': 'Orçamentos',
  '/orcamentos/': 'Orçamento',
  '/clients': 'Clientes',
  '/events': 'Eventos',
  '/events/': 'Evento',
  '/tastings': 'Degustações',
  '/tastings/': 'Degustação',
  '/calendar': 'Calendário',
  '/financeiro': 'Financeiro',
  '/items': 'Estoque Geral',
  '/inventory': 'Inventários',
  '/kitchens': 'Centros de Custo',
  '/fornecedores': 'Fornecedores',
  '/categories': 'Insumos',
  '/tags': 'Tags',
  '/sheets': 'Fichas Técnicas',
  '/event-menus': 'Cardápios de Eventos',
  '/shopping-lists': 'Listas de Compras',
  '/entries': 'Entradas',
  '/outputs': 'Saídas',
  '/transfers': 'Transferências',
  '/batch-movement': 'Lançamento em Lote',
  '/materiais': 'Materiais',
  '/users': 'Funcionários',
  '/analysis': 'Análise IA',
  '/notifications': 'Notificações',
  '/comparison': 'Comparativo',
  '/cadastros/produtos': 'Produtos',
  '/cadastros/saloes': 'Salões & Locais',
  '/cadastros/tipos-festa': 'Tipos de Festa',
  '/cadastros/assessores': 'Assessores',
  '/cadastros/decoradores': 'Decoradores',
  '/cadastros/contratos': 'Contratos',
  '/cadastros/checklists': 'Checklists',
  '/configuracoes': 'Configurações',
  '/cadastros/notificacoes': 'Grupos de Notificação',
};

export default function SupervisorLayout({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const [urgentAlerts, setUrgentAlerts] = useState(0);
  const [topUrgent, setTopUrgent] = useState<string | null>(null);
  const [pendingPayslips, setPendingPayslips] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, user, permissions } = useAuth();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from('payslips' as any)
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', user.id)
        .eq('status', 'published');
      setPendingPayslips(count ?? 0);
    };
    load();
  }, [user]);

  const pageTitle = Object.entries(PAGE_TITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([p]) => pathname === p || pathname.startsWith(p + '/'))
    ?.[1] ?? '';

  useEffect(() => {
    const load = async () => {
      const { count } = await supabase
        .from('app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false as any);
      setUnread(count || 0);
    };
    load();
    const channel = supabase
      .channel('notifications-layout')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data, count } = await (supabase as any)
        .from('smart_alerts')
        .select('title', { count: 'exact' })
        .is('resolved_at', null)
        .eq('severity', 'urgent')
        .order('created_at', { ascending: false })
        .limit(1);
      setUrgentAlerts(count ?? 0);
      setTopUrgent(data?.[0]?.title ?? null);
    };
    load();
    const ch = supabase
      .channel('smart-alerts-layout')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smart_alerts' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <SupervisorSidebar />

      <div className="flex-1 flex flex-col min-h-screen ml-[180px] xl:ml-[210px]">

        {/* Urgent alert banner */}
        {urgentAlerts > 0 && topUrgent && (
          <Link
            to="/notifications"
            className="flex items-center gap-3 px-4 lg:px-6 xl:px-8 py-2.5 bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
            <span className="truncate">{urgentAlerts > 1 ? `${urgentAlerts} alertas urgentes — ` : ''}{topUrgent}</span>
            <span className="ml-auto shrink-0 text-xs opacity-80">Ver alertas →</span>
          </Link>
        )}

        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-4 lg:px-6 xl:px-8 h-14 bg-card border-b border-border">
          <div>
            {pageTitle && (
              <h2 className="text-[19px] font-bold text-foreground">{pageTitle}</h2>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent">
              <Search className="w-3.5 h-3.5" />
              <span className="text-[13px]">Buscar...</span>
              <kbd className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono">⌘K</kbd>
            </button>

            <Link
              to="/notifications"
              className="relative p-2 rounded-lg transition-colors hover:bg-accent"
              title="Notificações"
            >
              <Bell
                style={{ width: 18, height: 18 }}
                className={urgentAlerts > 0 ? 'text-red-500 animate-[bell_0.8s_ease-in-out_infinite]' : 'text-muted-foreground'}
              />
              {urgentAlerts > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white animate-pulse">
                  {urgentAlerts > 9 ? '9+' : urgentAlerts}
                </span>
              ) : unread > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </Link>

            <div className="relative pl-2 border-l border-border ml-1" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent transition-colors">
                <div className="relative">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                       style={{ background: 'hsl(220 70% 30% / 0.12)', color: 'hsl(220 70% 35%)' }}>
                    {profile?.display_name?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?'}
                  </div>
                  {pendingPayslips > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                      {pendingPayslips > 9 ? '9+' : pendingPayslips}
                    </span>
                  )}
                </div>
                <span className="hidden md:block text-[13px] font-medium text-foreground">
                  {profile?.display_name?.split(' ')[0]}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-border rounded-xl shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="text-xs font-medium text-foreground truncate">{profile?.display_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/meus-holerites'); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                    <Receipt className="w-4 h-4 text-muted-foreground" />
                    Meus Holerites
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/meu-perfil'); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    Meu Perfil
                  </button>
                  <div className="border-t border-border mt-1 pt-1">
                    <button
                      onClick={() => { setMenuOpen(false); signOut(); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-red-50 transition-colors">
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 xl:p-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
