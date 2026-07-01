import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Search, Loader2, Shield, User, UserX,
  ArrowUpCircle, Trash2, FileText, ChevronRight, Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

type Employee = {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  can_entry: boolean;
  can_output: boolean;
  access_stock: boolean;
  access_materials: boolean;
  payslips_total: number;
  payslips_pending: number;
};

const ROLE_MAP: Record<string, { label: string; cls: string }> = {
  supervisor:  { label: 'Supervisor',  cls: 'bg-primary/10 text-primary' },
  employee:    { label: 'Funcionário', cls: 'bg-blue-50 text-blue-700' },
  'sem acesso':{ label: 'Sem acesso',  cls: 'bg-muted text-muted-foreground' },
};

export default function UsersPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newModal, setNewModal] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [profRes, rolesRes, permsRes, psRes] = await Promise.all([
      supabase.from('profiles').select('user_id, display_name, email'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('employee_permissions').select('user_id, can_entry, can_output, access_stock, access_materials'),
      supabase.from('payslips' as any).select('employee_id, status'),
    ]);

    const profiles = profRes.data ?? [];
    const roles    = rolesRes.data ?? [];
    const perms    = permsRes.data ?? [];
    const payslips = (psRes.data ?? []) as { employee_id: string; status: string }[];

    const emps: Employee[] = profiles.map(p => {
      const role = roles.find(r => r.user_id === p.user_id);
      const perm = perms.find(pe => pe.user_id === p.user_id);
      const myPs = payslips.filter(ps => ps.employee_id === p.user_id);
      return {
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        role: role?.role ?? 'sem acesso',
        can_entry:        perm?.can_entry        ?? true,
        can_output:       perm?.can_output       ?? true,
        access_stock:     (perm as any)?.access_stock     ?? true,
        access_materials: (perm as any)?.access_materials ?? false,
        payslips_total:   myPs.length,
        payslips_pending: myPs.filter(ps => ps.status === 'published').length,
      };
    });

    setEmployees(emps.sort((a, b) => {
      const order = { supervisor: 0, employee: 1, 'sem acesso': 2 };
      return (order[a.role as keyof typeof order] ?? 3) - (order[b.role as keyof typeof order] ?? 3)
        || a.display_name.localeCompare(b.display_name, 'pt-BR');
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newEmail || !newPassword || !newName.trim()) return toast.error('Preencha todos os campos');
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('create-employee', {
      body: { email: newEmail, password: newPassword, display_name: newName.trim() },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Erro ao criar funcionário');
    } else {
      toast.success('Funcionário criado!');
      setNewEmail(''); setNewName(''); setNewPassword('');
      setNewModal(false);
      load();
    }
    setCreating(false);
  };

  const togglePermission = async (
    userId: string,
    field: 'can_entry' | 'can_output' | 'access_stock' | 'access_materials',
    value: boolean,
  ) => {
    const emp = employees.find(e => e.user_id === userId);
    if (!emp) return;
    const { error } = await supabase.from('employee_permissions').upsert({
      user_id: userId,
      can_entry:        field === 'can_entry'        ? value : emp.can_entry,
      can_output:       field === 'can_output'       ? value : emp.can_output,
      access_stock:     field === 'access_stock'     ? value : emp.access_stock,
      access_materials: field === 'access_materials' ? value : emp.access_materials,
    } as any, { onConflict: 'user_id' });
    if (error) { toast.error('Erro ao atualizar permissão'); return; }
    setEditEmp(prev => prev ? { ...prev, [field]: value } : null);
    setEmployees(prev => prev.map(e => e.user_id === userId ? { ...e, [field]: value } : e));
  };

  const removeRole = async (userId: string) => {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'employee');
    await supabase.from('employee_permissions').delete().eq('user_id', userId);
    toast.success('Acesso removido');
    setEditEmp(null);
    load();
  };

  const promoteToSupervisor = async (userId: string, name: string) => {
    if (!confirm(`Promover ${name} a Supervisor? Dará acesso total ao sistema.`)) return;
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('employee_permissions').delete().eq('user_id', userId);
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'supervisor' });
    if (error) { toast.error('Erro ao promover'); return; }
    toast.success(`${name} agora é Supervisor!`);
    setEditEmp(null);
    load();
  };

  const filtered = employees.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.display_name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
  });

  const counts = {
    total:      employees.length,
    employees:  employees.filter(e => e.role === 'employee').length,
    supervisors:employees.filter(e => e.role === 'supervisor').length,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-display font-bold text-primary">Funcionários</h1>
          <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {employees.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <button
            onClick={() => setNewModal(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap">
            <Plus className="w-4 h-4" />
            Novo funcionário
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total',        value: counts.total,       color: 'text-primary' },
          { label: 'Funcionários', value: counts.employees,   color: 'text-blue-700' },
          { label: 'Supervisores', value: counts.supervisors, color: 'text-violet-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground/60 font-semibold uppercase tracking-widest">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] bg-muted/30 font-semibold uppercase tracking-widest text-muted-foreground/60">
              <th className="text-left px-5 py-3">Nome</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">E-mail</th>
              <th className="text-left px-4 py-3">Cargo</th>
              <th className="text-center px-4 py-3 hidden sm:table-cell">Holerites</th>
              <th className="text-right px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[35, 30, 15, 10, 10].map((w, j) => (
                    <td key={j} className="px-5 py-3.5">
                      <div className="h-4 bg-muted/40 rounded animate-pulse" style={{ width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-muted-foreground">
                  <UserX className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {search ? 'Nenhum funcionário encontrado para essa busca.' : 'Nenhum funcionário cadastrado.'}
                </td>
              </tr>
            ) : filtered.map(emp => {
              const roleInfo = ROLE_MAP[emp.role] ?? ROLE_MAP['sem acesso'];
              return (
                <tr key={emp.user_id}
                  className="hover:bg-primary/5 transition-colors cursor-pointer"
                  onClick={() => navigate(`/users/${emp.user_id}`)}>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-foreground">{emp.display_name}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{emp.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${roleInfo.cls}`}>
                      {roleInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {emp.payslips_total > 0 ? (
                      <button
                        onClick={() => navigate(`/holerites?employee=${emp.user_id}`)}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{emp.payslips_total}</span>
                        {emp.payslips_pending > 0 && (
                          <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {emp.payslips_pending} pendente{emp.payslips_pending > 1 ? 's' : ''}
                          </span>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/holerites?employee=${emp.user_id}`)}
                        className="text-xs text-muted-foreground/40 hover:text-primary transition-colors">
                        —
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate(`/holerites?employee=${emp.user_id}`)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                        title="Ver holerites">
                        <FileText className="w-4 h-4" />
                      </button>
                      {emp.role === 'employee' && (
                        <button
                          onClick={() => setEditEmp(emp)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                          title="Configurar permissões">
                          <Settings2 className="w-4 h-4" />
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

      {/* New employee modal */}
      <Dialog open={newModal} onOpenChange={setNewModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Funcionário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome completo</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail</label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Senha inicial</label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Senha" />
            </div>
            <button onClick={handleCreate} disabled={creating}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar Funcionário
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit permissions drawer */}
      {editEmp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{editEmp.display_name}</p>
                <p className="text-xs text-muted-foreground">{editEmp.email}</p>
              </div>
              <button onClick={() => setEditEmp(null)}
                className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Movimentações</p>
                <div className="space-y-2.5">
                  {[
                    { field: 'can_entry' as const, label: 'Registrar entradas' },
                    { field: 'can_output' as const, label: 'Registrar saídas' },
                  ].map(({ field, label }) => (
                    <label key={field} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{label}</span>
                      <Switch
                        checked={editEmp[field]}
                        onCheckedChange={v => togglePermission(editEmp.user_id, field, v)}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Acesso às seções</p>
                <div className="space-y-2.5">
                  {[
                    { field: 'access_stock' as const, label: 'Estoque' },
                    { field: 'access_materials' as const, label: 'Materiais' },
                  ].map(({ field, label }) => (
                    <label key={field} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{label}</span>
                      <Switch
                        checked={editEmp[field]}
                        onCheckedChange={v => togglePermission(editEmp.user_id, field, v)}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => promoteToSupervisor(editEmp.user_id, editEmp.display_name)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors">
                  <ArrowUpCircle className="w-4 h-4 text-primary" />
                  Promover a Supervisor
                </button>
                <button
                  onClick={() => removeRole(editEmp.user_id)}
                  className="flex items-center gap-2 py-2.5 px-4 border border-destructive/30 rounded-xl text-sm text-destructive hover:bg-destructive/5 transition-colors">
                  <Trash2 className="w-4 h-4" />
                  Remover acesso
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
