import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, ExternalLink } from 'lucide-react';
import type { PortalContextType } from './ClientPortalLayout';

type ContractFile = { id: string; name: string; url: string; created_at: string; size: number | null };

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

export default function PortalContratoPage() {
  const { event } = useOutletContext<PortalContextType>();
  const [files, setFiles] = useState<ContractFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!event) return;
    // Busca arquivos do tipo contrato
    (supabase.from as any)('event_files')
      .select('id, name, url, created_at, size')
      .eq('event_id', event.id)
      .ilike('name', '%contrato%')
      .order('created_at', { ascending: false })
      .then(({ data }: any) => {
        // Fallback: todos os arquivos se não houver "contrato" no nome
        if (data && data.length > 0) { setFiles(data); setLoading(false); return; }
        return (supabase.from as any)('event_files')
          .select('id, name, url, created_at, size')
          .eq('event_id', event.id)
          .order('created_at', { ascending: false });
      })
      .then((res: any) => {
        if (res) { setFiles(res.data ?? []); }
        setLoading(false);
      });
  }, [event]);

  if (!event) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contrato</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualize e baixe os documentos do seu evento.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum documento disponível ainda.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">O buffet enviará o contrato em breve.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map(f => (
            <div key={f.id} className="bg-white border border-border rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(f.created_at)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a href={f.url} download={f.name}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                  <Download className="w-3.5 h-3.5" />
                  Baixar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
