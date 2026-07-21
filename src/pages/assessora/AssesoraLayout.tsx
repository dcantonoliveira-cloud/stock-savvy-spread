import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CalendarDays, Coffee, LogOut, Menu, X, Heart, KeyRound, Loader2 } from 'lucide-react';
import logoRondello from '@/assets/logo-rondello.png';

export type AssesoraInfo = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  must_change_password: boolean | null;
};

const NAV = [
  { to: '/assessora',            label: 'Eventos',      icon: CalendarDays, end: true },
  { to: '/assessora/degustacoes', label: 'Degustações', icon: Coffee },
];

function ChangePasswordScreen({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [pwd, setPwd]       = useState('');
  const [pwd2, setPwd2]     = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) { setError('Mínimo 8 caracteres'); return; }
    if (pwd !== pwd2) { setError('As senhas não coincidem'); return; }
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: pwd });
    if (err) { setError(err.message); setSaving(false); return; }
    // Mark must_change_password = false
    await (supabase.from('suppliers' as any) as any)
      .update({ must_change_password: false })
      .eq('user_id', user?.id);
    onDone();
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-black text-foreground">Crie sua nova senha</h2>
          <p className="text-sm text-muted-foreground mt-1.5">É seu primeiro acesso. Escolha uma senha pessoal para continuar.</p>
        </div>
        <form onSubmit={submit} className="space-y-3 text-left">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nova senha</label>
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} minLength={8}
              className="w-full mt-1 h-11 px-4 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confirmar senha</label>
            <input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)}
              className="w-full mt-1 h-11 px-4 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
          <button type="submit" disabled={saving || !pwd || !pwd2}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar e entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AssesoraLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo]           = useState<AssesoraInfo | null>(null);
  const [loading, setLoading]     = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase.from('suppliers' as any) as any)
        .select('id, name, email, phone, must_change_password')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setInfo(data as AssesoraInfo);
        setMustChange(data.must_change_password === true);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-border px-4 h-14 flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <img src={logoRondello} alt="Rondello Buffet" className="h-7" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hidden sm:block ml-1">Portal Assessora</span>
        </div>
        <div className="flex items-center gap-3">
          {info?.name && <span className="text-sm font-medium text-foreground hidden sm:block">{info.name}</span>}
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
          <NavLink key={item.to} to={item.to} end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`
            }>
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex w-56 bg-white border-r border-border flex-col shrink-0">
          <div className="px-4 py-5 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-0.5">Olá,</p>
            <p className="text-sm font-semibold text-foreground">{info?.name ?? '…'}</p>
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

        {/* Main */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : mustChange ? (
            <ChangePasswordScreen onDone={() => setMustChange(false)} />
          ) : (
            <Outlet context={{ info }} />
          )}

          <footer className="text-center py-6 text-xs text-muted-foreground/60 px-4">
            Feito com muito amor por Rondello Buffet <Heart className="w-3 h-3 inline text-rose-400 fill-rose-400" />
          </footer>
        </main>
      </div>
    </div>
  );
}
