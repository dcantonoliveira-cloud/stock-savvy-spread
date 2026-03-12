import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, ChefHat, Home, Receipt } from 'lucide-react';

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  const { signOut, profile } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <ChefHat className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold gold-text tracking-wide">RONDELLO</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold">
              {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span className="text-sm text-muted-foreground hidden sm:block font-medium">{profile?.display_name}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="hover:bg-destructive/10 hover:text-destructive rounded-xl">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border/50 flex z-50">
        <Link
          to="/"
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
            pathname === '/' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Home className="w-5 h-5" />
          Estoque
        </Link>
        <Link
          to="/invoices"
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
            pathname === '/invoices' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Receipt className="w-5 h-5" />
          Nota Fiscal
        </Link>
      </nav>
    </div>
  );
}
