import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import RichTextEditor from './RichTextEditor';

interface Props {
  eventId: string;
  scheduleText: string | null;
  scheduleFileUrl: string | null;
  scheduleFileName: string | null;
  onChangeText: (v: string) => void;
}

const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5';

export default function EventCronogramaTab({ eventId, scheduleText, scheduleFileUrl, scheduleFileName, onChangeText }: Props) {
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState(scheduleFileUrl);
  const [fileName, setFileName] = useState(scheduleFileName);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `event-schedules/${eventId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('event-files').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Erro no upload: ' + upErr.message); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('event-files').getPublicUrl(path);
    const { error: dbErr } = await supabase.from('events').update({
      schedule_file_url: publicUrl,
      schedule_file_name: file.name,
    }).eq('id', eventId);
    if (dbErr) { toast.error('Erro ao salvar: ' + dbErr.message); setUploading(false); return; }
    setFileUrl(publicUrl);
    setFileName(file.name);
    toast.success('Arquivo enviado');
    setUploading(false);
  };

  const removeFile = async () => {
    await supabase.from('events').update({ schedule_file_url: null, schedule_file_name: null }).eq('id', eventId);
    setFileUrl(null);
    setFileName(null);
    toast.success('Arquivo removido');
  };

  return (
    <div className="space-y-4">
      {/* Texto do cronograma */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Cronograma do Evento</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <RichTextEditor
          content={scheduleText ?? ''}
          onChange={onChangeText}
          placeholder="Descreva o cronograma da festa (horários, etapas, cerimônias...)."
        />
      </div>

      {/* Arquivo do cronograma */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Arquivo do Cronograma</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Assessores costumam enviar o cronograma em PDF ou Word. Suba o arquivo aqui para mantê-lo junto ao evento.
        </p>

        {fileUrl && fileName ? (
          <div className="flex items-center gap-3 p-3 border border-border rounded-xl bg-muted/30">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <a href={fileUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-sm font-medium text-primary hover:underline truncate">
              {fileName}
            </a>
            <button onClick={removeFile} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
            className="flex flex-col items-center gap-2 p-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="w-6 h-6 text-muted-foreground/50" />
            )}
            <p className="text-sm text-muted-foreground">{uploading ? 'Enviando...' : 'Clique ou arraste o arquivo aqui'}</p>
            <p className="text-xs text-muted-foreground/60">PDF, Word, Excel, imagens</p>
          </div>
        )}

        <input ref={inputRef} type="file" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
      </div>
    </div>
  );
}
