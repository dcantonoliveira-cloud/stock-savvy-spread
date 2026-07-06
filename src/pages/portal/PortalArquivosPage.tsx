import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FolderOpen, Download, ExternalLink, FileText } from 'lucide-react';
import type { PortalContextType } from './ClientPortalLayout';

type EventFile = { id: string; name: string; url: string; created_at: string; type: string | null };

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
const isPdf   = (name: string) => /\.pdf$/i.test(name);

export default function PortalArquivosPage() {
  const { event } = useOutletContext<PortalContextType>();
  const [files, setFiles]     = useState<EventFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!event) return;
    (supabase.from as any)('event_files')
      .select('id, name, url, created_at, type')
      .eq('event_id', event.id)
      .order('created_at', { ascending: false })
      .then(({ data }: any) => { setFiles(data ?? []); setLoading(false); });
  }, [event]);

  if (!event) return null;

  const images = files.filter(f => isImage(f.name));
  const docs   = files.filter(f => !isImage(f.name));

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Arquivos</h1>
        <p className="text-sm text-muted-foreground mt-1">Contrato e documentos compartilhados pelo buffet.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl p-10 text-center">
          <FolderOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum arquivo disponível ainda.</p>
        </div>
      ) : (
        <>
          {/* Documentos / Contrato */}
          {docs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 px-1">
                Documentos ({docs.length})
              </p>
              {docs.map(f => (
                <div key={f.id} className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {isPdf(f.name)
                      ? <FileText className="w-5 h-5 text-primary" />
                      : <FolderOpen className="w-5 h-5 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(f.created_at)}</p>
                  </div>
                  <a href={f.url} download={f.name}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0">
                    <Download className="w-3.5 h-3.5" />
                    Baixar
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Fotos */}
          {images.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 px-1">
                Fotos ({images.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map(f => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                    className="relative aspect-square rounded-2xl overflow-hidden border border-border group bg-muted">
                    <img src={f.url} alt={f.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
