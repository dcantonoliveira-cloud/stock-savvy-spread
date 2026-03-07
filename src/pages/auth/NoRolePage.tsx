import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Clock } from 'lucide-react';

export default function NoRolePage() {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="glass-card rounded-2xl p-8 max-w-md text-center space-y-4">
        <Clock className="w-12 h-12 text-warning mx-auto" />
        <h1 className="font-display text-xl font-bold text-foreground">Aguardando Acesso</h1>
        <p className="text-sm text-muted-foreground">
          Olá{profile?.display_name ? `, ${profile.display_name}` : ''}! Sua conta foi criada mas ainda não tem permissão de acesso.
          Peça ao supervisor para liberar seu acesso.
        </p>
        <Button variant="outline" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" />Sair
        </Button>
      </div>
    </div>
  );
}
