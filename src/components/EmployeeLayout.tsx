import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Package } from 'lucide-react';

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-display text-lg font-bold gold-text">RONDELLO</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">{profile?.display_name}</span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>
      <main className="p-4 max-w-2xl mx-auto">
        {children}
      </main>
    </div>
  );
}
