import { useEffect, useState, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CalendarDays, DollarSign, FolderOpen, Info, LogOut, Menu, X, Heart, KeyRound, Loader2 } from 'lucide-react';
import logoRondello from '@/assets/logo-rondello.png';

export type PortalEvent = {
  id: string;
  event_name: string | null;
  event_date: string | null;
  event_type: string | null;
  status: string;
  guest_count: number | null;
  children_50_pct: number | null;
  non_paying_guests: number | null;
  total_value: number | null;
  price_per_person: number | null;
  location_text: string | null;
  ceremony_time: string | null;
  additional_hours: number | null;
  professional_count: number | null;
  professional_meal_value: number | null;
  professional_meal_type: string | null;
  organizer: string | null;
  decorator: string | null;
  pastry_chef: string | null;
  band_dj: string | null;
  photo_video: string | null;
  bartender: string | null;
  other_professionals: string | null;
  clients: { name: string | null; phone: string | null } | null;
};

export type PortalContextType = {
  event: PortalEvent | null;
  portalId: string | null;
};

export async function loadPortalEvent(userId: string): Promise<PortalContextType> {
  const { data } = await (supabase.from as any)('client_portal_access')
    .select(`id, event_id, events(
      id, event_name, event_date, event_type, status,
      guest_count, children_50_pct, non_paying_guests,
      total_value, price_per_person, location_text,
      ceremony_time, additional_hours,
      professional_count, professional_meal_value, professional_meal_type,
      organizer, decorator, pastry_chef, band_dj, photo_video, bartender, other_professionals,
      clients(name, phone)
    )`)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return { event: null, portalId: null };
  return { event: data.events as PortalEvent, portalId: data.id };
}

const NAV = [
  { to: '/portal',              label: 'Início',       icon: CalendarDays, end: true },
  { to: '/portal/financeiro',   label: 'Financeiro',   icon: DollarSign },
  { to: '/portal/arquivos',     label: 'Arquivos',     icon: FolderOpen },
  { to: '/portal/informacoes',  label: 'Informações',  icon: Info },
];

function EnterCodeScreen({ onLinked }: { onLinked: () => void }) {
  const [code, setCode]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSaving(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: fnErr } = await (supabase.rpc as any)('link_portal_by_code', { p_code: code.trim().toUpperCase() });
    setSaving(false);
    if (fnErr) {
      console.error('[portal] link_portal_by_code error:', fnErr);
      setError(`Erro técnico: ${fnErr.message}`);
      return;
    }
    if (!data) {
      setError('Código inválido ou já utilizado. Verifique com o buffet.');
      return;
    }
    onLinked();
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-black text-foreground">Insira seu código de acesso</h2>
          <p className="text-sm text-muted-foreground mt-1.5">O buffet enviou um código para você. Digite abaixo para vincular seu evento.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: AB12CD34EF"
            maxLength={16}
            className="w-full h-12 px-4 text-center text-lg font-bold tracking-widest border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
          />
          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={saving || !code.trim()}
            className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Verificando…' : 'Acessar portal'}
          </button>
        </form>
      </div>
    </div>
  );
}

const PAGE_MAP: Record<string, string> = {
  '/portal':            'inicio',
  '/portal/financeiro': 'financeiro',
  '/portal/arquivos':   'arquivos',
  '/portal/informacoes':'informacoes',
};

export default function ClientPortalLayout() {
  const { user, signOut } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [ctx, setCtx] = useState<PortalContextType>({ event: null, portalId: null });
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadPortalEvent(user.id).then(c => { setCtx(c); setLoading(false); });
  }, [user]);

  // Loga acesso a cada página visitada
  const logAccess = useCallback((path: string) => {
    const page = PAGE_MAP[path];
    if (!page || !user) return;
    (supabase.rpc as any)('log_portal_access', { p_page: page }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (ctx.event) logAccess(location.pathname);
  }, [location.pathname, ctx.event]);

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  const clientName = ctx.event?.clients?.name ?? '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-border px-4 h-14 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <img src={logoRondello} alt="Rondello Buffet" className="h-7" />
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

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border flex items-stretch">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop only */}
        <aside className="hidden lg:flex w-56 bg-white border-r border-border flex-col shrink-0">
          <div className="px-4 py-5 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Evento</p>
            <p className="text-sm font-semibold text-foreground line-clamp-2">{ctx.event?.event_name ?? '—'}</p>
            {ctx.event?.event_date && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(ctx.event.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {NAV.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }>
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !ctx.event ? (
            <EnterCodeScreen onLinked={async () => {
              setLoading(true);
              loadPortalEvent(user!.id).then(c => { setCtx(c); setLoading(false); });
            }} />
          ) : (
            <Outlet context={ctx} />
          )}

          {/* Footer */}
          <footer className="text-center py-6 text-xs text-muted-foreground/60 px-4">
            Feito com muito amor por Rondello Buffet <Heart className="w-3 h-3 inline text-rose-400 fill-rose-400" />
          </footer>
        </main>
      </div>
    </div>
  );
}
