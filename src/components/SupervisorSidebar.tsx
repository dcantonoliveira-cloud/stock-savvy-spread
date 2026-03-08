import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle, FileText, BarChart3, Users, LogOut, Bell, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/items', label: 'Estoque', icon: Package },
  { path: '/entries', label: 'Entradas', icon: ArrowUpCircle },
  { path: '/outputs', label: 'Saídas', icon: ArrowDownCircle },
  { path: '/sheets', label: 'Fichas Técnicas', icon: FileText },
  { path: '/comparison', label: 'Comparativo', icon: BarChart3 },
  { path: '/notifications', label: 'Notificações', icon: Bell },
  { path: '/analysis', label: 'Análise IA', icon: Brain },
  { path: '/users', label: 'Funcionários', icon: Users },
];

export default function SupervisorSidebar() {
  const { pathname } = useLocation();
  const { signOut, profile } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-50">
      <div className="p-6 border-b border-border">
        <h1 className="font-display text-xl font-bold gold-text tracking-wide">RONDELLO</h1>
        <p className="text-xs text-muted-foreground mt-1 tracking-widest uppercase">Painel do Supervisor</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-primary/10 text-primary gold-border border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border space-y-3">
        <div className="px-2">
          <p className="text-sm font-medium text-foreground truncate">{profile?.display_name}</p>
          <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" />Sair
        </Button>
      </div>
    </aside>
  );
}
