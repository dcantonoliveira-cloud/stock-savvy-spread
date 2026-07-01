import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FileText, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Payslip {
  id: string; title: string; status: string; reference_month: string; published_at: string | null;
  electronic_signatures?: { signed_at_utc: string }[];
}

export default function MyPayslipsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'signed'>('pending');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('payslips' as any)
        .select('id, title, status, reference_month, published_at, electronic_signatures(signed_at_utc)')
        .eq('employee_id', user?.id)
        .in('status', ['published', 'signed'])
        .order('reference_month', { ascending: false });
      setPayslips((data ?? []) as unknown as Payslip[]);
      setLoading(false);
    };
    if (user) load();
  }, [user]);

  const pending = payslips.filter(p => p.status === 'published');
  const signed  = payslips.filter(p => p.status === 'signed');
  const list    = tab === 'pending' ? pending : signed;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Meus Holerites</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visualize e assine seus holerites</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border">
        <button onClick={() => setTab('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'pending' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
          <Clock className="w-3.5 h-3.5" />
          Pendentes
          {pending.length > 0 && (
            <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pending.length}</span>
          )}
        </button>
        <button onClick={() => setTab('signed')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'signed' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          Assinados ({signed.length})
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-border rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-muted/40 rounded w-1/2 mb-2" />
              <div className="h-3 bg-muted/30 rounded w-1/3" />
            </div>
          ))
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              {tab === 'pending' ? 'Nenhum holerite pendente.' : 'Nenhum holerite assinado ainda.'}
            </p>
          </div>
        ) : list.map(p => {
          const sig = p.electronic_signatures?.[0];
          return (
            <button
              key={p.id}
              onClick={() => navigate(`/meus-holerites/${p.id}`)}
              className="w-full bg-white border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary/40 hover:shadow-sm transition-all text-left">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${p.status === 'signed' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  {p.status === 'signed'
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    : <Clock className="w-5 h-5 text-amber-600" />}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{p.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.status === 'signed' && sig
                      ? `Assinado em ${format(new Date(sig.signed_at_utc), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                      : `Publicado em ${p.published_at ? format(new Date(p.published_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {p.status === 'published' && (
                  <span className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    Assinar
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
