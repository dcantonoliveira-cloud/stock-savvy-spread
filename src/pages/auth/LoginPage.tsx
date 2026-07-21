import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LogIn, UserPlus, ChefHat, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Digite seu email'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?type=recovery`,
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
    if (password.length < 6) { toast.error('Senha deve ter no mínimo 6 caracteres'); return; }
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
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        toast.error('Este email já está cadastrado. Faça login.');
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    if (data.session) {
      // Email confirmation disabled — user is logged in immediately
      toast.success('Conta criada com sucesso!');
    } else {
      // Email confirmation required
      toast.success('Verifique seu email para confirmar o cadastro e depois faça login.', { duration: 6000 });
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
            <p className="text-xs text-muted-foreground mt-1 tracking-[0.2em] uppercase font-medium">Sistema de Gestão</p>
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
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="h-11 rounded-xl pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
          <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-sm" disabled={loading}>
            {isForgotPassword ? <KeyRound className="w-4 h-4 mr-2" /> : isSignUp ? <UserPlus className="w-4 h-4 mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
            {loading ? 'Aguarde...' : isForgotPassword ? 'Enviar link de redefinição' : isSignUp ? 'Criar Conta' : 'Entrar'}
          </Button>
          {!isForgotPassword && (
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsForgotPassword(true)}
            >
              Esqueci minha senha
            </button>
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

      </div>
    </div>
  );
}
