import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode; fallbackRoute?: string; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    // Chunk antigo após deploy novo → recarrega automaticamente uma vez
    if (error.message?.includes('Failed to fetch dynamically imported module') ||
        error.message?.includes('Importing a module script failed')) {
      const reloadKey = 'chunk_reload_attempted';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      }
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-8">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Algo deu errado nesta página</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error.message || 'Erro inesperado'}
          </p>
        </div>
        <button
          onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Recarregar página
        </button>
      </div>
    );
  }
}
