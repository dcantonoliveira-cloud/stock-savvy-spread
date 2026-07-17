import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode; fallbackRoute?: string; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  isChunkError() {
    const msg = this.state.error?.message ?? '';
    return msg.includes('Failed to fetch dynamically imported module') ||
           msg.includes('Importing a module script failed');
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-8">
        <>
          {this.isChunkError() ? (
            <RefreshCw className="w-10 h-10 text-primary" />
          ) : (
            <AlertTriangle className="w-12 h-12 text-destructive" />
          )}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {this.isChunkError() ? 'Nova versão disponível' : 'Algo deu errado nesta página'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              {this.isChunkError()
                ? 'O sistema foi atualizado. Clique abaixo para carregar a versão mais recente.'
                : (this.state.error.message || 'Erro inesperado')}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-2 max-w-md font-mono break-all">
              {this.state.error.message}
            </p>
          </div>
        </>
        <button
          onClick={async () => {
            try {
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister()));
              }
              if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
              }
            } catch (_) {}
            sessionStorage.clear();
            localStorage.removeItem('__chunk_v');
            // Force browser to fetch fresh HTML — bypass all caches
            const url = new URL(window.location.href);
            url.searchParams.set('_', Date.now().toString());
            window.location.replace(url.toString());
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {this.isChunkError() ? 'Atualizar agora' : 'Recarregar página'}
        </button>
      </div>
    );
  }
}
