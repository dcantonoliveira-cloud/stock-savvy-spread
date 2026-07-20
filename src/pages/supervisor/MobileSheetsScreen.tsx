import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Share2, Copy, Camera, Loader2, Search, X, CheckCheck, ImageOff } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Sheet {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
}

// ─── Photo Viewer ─────────────────────────────────────────────────────────────
function PhotoViewer({
  sheet,
  onClose,
  onPhotoUpdated,
}: {
  sheet: Sheet;
  onClose: () => void;
  onPhotoUpdated: (id: string, url: string) => void;
}) {
  const [uploading, setUploading]   = useState(false);
  const [copying, setCopying]       = useState(false);
  const [sharing, setSharing]       = useState(false);
  const [imgError, setImgError]     = useState(false);
  const fileRef                     = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
    setUploading(true);
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `sheets/${sheet.id}.${ext}`;
      const { error } = await supabase.storage
        .from('item-images')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(path);
      const url = `${publicUrl}?t=${Date.now()}`;
      await (supabase.from as any)('technical_sheets').update({ image_url: url }).eq('id', sheet.id);
      onPhotoUpdated(sheet.id, url);
      setImgError(false);
      toast.success('Foto atualizada!');
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao fazer upload');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleShare = async () => {
    const url = sheet.image_url;
    if (!url) return;
    setSharing(true);
    try {
      if (navigator.share) {
        const res  = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], `${sheet.name}.jpg`, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: sheet.name });
        } else {
          await navigator.share({ url, title: sheet.name });
        }
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('URL copiada!');
      }
    } catch {
      // cancelled by user — ignore
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    const url = sheet.image_url;
    if (!url) return;
    setCopying(true);
    try {
      const res  = await fetch(url);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      toast.success('Imagem copiada!');
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('URL copiada (imagem não suportada neste browser)');
      } catch {
        toast.error('Não foi possível copiar');
      }
    } finally {
      setTimeout(() => setCopying(false), 1500);
    }
  };

  const displayUrl = sheet.image_url ?? '';

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Header */}
      <div
        className="relative flex items-center gap-3 px-4 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)', background: 'rgba(0,0,0,0.6)' }}
      >
        <button onClick={onClose} className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base leading-tight truncate">{sheet.name}</p>
          {sheet.category && <p className="text-white/50 text-xs truncate">{sheet.category}</p>}
        </div>
      </div>

      {/* Photo */}
      <div className="flex-1 flex items-center justify-center px-4 py-4">
        {!displayUrl || imgError ? (
          <div className="flex flex-col items-center gap-3 text-white/40">
            <ImageOff className="w-16 h-16" />
            <p className="text-sm">Sem foto cadastrada</p>
          </div>
        ) : (
          <img
            src={displayUrl}
            alt={sheet.name}
            className="max-w-full max-h-full rounded-2xl object-contain"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Actions */}
      <div
        className="flex items-center justify-around px-6 pt-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 1rem)', background: 'rgba(0,0,0,0.6)' }}
      >
        <button
          onClick={handleShare}
          disabled={!displayUrl || imgError || sharing}
          className="flex flex-col items-center gap-1.5 disabled:opacity-30"
        >
          {sharing ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Share2 className="w-6 h-6 text-white" />}
          <span className="text-[11px] text-white/70 font-medium">Compartilhar</span>
        </button>

        <button
          onClick={handleCopy}
          disabled={!displayUrl || imgError || copying}
          className="flex flex-col items-center gap-1.5 disabled:opacity-30"
        >
          {copying
            ? <CheckCheck className="w-6 h-6 text-emerald-400" />
            : <Copy className="w-6 h-6 text-white" />}
          <span className={`text-[11px] font-medium ${copying ? 'text-emerald-400' : 'text-white/70'}`}>
            {copying ? 'Copiado!' : 'Copiar'}
          </span>
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center gap-1.5 disabled:opacity-30"
        >
          {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
          <span className="text-[11px] text-white/70 font-medium">{uploading ? 'Enviando…' : 'Trocar foto'}</span>
        </button>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MobileSheetsScreen() {
  const [sheets, setSheets]       = useState<Sheet[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [viewing, setViewing]     = useState<Sheet | null>(null);

  useEffect(() => {
    (supabase.from as any)('technical_sheets')
      .select('id, name, image_url, sheet_categories(name)')
      .order('name')
      .then(({ data }: any) => {
        setSheets(
          (data ?? []).map((s: any) => ({
            id: s.id,
            name: s.name,
            image_url: s.image_url ?? null,
            category: s.sheet_categories?.name ?? null,
          }))
        );
        setLoading(false);
      });
  }, []);

  const handlePhotoUpdated = (id: string, url: string) => {
    setSheets(prev => prev.map(s => s.id === id ? { ...s, image_url: url } : s));
    setViewing(prev => prev?.id === id ? { ...prev, image_url: url } : prev);
  };

  const filtered = search.trim()
    ? sheets.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.category ?? '').toLowerCase().includes(search.toLowerCase()))
    : sheets;

  return (
    <>
      <div className="min-h-screen bg-[#f2f2f2] flex flex-col">
        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg, #0e1f4a 0%, #152d6b 100%)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}>
          <div className="relative overflow-hidden px-5 pt-8 pb-6">
            <div className="absolute top-4 right-6 w-24 h-24 rounded-full opacity-[0.06]"
                 style={{ background: '#C4973A' }} />
            <p className="text-[#C4973A] text-xs font-black uppercase tracking-[0.2em] mb-1">Cardápio</p>
            <h1 className="text-3xl font-black text-white leading-none">Fichas Técnicas</h1>
            <p className="text-white/50 text-sm mt-1">{loading ? '…' : `${sheets.length} fichas`}</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ficha…"
              className="w-full pl-10 pr-10 py-3 bg-white rounded-2xl text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 px-4 pb-36">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm animate-pulse">
                  <div className="w-full aspect-square bg-gray-100" />
                  <div className="p-3">
                    <div className="h-4 bg-gray-100 rounded-xl w-3/4" />
                    <div className="h-3 bg-gray-100 rounded-xl w-1/2 mt-1.5" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-4xl mb-3">🍽️</p>
              <p className="text-gray-500 text-sm">{search ? 'Nenhuma ficha encontrada' : 'Nenhuma ficha cadastrada'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pt-2">
              {filtered.map(sheet => (
                <button
                  key={sheet.id}
                  onClick={() => setViewing(sheet)}
                  className="bg-white rounded-3xl overflow-hidden shadow-sm text-left active:scale-[0.97] transition-transform"
                >
                  <div className="w-full aspect-square bg-gray-50 relative">
                    {sheet.image_url ? (
                      <img
                        src={sheet.image_url}
                        alt={sheet.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="w-8 h-8 text-gray-200" />
                      </div>
                    )}
                    {!sheet.image_url && (
                      <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-[#C4973A] flex items-center justify-center">
                        <Camera className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="px-3 pt-2.5 pb-3">
                    <p className="text-gray-900 font-bold text-sm leading-tight line-clamp-2">{sheet.name}</p>
                    {sheet.category && (
                      <p className="text-[11px] text-[#1D4ED8] font-semibold mt-0.5 truncate">{sheet.category}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewing && (
        <PhotoViewer
          sheet={viewing}
          onClose={() => setViewing(null)}
          onPhotoUpdated={handlePhotoUpdated}
        />
      )}
    </>
  );
}
