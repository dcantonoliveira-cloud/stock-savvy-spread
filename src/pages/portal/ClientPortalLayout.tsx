import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CalendarDays, DollarSign, FileText, FolderOpen, LogOut, Menu, X } from 'lucide-react';
import logoRondello from '@/assets/logo-rondello.png';

export type PortalEvent = {
  id: string;
  event_name: string | null;
  event_date: string | null;
  event_type: string | null;
  status: string;
  guest_count: number | null;
  total_value: number | null;
  location_text: string | null;
  clients: { name: string | null; phone: string | null } | null;
};

export type PortalContextType = {
  event: PortalEvent | null;
  portalId: string | null;
};

export async function loadPortalEvent(userId: string): Promise<PortalContextType> {
  const { data } = await (supabase.from as any)('client_portal_access')
    .select('id, event_id, events(id, event_name, event_date, event_type, status, guest_count, total_value, location_text, clients(name, phone))')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return { event: null, portalId: null };
  return { event: data.events as PortalEvent, portalId: data.id };
}

const NAV = [
  { to: '/portal',          label: 'Meu Evento',  icon: CalendarDays, end: true },
  { to: '/portal/financeiro', label: 'Financeiro', icon: DollarSign },
  { to: '/portal/contrato',   label: 'Contrato',   icon: FileText },
  { to: '/portal/arquivos',   label: 'Arquivos',   icon: FolderOpen },
];

export default function ClientPortalLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<PortalContextType>({ event: null, portalId: null });
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadPortalEvent(user.id).then(c => { setCtx(c); setLoading(false); });
  }, [user]);

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  const eventName = ctx.event?.event_name ?? 'Portal do Cliente';
  const clientName = ctx.event?.clients?.name ?? '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-border px-4 h-14 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <img src={logoRondello} alt="Rondello" className="h-7" />
        </div>
        <div className="flex items-center gap-3">
          {clientName && <span className="text-sm font-medium text-foreground hidden sm:block">{clientName}</span>}
          <button onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Sair</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
        <aside className={`
          fixed md:static inset-y-0 left-0 z-20 w-56 bg-white border-r border-border flex flex-col
          transform transition-transform md:transform-none
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `} style={{ top: 56 }}>
          <div className="px-4 py-5 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Evento</p>
            <p className="text-sm font-semibold text-foreground line-clamp-2">{eventName}</p>
            {ctx.event?.event_date && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(ctx.event.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {NAV.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }>
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Overlay mobile */}
        {mobileOpen && (
          <div className="fixed inset-0 z-10 bg-black/20 md:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !ctx.event ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">Nenhum evento vinculado à sua conta.</p>
            </div>
          ) : (
            <Outlet context={ctx} />
          )}
        </main>
      </div>
    </div>
  );
}
