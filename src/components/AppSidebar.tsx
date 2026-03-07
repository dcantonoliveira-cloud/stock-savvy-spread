import { Link, useLocation } from 'react-router-dom';
import { Package, ArrowDownCircle, FileText, BarChart3, LayoutDashboard } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/items', label: 'Estoque', icon: Package },
  { path: '/outputs', label: 'Saídas', icon: ArrowDownCircle },
  { path: '/sheets', label: 'Fichas Técnicas', icon: FileText },
  { path: '/comparison', label: 'Comparativo', icon: BarChart3 },
];

export default function AppSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-50">
      <div className="p-6 border-b border-border">
        <h1 className="font-display text-xl font-bold gold-text tracking-wide">RONDELLO</h1>
        <p className="text-xs text-muted-foreground mt-1 tracking-widest uppercase">Controle de Estoque</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
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
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">Rondello Buffet © 2026</p>
      </div>
    </aside>
  );
}
