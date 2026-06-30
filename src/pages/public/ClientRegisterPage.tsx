import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react';
import logoRondello from '@/assets/logo-rondello.png';

export default function ClientRegisterPage() {
  const [params] = useSearchParams();
  const navigate    = useNavigate();
  const token       = params.get('token') ?? '';

  const [invite, setInvite] = useState<{ id: string; event_name: string; client_name: string } | null>(null);
  const [loading, setLoading]   = useState(true);
  const [invalid, setInvalid]   = useState(false);
  const [alreadyUsed, setAlreadyUsed] = useState(false);

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [pass,     setPass]     = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    (async () => {
      const { data } = await (supabase.from as any)('client_portal_access')
        .select('id, user_id, events(event_name, clients(name))')
        .eq('invite_token', token)
        .maybeSingle();
      if (!data) { setInvalid(true); setLoading(false); return; }
      if (data.user_id) { setAlreadyUsed(true); setLoading(false); return; }
      const eventName   = (data.events as any)?.event_name ?? 'seu evento';
      const clientName  = (data.events as any)?.clients?.name ?? '';
      setInvite({ id: data.id, event_name: eventName, client_name: clientName });
      if (clientName) setName(clientName);
      setLoading(false);
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pass || pass.length < 6) { setError('Preencha todos os campos. A senha precisa ter ao menos 6 caracteres.'); return; }
    setSubmitting(true);
    setError('');

    // Cria conta no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
      options: { data: { display_name: name.trim() || undefined } },
    });
    if (authError || !authData.user) {
      setError(authError?.message ?? 'Erro ao criar conta. Tente novamente.');
      setSubmitting(false);
      return;
    }

    // Vincula o user_id ao portal de acesso
    const { error: linkError } = await (supabase.from as any)('client_portal_access')
      .update({ user_id: authData.user.id })
      .eq('id', invite!.id);

    if (linkError) {
      setError('Conta criada mas erro ao vincular ao evento. Contate o buffet.');
      setSubmitting(false);
      return;
    }

    setDone(true);
    setTimeout(() => navigate('/portal'), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <img src={logoRondello} alt="Rondello" className="h-12 mx-auto mb-6" />
          <p className="text-lg font-semibold text-foreground">Link inválido</p>
          <p className="text-sm text-muted-foreground mt-2">Este link de convite não existe ou expirou. Solicite um novo ao buffet.</p>
        </div>
      </div>
    );
  }

  if (alreadyUsed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <img src={logoRondello} alt="Rondello" className="h-12 mx-auto mb-6" />
          <p className="text-lg font-semibold text-foreground">Cadastro já realizado</p>
          <p className="text-sm text-muted-foreground mt-2">Você já criou sua conta com este convite.</p>
          <button onClick={() => navigate('/login')}
            className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Fazer login
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground">Conta criada!</p>
          <p className="text-sm text-muted-foreground mt-1">Redirecionando para o portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logoRondello} alt="Rondello" className="h-14 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground">Criar sua conta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Portal do cliente — <span className="font-medium text-foreground">{invite?.event_name}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full h-11 px-4 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Seu nome completo" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full h-11 px-4 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="seu@email.com" required />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Senha</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)}
                className="w-full h-11 px-4 pr-11 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Mínimo 6 caracteres" required />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Criando conta…' : 'Criar conta e acessar portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
