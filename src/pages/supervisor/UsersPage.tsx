import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Shield, User, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';

type Employee = {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  can_entry: boolean;
  can_output: boolean;
};

export default function UsersPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    // Get all profiles with roles and permissions
    const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, email');
    if (!profiles) return;

    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    const { data: perms } = await supabase.from('employee_permissions').select('user_id, can_entry, can_output');

    const emps: Employee[] = profiles.map(p => {
      const role = roles?.find(r => r.user_id === p.user_id);
      const perm = perms?.find(pe => pe.user_id === p.user_id);
      return {
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.email,
        role: role?.role || 'sem acesso',
        can_entry: perm?.can_entry ?? true,
        can_output: perm?.can_output ?? true,
      };
    });

    setEmployees(emps);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newEmail || !newPassword || !newName.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    setCreating(true);

    // Use edge function to create user
    const { data, error } = await supabase.functions.invoke('create-employee', {
      body: { email: newEmail, password: newPassword, display_name: newName.trim() },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Erro ao criar funcionário');
      setCreating(false);
      return;
    }

    toast.success('Funcionário criado!');
    setNewEmail('');
    setNewName('');
    setNewPassword('');
    setDialogOpen(false);
    setCreating(false);
    load();
  };

  const togglePermission = async (userId: string, field: 'can_entry' | 'can_output', value: boolean) => {
    // Upsert permission
    const emp = employees.find(e => e.user_id === userId);
    if (!emp) return;

    const { error } = await supabase.from('employee_permissions').upsert({
      user_id: userId,
      can_entry: field === 'can_entry' ? value : emp.can_entry,
      can_output: field === 'can_output' ? value : emp.can_output,
    }, { onConflict: 'user_id' });

    if (error) { toast.error('Erro ao atualizar permissão'); return; }
    toast.success('Permissão atualizada!');
    load();
  };

  const removeRole = async (userId: string) => {
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'employee');
    await supabase.from('employee_permissions').delete().eq('user_id', userId);
    toast.success('Acesso removido!');
    load();
  };

  const promoteToSupervisor = async (userId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja promover ${name} a Supervisor? Esta ação dará acesso total ao sistema.`)) return;
    // Remove employee role and add supervisor
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('employee_permissions').delete().eq('user_id', userId);
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'supervisor' });
    if (error) { toast.error('Erro ao promover'); return; }
    toast.success(`${name} agora é Supervisor!`);
    load();
  };

  const employeeList = employees.filter(e => e.role === 'employee');
  const supervisorList = employees.filter(e => e.role === 'supervisor');
  const noAccess = employees.filter(e => e.role === 'sem acesso');

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Funcionários</h1>
          <p className="text-muted-foreground mt-1">Gerencie acessos e permissões</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Funcionário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Funcionário</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Nome</label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Email</label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Senha</label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Senha inicial" />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={creating}>
                {creating ? 'Criando...' : 'Criar Funcionário'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Supervisors */}
      {supervisorList.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Supervisores
          </h2>
          <div className="space-y-2">
            {supervisorList.map(emp => (
              <div key={emp.user_id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{emp.display_name}</p>
                  <p className="text-xs text-muted-foreground">{emp.email}</p>
                </div>
                <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded">Supervisor</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employees */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <User className="w-4 h-4" /> Funcionários ({employeeList.length})
        </h2>
        <div className="space-y-3">
          {employeeList.map(emp => (
            <div key={emp.user_id} className="glass-card rounded-xl p-4 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-foreground">{emp.display_name}</p>
                  <p className="text-xs text-muted-foreground">{emp.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => promoteToSupervisor(emp.user_id, emp.display_name)} title="Promover a Supervisor">
                    <ArrowUpCircle className="w-4 h-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeRole(emp.user_id)} title="Remover acesso">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={emp.can_entry} onCheckedChange={v => togglePermission(emp.user_id, 'can_entry', v)} />
                  <span className="text-muted-foreground">Entrada</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={emp.can_output} onCheckedChange={v => togglePermission(emp.user_id, 'can_output', v)} />
                  <span className="text-muted-foreground">Saída</span>
                </label>
              </div>
            </div>
          ))}
          {employeeList.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum funcionário cadastrado.</div>
          )}
        </div>
      </div>

      {/* No access */}
      {noAccess.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Sem acesso ({noAccess.length})</h2>
          <div className="space-y-2">
            {noAccess.map(emp => (
              <div key={emp.user_id} className="glass-card rounded-xl p-4 flex items-center justify-between opacity-60">
                <div>
                  <p className="font-medium text-foreground">{emp.display_name}</p>
                  <p className="text-xs text-muted-foreground">{emp.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">Aguardando</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
