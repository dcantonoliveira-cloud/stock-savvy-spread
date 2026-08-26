import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  ArrowLeft, User, Mail, MapPin, Briefcase,
  FileText, Edit2, Save, X, Loader2,
  Eye, Download, Plus, ShieldCheck, Trash2, KeyRound, Timer, LogIn, LogOut, ChevronDown, ChevronUp,
} from 'lucide-react';
import { startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, format as fmtDate, format } from 'date-fns';
import { DEFAULT_SCHEDULE, calcDayBalance, formatBalance, type WeekSchedule } from '@/lib/workSchedule';
import { ptBR } from 'date-fns/locale';

interface EmpPermissions {
  can_entry: boolean; can_output: boolean;
  access_stock: boolean; access_materials: boolean;
  access_comercial: boolean; access_financeiro: boolean;
  access_estoque: boolean; access_cadastros: boolean;
  access_estatisticas: boolean; access_administracao: boolean; access_producao: boolean;
  is_admin: boolean;
}

const DEFAULT_PERMS: EmpPermissions = {
  can_entry: true, can_output: true,
  access_stock: false, access_materials: false,
  access_comercial: false, access_financeiro: false,
  access_estoque: false, access_cadastros: false,
  access_estatisticas: false, access_administracao: false, access_producao: false,
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
    label: 'Produção', key: 'access_producao' as keyof EmpPermissions,
    desc: 'Pedidos de produção da cozinha',
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
  const [savingRole, setSavingRole] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [tab, setTab] = useState<'info' | 'holerites' | 'permissoes' | 'ponto'>('info');
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
        access_producao: d.access_producao ?? false,
        is_admin: d.is_admin ?? false,
      });
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    // Remove permissões e role antes de deletar o usuário via admin API
    await supabase.from('employee_permissions').delete().eq('user_id', id!);
    await supabase.from('user_roles').delete().eq('user_id', id!);
    const { error } = await (supabase.functions as any).invoke('delete-user', { body: { user_id: id } });
    if (error) {
      // Fallback: se não tiver edge function, só remove os dados locais
      toast.success('Dados do funcionário removidos. Conta de auth requer remoção manual no Supabase.');
    } else {
      toast.success('Funcionário excluído com sucesso');
    }
    setDeleting(false);
    navigate('/users');
  };

  const handleChangeRole = async (newRole: 'supervisor' | 'employee') => {
    if (newRole === role) return;
    setSavingRole(true);
    // Delete existing role(s) then insert the new one
    const { error: delErr } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', id!);
    if (delErr) {
      toast.error('Erro ao alterar tipo de acesso');
      setSavingRole(false);
      return;
    }
    const { error: insErr } = await supabase
      .from('user_roles')
      .insert({ user_id: id!, role: newRole });
    if (insErr) {
      toast.error('Erro ao alterar tipo de acesso');
    } else {
      setRole(newRole);
      toast.success(`Acesso alterado para ${newRole === 'supervisor' ? 'Supervisor' : 'Funcionário'}`);
    }
    setSavingRole(false);
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

  const handleSendResetLink = async () => {
    if (!profile) return;
    setSendingReset(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { data, error } = await supabase.functions.invoke('generate-reset-link', {
        body: { email: profile.email, phone: profile.phone, name: profile.display_name, redirectTo },
      });
      if (error || data?.error) {
        toast.error(data?.error || 'Erro ao redefinir senha');
        return;
      }
      if (data?.sent_whatsapp) {
        toast.success(`Link enviado via WhatsApp para ${profile.display_name.split(' ')[0]}`);
      } else if (data?.link) {
        // ZApi não configurado ou sem telefone — copia o link
        await navigator.clipboard.writeText(data.link).catch(() => {});
        toast.success('Link copiado! Cole no WhatsApp manualmente.');
      } else {
        toast.success('Link gerado com sucesso');
      }
    } finally {
      setSendingReset(false);
    }
  };

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
          {myPerms.is_admin && !editing && (
            <>
              <button
                onClick={handleSendResetLink}
                disabled={sendingReset}
                title="Enviar link de redefinição de senha via WhatsApp"
                className="flex items-center gap-2 px-3 py-2 border border-green-200 rounded-xl text-sm text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50">
                {sendingReset
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <KeyRound className="w-3.5 h-3.5" />}
                Redefinir senha
              </button>
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-3 py-2 border border-red-200 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </button>
            </>
          )}
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
        <button onClick={() => setTab('ponto')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'ponto' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
          <Timer className="w-3.5 h-3.5" />
          Ponto
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

      {/* Modal de confirmação de exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Excluir funcionário</p>
                <p className="text-xs text-muted-foreground mt-0.5">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Tem certeza que deseja excluir <strong>{profile.display_name}</strong>? Todas as permissões e dados vinculados serão removidos.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                className="flex-1 px-4 py-2 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Ponto ── */}
      {tab === 'ponto' && id && <PontoTab employeeId={id} />}

      {/* ── Tab: Permissões ── */}
      {tab === 'permissoes' && myPerms.is_admin && (<div className="space-y-4">

          {/* Tipo de acesso */}
          <div className="bg-white border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-1">Tipo de acesso</p>
            <p className="text-xs text-muted-foreground mb-4">
              <strong>Funcionário</strong> acessa somente Estoque e Materiais (tela simplificada).&ensp;
              <strong>Supervisor</strong> acessa o painel completo com menu lateral.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleChangeRole('employee')}
                disabled={savingRole}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  role === 'employee'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-border text-muted-foreground hover:bg-muted/40'
                }`}>
                Funcionário
              </button>
              <button
                onClick={() => handleChangeRole('supervisor')}
                disabled={savingRole}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  role === 'supervisor'
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted-foreground hover:bg-muted/40'
                }`}>
                Supervisor
              </button>
            </div>
            {savingRole && <p className="text-xs text-muted-foreground mt-2 text-center">Salvando...</p>}
          </div>

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

// ── PontoTab ──────────────────────────────────────────────────────────────────
interface TimeEntry { id: string; type: 'entry' | 'exit' | 'adjustment'; recorded_at: string; note: string | null; latitude: number | null; longitude: number | null; adjustment_minutes?: number | null; }

// Coordenadas da empresa — Rua Deputado Ranieri Mazzilli 55, Jd Elton Ville, Sorocaba SP
const COMPANY_LAT = -23.5227;
const COMPANY_LNG = -47.4723;
const ALLOWED_RADIUS_M = 1000;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function isOutside(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return false;
  return haversineM(lat, lng, COMPANY_LAT, COMPANY_LNG) > ALLOWED_RADIUS_M;
}

function msToHHMM(ms: number) {
  if (ms <= 0) return '0h00';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function dayTotalMs(entries: TimeEntry[], lunchMinutes = 0) {
  const nonAdj = entries.filter(e => e.type !== 'adjustment');
  const sorted = [...nonAdj].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const entry = sorted.find(e => e.type === 'entry');
  const exit  = [...sorted].reverse().find(e => e.type === 'exit');
  if (!entry || !exit) return 0;
  const total = new Date(exit.recorded_at).getTime() - new Date(entry.recorded_at).getTime() - lunchMinutes * 60_000;
  return Math.max(0, total);
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WORK_DAYS = [1, 2, 3, 4, 5];

function PontoTab({ employeeId }: { employeeId: string }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [editModal, setEditModal] = useState<TimeEntry | null>(null);
  const [editTime, setEditTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);
  const [savingSched, setSavingSched] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);
  const [adjModal, setAdjModal] = useState<{ date: string } | null>(null);
  const [newExitModal, setNewExitModal] = useState<{ date: string } | null>(null);
  const [newExitTime, setNewExitTime] = useState('');
  const [newEntryModal, setNewEntryModal] = useState<{ date: string } | null>(null);
  const [newEntryTime, setNewEntryTime] = useState('');
  const [adjSign, setAdjSign] = useState<'+' | '-'>('+');
  const [adjHours, setAdjHours] = useState('0');
  const [adjMins, setAdjMins] = useState('0');
  const [adjNote, setAdjNote] = useState('');
  const [savingAdj, setSavingAdj] = useState(false);
  const [cumulativeBalanceMin, setCumulativeBalanceMin] = useState<number | null>(null);

  const monthStart = startOfMonth(viewDate);
  const monthEnd   = endOfMonth(viewDate);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [entriesRes, permRes] = await Promise.all([
        supabase
          .from('time_entries' as any)
          .select('id, type, recorded_at, note, latitude, longitude, adjustment_minutes')
          .eq('employee_id', employeeId)
          .gte('recorded_at', monthStart.toISOString())
          .lte('recorded_at', monthEnd.toISOString())
          .order('recorded_at', { ascending: true }),
        supabase
          .from('employee_permissions')
          .select('work_schedule')
          .eq('user_id', employeeId)
          .maybeSingle(),
      ]);
      setEntries((entriesRes.data ?? []) as unknown as TimeEntry[]);
      if ((permRes.data as any)?.work_schedule) setSchedule((permRes.data as any).work_schedule);
      setLoading(false);
    };
    load();
  }, [employeeId, viewDate.getFullYear(), viewDate.getMonth()]);

  // Saldo acumulado desde a data de início
  useEffect(() => {
    const startDate = (schedule as any).start_date ? parseISO((schedule as any).start_date) : null;
    if (!startDate) { setCumulativeBalanceMin(null); return; }

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const load = async () => {
      const { data } = await supabase
        .from('time_entries' as any)
        .select('type, recorded_at, adjustment_minutes')
        .eq('employee_id', employeeId)
        .gte('recorded_at', startDate.toISOString())
        .lte('recorded_at', todayEnd.toISOString())
        .order('recorded_at', { ascending: true });

      const allEntries = (data ?? []) as unknown as TimeEntry[];
      const allDays = eachDayOfInterval({ start: startDate, end: todayEnd });
      const todayDate = new Date();

      const cum = allDays.reduce((s, d) => {
        const hasSched = schedule[d.getDay()] != null;
        const dayEntries = allEntries.filter(e => isSameDay(parseISO(e.recorded_at), d));
        if (!hasSched && dayEntries.length === 0) return s;
        // Hoje sem saída ainda → não penalizar
        if (isSameDay(d, todayDate) && !dayEntries.some(e => e.type === 'exit')) return s;
        return s + calcDayBalance(dayEntries, schedule, d);
      }, 0);

      setCumulativeBalanceMin(cum);
    };

    load();
  }, [employeeId, (schedule as any).start_date, entries]);

  // Agrupa por dia — mais recente primeiro
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd }).reverse();
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const schedStartDate = (schedule as any).start_date ? parseISO((schedule as any).start_date) : null;
  const byDay = days.map(day => ({
    day,
    entries: entries.filter(e => isSameDay(parseISO(e.recorded_at), day)),
  })).filter(d => {
    if (schedStartDate && d.day < schedStartDate) return false;
    return d.entries.length > 0 || (schedule[d.day.getDay()] != null && d.day <= today);
  });

  // Semanas — agora com saldo (balance em minutos)
  const weekMap = new Map<string, { ms: number; balanceMin: number; days: typeof byDay }>();
  const isDayIncomplete = (d: { day: Date; entries: TimeEntry[] }) =>
    isSameDay(d.day, new Date()) && !d.entries.some(e => e.type === 'exit');

  byDay.forEach(d => {
    const ws = fmtDate(startOfWeek(d.day, { locale: ptBR }), 'yyyy-MM-dd');
    if (!weekMap.has(ws)) weekMap.set(ws, { ms: 0, balanceMin: 0, days: [] });
    const w = weekMap.get(ws)!;
    w.days.push(d);
    w.ms += dayTotalMs(d.entries, schedule[d.day.getDay()]?.lunch_minutes ?? 60);
    if (!isDayIncomplete(d)) w.balanceMin += calcDayBalance(d.entries, schedule, d.day);
  });

  const monthTotalMs = byDay.reduce((s, d) => s + dayTotalMs(d.entries, schedule[d.day.getDay()]?.lunch_minutes ?? 60), 0);
  const monthBalanceMin = byDay.reduce((s, d) => isDayIncomplete(d) ? s : s + calcDayBalance(d.entries, schedule, d.day), 0);

  const saveSchedule = async () => {
    setSavingSched(true);
    await supabase.from('employee_permissions').update({ work_schedule: schedule } as any).eq('user_id', employeeId);
    setSavingSched(false);
    setSchedOpen(false);
    toast.success('Jornada salva!');
  };

  const openEdit = (e: TimeEntry) => {
    setEditModal(e);
    setEditTime(fmtDate(parseISO(e.recorded_at), 'HH:mm'));
  };

  const saveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    const base = editModal.recorded_at.slice(0, 10);
    const recorded_at = new Date(`${base}T${editTime}:00`).toISOString();
    await supabase.from('time_entries' as any).update({ recorded_at }).eq('id', editModal.id);
    setEntries(prev => prev.map(e => e.id === editModal.id ? { ...e, recorded_at } : e));
    setEditModal(null);
    setSaving(false);
  };

  const deleteEntry = async (id: string) => {
    await supabase.from('time_entries' as any).delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    setEditModal(null);
  };

  const openNewEntryModal = (date: string) => {
    setNewEntryModal({ date });
    setNewEntryTime('07:30');
  };

  const saveNewEntry = async () => {
    if (!newEntryModal) return;
    setSaving(true);
    const recorded_at = new Date(`${newEntryModal.date}T${newEntryTime}:00`).toISOString();
    const { data, error } = await supabase.from('time_entries' as any)
      .insert({ employee_id: employeeId, company_id: 'c56c2ccd-2c35-4ebb-b868-e153727e5d89', type: 'entry', recorded_at })
      .select('id, type, recorded_at, note, latitude, longitude, adjustment_minutes').single();
    if (error) { toast.error('Erro ao salvar entrada'); setSaving(false); return; }
    setEntries(prev => [...prev, data as unknown as TimeEntry]);
    setNewEntryModal(null);
    setSaving(false);
    toast.success('Entrada registrada!');
  };

  const openNewExitModal = (date: string) => {
    setNewExitModal({ date });
    setNewExitTime('17:30');
  };

  const saveNewExit = async () => {
    if (!newExitModal) return;
    setSaving(true);
    const recorded_at = new Date(`${newExitModal.date}T${newExitTime}:00`).toISOString();
    const { data, error } = await supabase.from('time_entries' as any)
      .insert({ employee_id: employeeId, company_id: 'c56c2ccd-2c35-4ebb-b868-e153727e5d89', type: 'exit', recorded_at })
      .select('id, type, recorded_at, note, latitude, longitude, adjustment_minutes').single();
    if (error) { toast.error('Erro ao salvar saída'); setSaving(false); return; }
    setEntries(prev => [...prev, data as unknown as TimeEntry]);
    setNewExitModal(null);
    setSaving(false);
    toast.success('Saída registrada!');
  };

  const openAdjModal = (date: string) => {
    setAdjModal({ date });
    setAdjSign('+'); setAdjHours('0'); setAdjMins('0'); setAdjNote('');
  };

  const saveAdjustment = async () => {
    if (!adjModal || !adjNote.trim()) return;
    setSavingAdj(true);
    const minutes = (parseInt(adjHours) * 60 + parseInt(adjMins)) * (adjSign === '+' ? 1 : -1);
    const recorded_at = new Date(`${adjModal.date}T12:00:00`).toISOString();
    const { data, error } = await supabase.from('time_entries' as any)
      .insert({ employee_id: employeeId, company_id: 'c56c2ccd-2c35-4ebb-b868-e153727e5d89', type: 'adjustment', recorded_at, note: adjNote.trim(), adjustment_minutes: minutes })
      .select('id, type, recorded_at, note, latitude, longitude, adjustment_minutes').single();
    if (error) { toast.error('Erro ao salvar ajuste'); setSavingAdj(false); return; }
    setEntries(prev => [...prev, data as unknown as TimeEntry]);
    setAdjModal(null);
    setSavingAdj(false);
    toast.success('Ajuste registrado');
  };

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <div className="space-y-4">
      {/* Navegação mês + saldo */}
      <div className="bg-white border border-border rounded-2xl px-5 py-4 flex items-center justify-between">
        <button onClick={prevMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <ChevronDown className="w-4 h-4 rotate-90" />
        </button>
        <div className="text-center">
          <p className="font-semibold text-foreground capitalize">
            {fmtDate(viewDate, 'MMMM yyyy', { locale: ptBR })}
          </p>
          {!loading && (
            <div className="flex items-center justify-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground">
                Trabalhado: <span className="font-bold text-foreground">{msToHHMM(monthTotalMs)}</span>
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                monthBalanceMin >= 0
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-600'
              }`}>
                {formatBalance(monthBalanceMin)}
              </span>
            </div>
          )}
        </div>
        <button onClick={nextMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <ChevronUp className="w-4 h-4 rotate-90" />
        </button>
      </div>

      {/* Ajuste manual */}
      <div className="flex justify-end">
        <button
          onClick={() => openAdjModal(fmtDate(new Date(), 'yyyy-MM-dd'))}
          className="flex items-center gap-1.5 text-xs font-medium text-primary border border-primary/30 px-3 py-1.5 rounded-xl hover:bg-primary/5 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Ajuste manual de horas
        </button>
      </div>

      {/* Configurar jornada */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => setSchedOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors">
          <span className="flex items-center gap-2"><Timer className="w-4 h-4 text-muted-foreground" /> Jornada de trabalho</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${schedOpen ? 'rotate-180' : ''}`} />
        </button>
        {schedOpen && (
          <div className="border-t border-border px-5 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">Entrada antes do horário programado não gera banco positivo.</p>
            <div className="flex items-center gap-3 pb-1">
              <label className="text-xs font-semibold text-muted-foreground/70 whitespace-nowrap">Data de início</label>
              <input
                type="date"
                value={(schedule as any).start_date ?? ''}
                onChange={e => setSchedule(s => ({ ...s, start_date: e.target.value } as any))}
                className="border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-[11px] text-muted-foreground">Dias anteriores não são contabilizados</span>
            </div>
            <div className="grid grid-cols-[60px_1fr_1fr_1fr_80px] gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">
              <span>Dia</span><span>Início</span><span>Esperado (h)</span><span>Almoço (min)</span><span></span>
            </div>
            {WORK_DAYS.map(dow => {
              const day = schedule[dow];
              return (
                <div key={dow} className="grid grid-cols-[60px_1fr_1fr_1fr_80px] gap-2 items-center">
                  <span className="text-sm font-medium text-foreground">{DAY_NAMES[dow]}</span>
                  <input
                    type="time"
                    value={day?.start ?? '07:30'}
                    onChange={e => setSchedule(s => ({ ...s, [dow]: { ...s[dow]!, start: e.target.value } }))}
                    className="border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="number"
                    min={1} max={12} step={0.5}
                    value={day ? day.expected_minutes / 60 : 8}
                    onChange={e => setSchedule(s => ({ ...s, [dow]: { ...s[dow]!, expected_minutes: Math.round(parseFloat(e.target.value) * 60) } }))}
                    className="border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="number"
                    min={0} max={120} step={15}
                    value={day?.lunch_minutes ?? 60}
                    onChange={e => setSchedule(s => ({ ...s, [dow]: { ...s[dow]!, lunch_minutes: parseInt(e.target.value) || 0 } }))}
                    className="border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={() => setSchedule(s => {
                      const n = { ...s };
                      if (n[dow]) delete n[dow]; else n[dow] = { start: '07:30', expected_minutes: 8 * 60, lunch_minutes: 60 };
                      return n;
                    })}
                    className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                      schedule[dow] ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-muted text-muted-foreground border-border'
                    }`}>
                    {schedule[dow] ? 'Ativo' : 'Folga'}
                  </button>
                </div>
              );
            })}
            <div className="flex justify-end pt-1">
              <button onClick={saveSchedule} disabled={savingSched}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {savingSched ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salvar jornada
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : byDay.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum registro neste mês.</div>
      ) : (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          {/* Cabeçalho tabela */}
          <div className="grid grid-cols-[1fr_72px_72px_64px_64px_28px] gap-0 px-4 py-2 bg-muted/30 border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            <span>Dia</span>
            <span className="text-center">Entrada</span>
            <span className="text-center">Saída</span>
            <span className="text-center">Total</span>
            <span className="text-center">Saldo</span>
            <span />
          </div>

          {/* Semanas */}
          {[...weekMap.entries()].map(([ws, week]) => (
            <div key={ws}>
              {week.days.map(({ day, entries: de }) => {
                const sorted = [...de].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
                const entryE = sorted.find(e => e.type === 'entry');
                const exitE  = sorted.filter(e => e.type === 'exit').pop();
                const total  = dayTotalMs(de, schedule[day.getDay()]?.lunch_minutes ?? 60);
                const isWeekend = [0, 6].includes(day.getDay());
                const isToday = isSameDay(day, new Date());
                const isDayIncomplete = isToday && !exitE;
                const dayBal = calcDayBalance(de, schedule, day);
                const hasSched = schedule[day.getDay()] != null;
                return (
                  <React.Fragment key={day.toISOString()}>
                    <div className={`grid grid-cols-[1fr_72px_72px_64px_64px_28px] gap-0 px-4 py-2.5 border-b border-border/40 text-sm transition-colors ${isWeekend ? 'bg-muted/20 hover:bg-muted/40' : 'hover:bg-muted/20'}`}>
                      <span className="font-medium text-foreground capitalize text-xs">
                        {fmtDate(day, "EEE dd/MM", { locale: ptBR })}
                      </span>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => entryE ? openEdit(entryE) : openNewEntryModal(fmtDate(day, 'yyyy-MM-dd'))}
                          className={`text-xs font-medium hover:underline ${entryE ? 'text-emerald-600' : 'text-muted-foreground/40 hover:text-emerald-500'}`}>
                          {entryE ? fmtDate(parseISO(entryE.recorded_at), 'HH:mm') : '—'}
                        </button>
                        {entryE?.latitude && (() => {
                          const outside = isOutside(entryE.latitude, entryE.longitude);
                          return (
                            <a href={`https://www.google.com/maps?q=${entryE.latitude},${entryE.longitude}`}
                              target="_blank" rel="noreferrer"
                              title={outside ? '⚠️ Fora da empresa' : 'Ver localização'}
                              className={outside ? 'text-orange-400 hover:text-orange-500' : 'text-muted-foreground/40 hover:text-primary'}>
                              <MapPin className="w-3 h-3" />
                            </a>
                          );
                        })()}
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => exitE ? openEdit(exitE) : (entryE ? openNewExitModal(fmtDate(day, 'yyyy-MM-dd')) : undefined)}
                          className={`text-xs font-medium hover:underline ${exitE ? 'text-rose-500' : entryE ? 'text-muted-foreground/40 hover:text-rose-400' : 'text-muted-foreground/30 cursor-default'}`}>
                          {exitE ? fmtDate(parseISO(exitE.recorded_at), 'HH:mm') : '—'}
                        </button>
                        {exitE?.latitude && (() => {
                          const outside = isOutside(exitE.latitude, exitE.longitude);
                          return (
                            <a href={`https://www.google.com/maps?q=${exitE.latitude},${exitE.longitude}`}
                              target="_blank" rel="noreferrer"
                              title={outside ? '⚠️ Fora da empresa' : 'Ver localização'}
                              className={outside ? 'text-orange-400 hover:text-orange-500' : 'text-muted-foreground/40 hover:text-rose-400'}>
                              <MapPin className="w-3 h-3" />
                            </a>
                          );
                        })()}
                      </div>
                      <span className="text-center text-xs font-bold text-foreground">
                        {total > 0 ? msToHHMM(total) : <span className="text-muted-foreground/40">—</span>}
                      </span>
                      <span className={`text-center text-xs font-bold ${
                        !hasSched || isDayIncomplete ? 'text-muted-foreground/30' :
                        dayBal >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {hasSched && !isDayIncomplete ? formatBalance(dayBal) : '—'}
                      </span>
                      <span />
                    </div>
                    {de.filter(e => e.type === 'adjustment').map(adj => (
                      <div key={adj.id} className="grid grid-cols-[1fr_72px_72px_64px_64px_28px] gap-0 px-4 py-1.5 border-b border-border/30 bg-amber-50/40 text-xs">
                        <span className="text-amber-700 italic col-span-3 truncate pl-4">{adj.note}</span>
                        <span />
                        <span className="text-center font-medium text-amber-700">
                          {formatBalance(adj.adjustment_minutes ?? 0)}
                        </span>
                        <button onClick={() => deleteEntry(adj.id)} className="flex items-center justify-center text-muted-foreground/30 hover:text-red-400 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </React.Fragment>
                );
              })}
              {/* Subtotal semana */}
              <div className="grid grid-cols-[1fr_72px_72px_64px_64px_28px] gap-0 px-4 py-1.5 bg-primary/5 border-b border-border text-[11px]">
                <span className="text-muted-foreground font-medium">
                  Semana {fmtDate(parseISO(ws), 'dd/MM', { locale: ptBR })}
                </span>
                <span /><span />
                <span className="text-center font-bold text-primary">{msToHHMM(week.ms)}</span>
                <span className={`text-center font-bold ${week.balanceMin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatBalance(week.balanceMin)}
                </span>
                <span />
              </div>
            </div>
          ))}

          {/* Total mês */}
          <div className="grid grid-cols-[1fr_72px_72px_64px_64px_28px] gap-0 px-4 py-3 bg-muted/40 text-sm font-bold border-t border-border">
            <span className="text-foreground">Total do mês</span>
            <span /><span />
            <span className="text-center text-foreground">{msToHHMM(monthTotalMs)}</span>
            <span className={`text-center font-bold ${monthBalanceMin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {formatBalance(monthBalanceMin)}
            </span>
            <span />
          </div>

          {/* Saldo acumulado */}
          {cumulativeBalanceMin !== null && (
            <div className="grid grid-cols-[1fr_72px_72px_64px_64px_28px] gap-0 px-4 py-2.5 bg-primary/5 border-t border-primary/10 text-sm font-bold">
              <span className="text-primary/80 text-xs font-semibold">Saldo acumulado</span>
              <span /><span /><span />
              <span className={`text-center font-bold text-sm ${cumulativeBalanceMin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatBalance(cumulativeBalanceMin)}
              </span>
              <span />
            </div>
          )}
        </div>
      )}

      {/* Modal ajuste manual */}
      {adjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAdjModal(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Ajuste manual de horas</p>
              <button onClick={() => setAdjModal(null)} className="p-1 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            {/* Data */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1">Data</label>
              <input type="date" value={adjModal.date}
                onChange={e => setAdjModal({ date: e.target.value })}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>

            {/* Sinal + horas + minutos */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1">Quantidade</label>
              <div className="flex items-center gap-2">
                <div className="flex rounded-xl border border-border overflow-hidden">
                  <button onClick={() => setAdjSign('+')} className={`px-3 py-2 text-sm font-bold transition-colors ${adjSign === '+' ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}>+</button>
                  <button onClick={() => setAdjSign('-')} className={`px-3 py-2 text-sm font-bold transition-colors ${adjSign === '-' ? 'bg-red-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}>−</button>
                </div>
                <input type="number" min={0} max={23} value={adjHours} onChange={e => setAdjHours(e.target.value)}
                  className="w-16 border border-border rounded-xl px-2 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <span className="text-sm text-muted-foreground">h</span>
                <input type="number" min={0} max={59} value={adjMins} onChange={e => setAdjMins(e.target.value)}
                  className="w-16 border border-border rounded-xl px-2 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </div>

            {/* Motivo */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1">Motivo <span className="text-red-400">*</span></label>
              <input type="text" value={adjNote} onChange={e => setAdjNote(e.target.value)}
                placeholder="Ex: Hora extra autorizada, Falta justificada…"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setAdjModal(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
              <button onClick={saveAdjustment} disabled={savingAdj || !adjNote.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {savingAdj ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Salvar ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova entrada */}
      {newEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setNewEntryModal(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Registrar entrada</p>
              <button onClick={() => setNewEntryModal(null)} className="p-1 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1">Horário de entrada</label>
              <input
                type="time"
                value={newEntryTime}
                onChange={e => setNewEntryTime(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dia: {fmtDate(parseISO(newEntryModal.date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setNewEntryModal(null)} className="flex-1 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={saveNewEntry} disabled={saving}
                className="flex-1 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar entrada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova saída */}
      {newExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setNewExitModal(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Registrar saída</p>
              <button onClick={() => setNewExitModal(null)} className="p-1 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1">Horário de saída</label>
              <input
                type="time"
                value={newExitTime}
                onChange={e => setNewExitTime(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dia: {fmtDate(parseISO(newExitModal.date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setNewExitModal(null)} className="flex-1 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={saveNewExit} disabled={saving}
                className="flex-1 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar saída'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal edição */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditModal(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">
                {editModal.type === 'entry' ? 'Editar entrada' : 'Editar saída'}
              </p>
              <button onClick={() => setEditModal(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-1">Horário</label>
              <input
                type="time"
                value={editTime}
                onChange={e => setEditTime(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dia: {fmtDate(parseISO(editModal.recorded_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => deleteEntry(editModal.id)}
                className="px-3 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors">
                Excluir
              </button>
              <button onClick={() => setEditModal(null)} className="flex-1 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
