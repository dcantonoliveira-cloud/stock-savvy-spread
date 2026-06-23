import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SupervisorSidebar from './SupervisorSidebar';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clientes',
  '/events': 'Eventos',
  '/events/': 'Evento',
  '/tastings': 'Degustações',
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
};

export default function SupervisorLayout({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();
  const { profile } = useAuth();

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

  return (
    <div className="flex min-h-screen bg-background">
      <SupervisorSidebar />

      <div className="flex-1 ml-[252px] flex flex-col min-h-screen">

        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-8 h-14 bg-card border-b border-border">
          <div>
            {pageTitle && (
              <h2 className="text-[15px] font-semibold text-foreground">{pageTitle}</h2>
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
              <Bell style={{ width: 18, height: 18 }} className="text-muted-foreground" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-2 pl-2 border-l border-border ml-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                   style={{ background: 'hsl(220 70% 30% / 0.12)', color: 'hsl(220 70% 35%)' }}>
                {profile?.display_name?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?'}
              </div>
              <span className="hidden md:block text-[13px] font-medium text-foreground">
                {profile?.display_name?.split(' ')[0]}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
