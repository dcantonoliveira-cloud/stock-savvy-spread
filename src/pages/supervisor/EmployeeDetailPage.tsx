import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  ArrowLeft, User, Mail, MapPin, Briefcase,
  FileText, Edit2, Save, X, Loader2,
  Eye, Download, Plus, ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmpPermissions {
  can_entry: boolean; can_output: boolean;
  access_stock: boolean; access_materials: boolean;
  access_comercial: boolean; access_financeiro: boolean;
  access_estoque: boolean; access_cadastros: boolean;
  access_estatisticas: boolean; access_administracao: boolean;
  is_admin: boolean;
}

const DEFAULT_PERMS: EmpPermissions = {
  can_entry: true, can_output: true,
  access_stock: false, access_materials: false,
  access_comercial: false, access_financeiro: false,
  access_estoque: false, access_cadastros: false,
  access_estatisticas: false, access_administracao: false,
  is_admin: false,
};

const PERM_GROUPS = [
  {
    label: 'Comercial', key: 'access_comercial' as keyof EmpPermissions,
    desc: 'Eventos, orçamentos, clientes, degustações e calendário',
  },
  {
    label: 'Financeiro', key: 'access_financeiro' as keyof EmpPermissions,
    desc: 'Fluxo de caixa, contas, DRE e relatórios financeiros',
  },
  {
    label: 'Estoque & Operações', key: 'access_estoque' as keyof EmpPermissions,
    desc: 'Entradas, saídas, fichas técnicas, inventário e compras',
  },
  {
    label: 'Materiais', key: 'access_materials' as keyof EmpPermissions,
    desc: 'Inventário de materiais, empréstimos e perdas',
  },
  {
    label: 'Cadastros', key: 'access_cadastros' as keyof EmpPermissions,
    desc: 'Produtos, salões, assessores, contratos e tipos de evento',
  },
  {
    label: 'Estatísticas', key: 'access_estatisticas' as keyof EmpPermissions,
    desc: 'Relatórios de desempenho e Dashboard BI',
  },
  {
    label: 'Administração', key: 'access_administracao' as keyof EmpPermissions,
    desc: 'Funcionários, holerites, análise IA e configurações',
  },
  {
    label: 'Administrador do sistema', key: 'is_admin' as keyof EmpPermissions,
    desc: 'Pode gerenciar permissões de outros usuários',
    danger: true,
  },
];

interface Profile {
  user_id: string; display_name: string; email: string;
  phone: string | null; cpf: string | null; birth_date: string | null;
  address: string | null; city: string | null; state: string | null;
  zip_code: string | null; position: string | null; department: string | null;
  hire_date: string | null; notes: string | null; avatar_base64: string | null;
}
interface Payslip {
  id: string; title: string; status: string; reference_month: string;
  published_at: string | null;
  electronic_signatures?: { id: string; signed_at_utc: string; signed_pdf_path: string | null }[];
}

const STATUS_MAP = {
  published: { label: 'Pendente',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  signed:    { label: 'Assinado',  cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  draft:     { label: 'Rascunho', cls: 'bg-slate-100 text-slate-500' },
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || <span className="text-muted-foreground/40">—</span>}</p>
    </div>
  );
}

function InputField({
  label, field, type = 'text', value, onChange,
}: {
  label: string;
  field: string;
  type?: string;
  value: string;
  onChange: (field: string, val: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(field, e.target.value)}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
      />
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { permissions: myPerms } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string>('');
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [empPerms, setEmpPerms] = useState<EmpPermissions>(DEFAULT_PERMS);
  const [savingPerms, setSavingPerms] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'info' | 'holerites' | 'permissoes'>('info');
  const [form, setForm] = useState<Partial<Profile>>({});

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    setLoading(true);
    const [profRes, roleRes, psRes, permRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', id!).single(),
      supabase.from('user_roles').select('role').eq('user_id', id!).maybeSingle(),
      supabase
        .from('payslips' as any)
        .select('id, title, status, reference_month, published_at, electronic_signatures(id, signed_at_utc, signed_pdf_path)')
        .eq('employee_id', id!)
        .order('reference_month', { ascending: false }),
      supabase.from('employee_permissions').select('*').eq('user_id', id!).maybeSingle(),
    ]);

    if (!profRes.data) { toast.error('Funcionário não encontrado'); navigate('/users'); return; }
    const p = profRes.data as unknown as Profile;
    setProfile(p);
    setForm(p);
    setRole((roleRes.data as any)?.role ?? 'sem acesso');
    setPayslips((psRes.data ?? []) as unknown as Payslip[]);
    if (permRes.data) {
      const d = permRes.data as any;
      setEmpPerms({
        can_entry: d.can_entry ?? true,
        can_output: d.can_output ?? true,
        access_stock: d.access_stock ?? false,
        access_materials: d.access_materials ?? false,
        access_comercial: d.access_comercial ?? false,
        access_financeiro: d.access_financeiro ?? false,
        access_estoque: d.access_estoque ?? false,
        access_cadastros: d.access_cadastros ?? false,
        access_estatisticas: d.access_estatisticas ?? false,
        access_administracao: d.access_administracao ?? false,
        is_admin: d.is_admin ?? false,
      });
    }
    setLoading(false);
  };

  const handleSavePerms = async () => {
    setSavingPerms(true);
    const { error } = await supabase
      .from('employee_permissions')
      .upsert({ user_id: id!, ...empPerms }, { onConflict: 'user_id' });
    if (error) toast.error('Erro ao salvar permissões');
    else toast.success('Permissões salvas');
    setSavingPerms(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: form.display_name,
        phone:       form.phone,
        cpf:         form.cpf,
        birth_date:  form.birth_date || null,
        address:     form.address,
        city:        form.city,
        state:       form.state,
        zip_code:    form.zip_code,
        position:    form.position,
        department:  form.department,
        hire_date:   form.hire_date || null,
        notes:       form.notes,
      })
      .eq('user_id', id!);
    if (error) { toast.error('Erro ao salvar'); }
    else { toast.success('Dados salvos'); setEditing(false); load(); }
    setSaving(false);
  };

  const handleField = (field: string, val: string) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from('payslips').createSignedUrl(path, 60);
    return data?.signedUrl;
  };

  const viewPdf = async (psId: string) => {
    const { data: ver } = await supabase
      .from('payslip_versions' as any)
      .select('storage_path')
      .eq('payslip_id', psId)
      .eq('is_current', true)
      .single();
    if (!ver) return;
    const url = await getSignedUrl((ver as any).storage_path);
    if (url) window.open(url, '_blank');
  };

  const viewSignedPdf = async (path: string) => {
    const url = await getSignedUrl(path);
    if (url) window.open(url, '_blank');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
  if (!profile) return null;

  const initials = profile.display_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const roleLabel = { supervisor: 'Supervisor', employee: 'Funcionário', 'sem acesso': 'Sem acesso' }[role] ?? role;
  const roleCls   = { supervisor: 'bg-primary/10 text-primary', employee: 'bg-blue-50 text-blue-700', 'sem acesso': 'bg-muted text-muted-foreground' }[role] ?? 'bg-muted text-muted-foreground';

  const pending = payslips.filter(p => p.status === 'published').length;
  const signed  = payslips.filter(p => p.status === 'signed').length;

  return (
    <div className="p-6 space-y-5">
      {/* Back */}
      <button onClick={() => navigate('/users')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Funcionários
      </button>

      {/* Hero card */}
      <div className="bg-white border border-border rounded-2xl p-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{profile.display_name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${roleCls}`}>{roleLabel}</span>
              {profile.position && (
                <span className="text-xs text-muted-foreground border border-border px-2.5 py-0.5 rounded-full">
                  {profile.position}
                </span>
              )}
              {profile.department && (
                <span className="text-xs text-muted-foreground border border-border px-2.5 py-0.5 rounded-full">
                  {profile.department}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
              Editar
            </button>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setForm(profile); }}
                className="p-2 border border-border rounded-xl text-muted-foreground hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salvar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border">
        <button onClick={() => setTab('info')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'info' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
          <User className="w-3.5 h-3.5" />
          Dados cadastrais
        </button>
        <button onClick={() => setTab('holerites')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'holerites' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
          <FileText className="w-3.5 h-3.5" />
          Holerites
          {pending > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pending}</span>
          )}
        </button>
        {myPerms.is_admin && (
          <button onClick={() => setTab('permissoes')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'permissoes' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            Permissões
          </button>
        )}
      </div>

      {/* ── Tab: Dados cadastrais ── */}
      {tab === 'info' && (
        <div className="space-y-4">
          {/* Contato */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-4 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> Contato
            </p>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Nome completo" field="display_name" value={form.display_name ?? ''} onChange={handleField} />
                <InputField label="Telefone" field="phone" value={form.phone ?? ''} onChange={handleField} />
                <InputField label="CPF" field="cpf" value={form.cpf ?? ''} onChange={handleField} />
                <InputField label="Data de nascimento" field="birth_date" type="date" value={form.birth_date ?? ''} onChange={handleField} />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="Nome" value={profile.display_name} />
                <Field label="E-mail" value={profile.email} />
                <Field label="Telefone" value={profile.phone} />
                <Field label="CPF" value={profile.cpf} />
                <Field label="Data de nascimento"
                  value={profile.birth_date
                    ? format(new Date(profile.birth_date + 'T12:00:00'), 'dd/MM/yyyy')
                    : null} />
              </div>
            )}
          </div>

          {/* Endereço */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-4 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" /> Endereço
            </p>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <InputField label="Endereço" field="address" value={form.address ?? ''} onChange={handleField} />
                </div>
                <InputField label="Cidade" field="city" value={form.city ?? ''} onChange={handleField} />
                <InputField label="Estado" field="state" value={form.state ?? ''} onChange={handleField} />
                <InputField label="CEP" field="zip_code" value={form.zip_code ?? ''} onChange={handleField} />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Endereço" value={profile.address} />
                </div>
                <Field label="Cidade" value={profile.city} />
                <Field label="Estado" value={profile.state} />
                <Field label="CEP" value={profile.zip_code} />
              </div>
            )}
          </div>

          {/* Cargo */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-4 flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5" /> Cargo e empresa
            </p>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Cargo" field="position" value={form.position ?? ''} onChange={handleField} />
                <InputField label="Departamento" field="department" value={form.department ?? ''} onChange={handleField} />
                <InputField label="Data de contratação" field="hire_date" type="date" value={form.hire_date ?? ''} onChange={handleField} />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Cargo" value={profile.position} />
                <Field label="Departamento" value={profile.department} />
                <Field label="Contratado em"
                  value={profile.hire_date
                    ? format(new Date(profile.hire_date + 'T12:00:00'), 'dd/MM/yyyy')
                    : null} />
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-4">Observações</p>
            {editing ? (
              <textarea
                value={form.notes ?? ''}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="Anotações internas sobre o funcionário..."
              />
            ) : (
              <p className="text-sm text-foreground">
                {profile.notes || <span className="text-muted-foreground/40">Nenhuma observação.</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Holerites ── */}
      {tab === 'holerites' && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total',     value: payslips.length, color: 'text-primary' },
              { label: 'Pendentes', value: pending,         color: 'text-amber-600' },
              { label: 'Assinados', value: signed,          color: 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-border rounded-xl p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">{s.label}</p>
                <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Action */}
          <div className="flex justify-end">
            <button
              onClick={() => navigate(`/holerites?employee=${id}`)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />
              Publicar holerite
            </button>
          </div>

          {/* List */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  <th className="text-left px-5 py-3">Holerite</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Data assinatura</th>
                  <th className="text-right px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {payslips.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      Nenhum holerite publicado ainda.
                    </td>
                  </tr>
                ) : payslips.map(p => {
                  const sig = p.electronic_signatures?.[0];
                  const st = STATUS_MAP[p.status as keyof typeof STATUS_MAP] ?? { label: p.status, cls: 'bg-muted text-muted-foreground' };
                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground">{p.title}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                        {sig
                          ? format(new Date(sig.signed_at_utc), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => viewPdf(p.id)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title="Ver PDF original">
                            <Eye className="w-4 h-4" />
                          </button>
                          {sig?.signed_pdf_path && (
                            <button onClick={() => viewSignedPdf(sig.signed_pdf_path!)}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors" title="Baixar PDF assinado">
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Permissões ── */}
      {tab === 'permissoes' && myPerms.is_admin && (
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-2xl divide-y divide-border/60">
            {PERM_GROUPS.map(g => (
              <div key={g.key} className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 min-w-0 pr-4">
                  <p className={`text-sm font-medium ${g.danger ? 'text-amber-700' : 'text-foreground'}`}>{g.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{g.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmpPerms(prev => ({ ...prev, [g.key]: !prev[g.key] }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    empPerms[g.key] ? (g.danger ? 'bg-amber-500' : 'bg-primary') : 'bg-muted-foreground/30'
                  }`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    empPerms[g.key] ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSavePerms}
              disabled={savingPerms}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {savingPerms ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar permissões
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
