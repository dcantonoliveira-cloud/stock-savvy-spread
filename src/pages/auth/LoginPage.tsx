import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LogIn, UserPlus, ChefHat, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Digite seu email'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) toast.error('Erro ao enviar email: ' + error.message);
    else { toast.success('Email de redefinição enviado! Verifique sua caixa de entrada.'); setIsForgotPassword(false); }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Preencha email e senha'); return; }
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) toast.error('Email ou senha incorretos');
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name.trim()) { toast.error('Preencha todos os campos'); return; }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from('user_roles').insert({ user_id: data.user.id, role: 'supervisor' as const });
      toast.success('Conta criada! Faça login.');
      setIsSignUp(false);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-8 relative z-10">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse-glow">
            <ChefHat className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold gold-text tracking-wide">RONDELLO</h1>
            <p className="text-xs text-muted-foreground mt-1 tracking-[0.2em] uppercase font-medium">Controle de Estoque</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={isForgotPassword ? handleForgotPassword : isSignUp ? handleSignUp : handleLogin} className="glass-card rounded-2xl p-6 space-y-4 shadow-xl">
          {isSignUp && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="h-11 rounded-xl" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11 rounded-xl" />
          </div>
          {!isForgotPassword && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Senha</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="h-11 rounded-xl" />
            </div>
          )}
          <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-sm" disabled={loading}>
            {isForgotPassword ? <KeyRound className="w-4 h-4 mr-2" /> : isSignUp ? <UserPlus className="w-4 h-4 mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
            {loading ? 'Aguarde...' : isForgotPassword ? 'Enviar link de redefinição' : isSignUp ? 'Criar Conta' : 'Entrar'}
          </Button>
          {!isForgotPassword && (
            <>
              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
                onClick={() => { setIsSignUp(!isSignUp); }}
              >
                {isSignUp ? 'Já tem conta? Entrar' : 'Primeiro acesso? Criar conta'}
              </button>
              {!isSignUp && (
                <button
                  type="button"
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsForgotPassword(true)}
                >
                  Esqueci minha senha
                </button>
              )}
            </>
          )}
          {isForgotPassword && (
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              onClick={() => setIsForgotPassword(false)}
            >
              Voltar ao login
            </button>
          )}
        </form>

        {/* Google */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
            <span className="bg-background px-3 text-muted-foreground font-medium">ou</span>
          </div>
        </div>

        <Button variant="outline" className="w-full h-11 rounded-xl font-medium text-sm" onClick={() => signInWithGoogle()}>
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Entrar com Google
        </Button>
      </div>
    </div>
  );
}
