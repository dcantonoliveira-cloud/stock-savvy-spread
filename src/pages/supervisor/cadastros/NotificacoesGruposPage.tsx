import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { DollarSign, CalendarDays, FileText, Stethoscope, X, Plus, Loader2 } from 'lucide-react';

type GroupType = 'financeiro' | 'eventos' | 'holerites' | 'exames';

interface Profile { user_id: string; display_name: string; phone: string | null; }
interface Member { id: string; user_id: string; display_name: string; phone: string | null; }
interface Group { id: string; type: GroupType; members: Member[]; }

const GROUP_META: Record<GroupType, { label: string; desc: string; icon: React.ReactNode; color: string }> = {
  financeiro: { label: 'Financeiras', desc: 'Pagamentos pendentes com menos de 15 dias para o evento', icon: <DollarSign className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  eventos:    { label: 'Eventos',     desc: 'Alterações em cardápio ou ficha técnica com menos de 15 dias', icon: <CalendarDays className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  holerites:  { label: 'Holerites',   desc: 'Holerites publicados não assinados após 2 dias', icon: <FileText className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  exames:     { label: 'Exames de Rotina', desc: 'Alertas de exames periódicos (em breve)', icon: <Stethoscope className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

const ALL_TYPES: GroupType[] = ['financeiro', 'eventos', 'holerites', 'exames'];

export default function NotificacoesGruposPage() {
  const { profile: myProfile } = useAuth();
  const [groups, setGroups]     = useState<Record<GroupType, Group | null>>({ financeiro: null, eventos: null, holerites: null, exames: null });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<GroupType | null>(null);
  const [adding, setAdding]     = useState<GroupType | null>(null);

  useEffect(() => {
    if (myProfile?.company_id) load();
  }, [myProfile?.company_id]);

  async function load() {
    const companyId = myProfile?.company_id;

    // Buscar user_ids com role supervisor ou employee nessa empresa
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['supervisor', 'employee'] as any[]);

    const eligibleIds = (roleRows ?? []).map((r: any) => r.user_id);

    const [{ data: grpData }, { data: profData }] = await Promise.all([
      (supabase as any).from('notification_groups').select('id, type, notification_group_members(id, user_id, profiles(display_name, phone))'),
      supabase
        .from('profiles')
        .select('user_id, display_name, phone')
        .eq('company_id', companyId as any)
        .in('user_id', eligibleIds.length > 0 ? eligibleIds : ['00000000-0000-0000-0000-000000000000'])
        .order('display_name'),
    ]);

    const map: Record<GroupType, Group | null> = { financeiro: null, eventos: null, holerites: null, exames: null };
    (grpData ?? []).forEach((g: any) => {
      map[g.type as GroupType] = {
        id: g.id,
        type: g.type,
        members: (g.notification_group_members ?? []).map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          display_name: m.profiles?.display_name ?? 'Usuário',
          phone: m.profiles?.phone ?? null,
        })),
      };
    });

    setGroups(map);
    setProfiles((profData ?? []) as Profile[]);
    setLoading(false);
  }

  async function ensureGroup(type: GroupType): Promise<string> {
    if (groups[type]?.id) return groups[type]!.id;
    const { data: company } = await supabase.from('companies').select('id').limit(1).single();
    const { data, error } = await (supabase as any).from('notification_groups').insert({ type, company_id: company?.id }).select('id').single();
    if (error) throw new Error(error.message);
    return data.id;
  }

  async function addMember(type: GroupType, userId: string) {
    setSaving(type);
    try {
      const groupId = await ensureGroup(type);
      const { error } = await (supabase as any).from('notification_group_members').insert({ group_id: groupId, user_id: userId });
      if (error) { toast.error('Erro ao adicionar: ' + error.message); return; }
      toast.success('Membro adicionado');
      setAdding(null);
      await load();
    } finally { setSaving(null); }
  }

  async function removeMember(memberId: string, type: GroupType) {
    const { error } = await (supabase as any).from('notification_group_members').delete().eq('id', memberId);
    if (error) { toast.error('Erro ao remover'); return; }
    toast.success('Removido');
    setGroups(prev => ({
      ...prev,
      [type]: prev[type] ? { ...prev[type]!, members: prev[type]!.members.filter(m => m.id !== memberId) } : null,
    }));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">Grupos de Notificação</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Defina quem recebe alertas por WhatsApp e push quando cada situação ocorrer.
        </p>
      </div>

      {ALL_TYPES.map(type => {
        const meta    = GROUP_META[type];
        const group   = groups[type];
        const members = group?.members ?? [];
        const available = profiles.filter(p => !members.some(m => m.user_id === p.user_id));

        return (
          <div key={type} className="bg-white border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className={`flex items-center gap-3 px-5 py-4 border-b border-border`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${meta.color}`}>
                {meta.icon}
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground text-[15px]">{meta.label}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
              </div>
            </div>

            {/* Members */}
            <div className="px-5 py-4 space-y-2">
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground/60 italic">Nenhum membro adicionado.</p>
              )}
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
                      {m.display_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.display_name}</p>
                      {m.phone
                        ? <p className="text-[11px] text-muted-foreground">{m.phone}</p>
                        : <p className="text-[11px] text-amber-600">Sem telefone — só receberá push</p>
                      }
                    </div>
                  </div>
                  <button
                    onClick={() => removeMember(m.id, type)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Add member */}
              {adding === type ? (
                <div className="flex items-center gap-2 pt-1">
                  <select
                    className="flex-1 h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                    defaultValue=""
                    onChange={e => { if (e.target.value) addMember(type, e.target.value); }}
                  >
                    <option value="">— selecione um funcionário —</option>
                    {available.map(p => (
                      <option key={p.user_id} value={p.user_id}>{p.display_name}{p.phone ? '' : ' (sem tel.)'}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setAdding(null)}
                    className="p-2 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(type)}
                  disabled={saving === type || available.length === 0}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-1 disabled:opacity-40"
                >
                  {saving === type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {available.length === 0 ? 'Todos os funcionários já adicionados' : 'Adicionar funcionário'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
