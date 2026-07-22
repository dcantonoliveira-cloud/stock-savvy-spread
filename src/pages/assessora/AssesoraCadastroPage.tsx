import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import logoRondello from '@/assets/logo-rondello.png';

export default function AssesoraCadastroPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [code, setCode]         = useState(params.get('code') ?? '');
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [codeValid, setCodeValid]       = useState<boolean | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  const [email, setEmail]       = useState('');
  const [pwd, setPwd]           = useState('');
  const [pwd2, setPwd2]         = useState('');
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);

  // Validate code when it changes (debounced)
  useEffect(() => {
    if (code.length < 6) { setCodeValid(null); setSupplierName(null); return; }
    setCheckingCode(true);
    const t = setTimeout(async () => {
      const { data } = await (supabase.from('suppliers' as any) as any)
        .select('name')
        .eq('invite_code', code.trim().toUpperCase())
        .is('user_id', null)
        .maybeSingle();
      setCodeValid(!!data);
      setSupplierName(data?.name ?? null);
      setCheckingCode(false);
    }, 500);
    return () => clearTimeout(t);
  }, [code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!codeValid) { setError('Código inválido'); return; }
    if (pwd.length < 8) { setError('A senha deve ter pelo menos 8 caracteres'); return; }
    if (pwd !== pwd2) { setError('As senhas não coincidem'); return; }

    setSubmitting(true);
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-assessor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        action: 'self_register',
        invite_code: code.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        password: pwd,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Erro ao criar conta'); setSubmitting(false); return; }

    // Sign in automatically
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pwd,
    });
    if (signInErr) { setError('Conta criada! Faça login com seu e-mail e senha.'); setSubmitting(false); return; }

    setDone(true);
    setTimeout(() => navigate('/assessora', { replace: true }), 1500);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          <p className="text-lg font-bold text-foreground">Conta criada!</p>
          <p className="text-sm text-muted-foreground">Redirecionando para o portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <img src={logoRondello} alt="Rondello Buffet" className="h-16 mx-auto" />
          <div>
            <h1 className="text-xl font-black text-foreground">Criar sua conta</h1>
            <p className="text-sm text-muted-foreground mt-1">Portal de Assessoria · Rondello Buffet</p>
          </div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-border p-6 space-y-4">
          {/* Code */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Código de convite
            </label>
            <div className="relative">
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="XXXXXXXX"
                maxLength={12}
                className="w-full h-11 px-4 pr-10 text-sm font-mono tracking-widest border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checkingCode && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {!checkingCode && codeValid === true && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {!checkingCode && codeValid === false && <span className="text-red-500 text-xs font-bold">✗</span>}
              </div>
            </div>
            {supplierName && (
              <p className="text-xs text-emerald-600 mt-1.5 font-medium">Olá, {supplierName}! 👋</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Seu e-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
              required
              className="w-full h-11 px-4 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Senha <span className="font-normal normal-case">(mínimo 8 caracteres)</span>
            </label>
            <input
              type="password"
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              required
              className="w-full h-11 px-4 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Confirmar senha
            </label>
            <input
              type="password"
              value={pwd2}
              onChange={e => setPwd2(e.target.value)}
              required
              className="w-full h-11 px-4 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !codeValid || !email || !pwd || !pwd2}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {submitting ? 'Criando conta…' : 'Criar minha conta'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Já tem conta?{' '}
          <a href="/login" className="text-primary hover:underline font-medium">Fazer login</a>
        </p>
      </div>
    </div>
  );
}
