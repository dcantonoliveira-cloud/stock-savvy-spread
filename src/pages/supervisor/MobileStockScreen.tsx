import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Search, ArrowUpCircle, ArrowDownCircle, Camera, X,
  Loader2, CheckCircle, AlertCircle, ChevronLeft, Package,
  FileImage,
} from 'lucide-react';

const RON_950 = '#0e1f4a';
const RON_900 = '#152d6b';
const GOLD_400 = '#C4973A';

type StockItem = { id: string; name: string; unit: string; current_stock: number; category: string };
type ParsedItem = { name: string; quantity: number; unit_cost: number; unit: string; matched_item_id: string | null; matched_item_name: string | null; status: string };
type Mode = 'home' | 'manual' | 'nf';

// ─── Hero ────────────────────────────────────────────────────────────────────
function Hero({ title, sub, onBack }: { title: string; sub?: string; onBack?: () => void }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${RON_950} 0%, ${RON_900} 100%)`, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="relative px-5 pt-8 pb-6">
        {onBack && (
          <button onClick={onBack} className="absolute left-4 top-8 text-white/60 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <h1 className="text-3xl font-bold text-white tracking-tight">{title}</h1>
        {sub && <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Manual Entry/Exit ───────────────────────────────────────────────────────
function ManualScreen({ onBack }: { onBack: () => void }) {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StockItem | null>(null);
  const [mode, setMode] = useState<'entry' | 'output' | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('stock_items').select('id, name, unit, current_stock, category' as any)
      .order('name').range(0, 9999)
      .then(({ data }) => { if (data) setItems(data as unknown as StockItem[]); setLoading(false); });
  }, []);

  const results = search.trim()
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  const handleSubmit = async () => {
    if (!selected || !user || !quantity || parseFloat(quantity) <= 0) {
      toast.error('Informe uma quantidade válida'); return;
    }
    setSubmitting(true);
    if (mode === 'entry') {
      const { error } = await supabase.from('stock_entries').insert({
        item_id: selected.id, quantity: parseFloat(quantity),
        notes: notes.trim() || null, registered_by: user.id,
      });
      if (error) toast.error('Erro ao registrar entrada');
      else { toast.success(`✅ Entrada de ${quantity} ${selected.unit} de ${selected.name}`); reset(); }
    } else {
      const { error } = await supabase.from('stock_outputs').insert({
        item_id: selected.id, quantity: parseFloat(quantity),
        employee_name: profile?.display_name || user.email || '',
        notes: notes.trim() || null, registered_by: user.id,
      });
      if (error) toast.error('Erro ao registrar saída');
      else { toast.success(`✅ Saída de ${quantity} ${selected.unit} de ${selected.name}`); reset(); }
    }
    setSubmitting(false);
  };

  const reset = () => { setSelected(null); setMode(null); setQuantity(''); setNotes(''); setSearch(''); };

  // Item detail view
  if (selected && mode === null) {
    return (
      <>
        <Hero title={selected.name} sub={`${selected.current_stock} ${selected.unit} em estoque`} onBack={reset} />
        <div className="p-4 space-y-3">
          <button onClick={() => setMode('entry')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 active:scale-[0.98] transition-transform">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <ArrowUpCircle className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="font-bold text-emerald-800">Dar Entrada</p>
              <p className="text-sm text-emerald-600">Aumentar estoque</p>
            </div>
          </button>
          <button onClick={() => setMode('output')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-red-200 bg-red-50 active:scale-[0.98] transition-transform">
            <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
              <ArrowDownCircle className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="font-bold text-red-800">Dar Saída</p>
              <p className="text-sm text-red-600">Diminuir estoque</p>
            </div>
          </button>
        </div>
      </>
    );
  }

  // Entry/exit form
  if (selected && mode !== null) {
    const isEntry = mode === 'entry';
    return (
      <>
        <Hero
          title={isEntry ? 'Dar Entrada' : 'Dar Saída'}
          sub={selected.name}
          onBack={() => setMode(null)}
        />
        <div className="p-4 space-y-4">
          <div className={`rounded-2xl border-2 p-4 ${isEntry ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isEntry ? 'text-emerald-600' : 'text-red-600'}`}>Estoque atual</p>
            <p className={`text-2xl font-bold ${isEntry ? 'text-emerald-800' : 'text-red-800'}`}>{selected.current_stock} <span className="text-base font-normal">{selected.unit}</span></p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Quantidade ({selected.unit})</label>
            <input
              type="number" inputMode="decimal"
              className="w-full h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-gray-400"
              placeholder="0"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Observação (opcional)</label>
            <input
              type="text"
              className="w-full h-11 px-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-gray-400 text-sm"
              placeholder="Ex: compra do fornecedor X"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !quantity || parseFloat(quantity) <= 0}
            className={`w-full h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-all ${isEntry ? 'bg-emerald-500' : 'bg-red-500'}`}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEntry ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />)}
            {isEntry ? 'Confirmar Entrada' : 'Confirmar Saída'}
          </button>
        </div>
      </>
    );
  }

  // Search view
  return (
    <>
      <Hero title="Entrada / Saída" sub="Selecione o insumo" onBack={onBack} />
      <div className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text" autoFocus
            className="w-full h-12 pl-11 pr-4 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-gray-400 text-sm bg-white"
            placeholder="Buscar insumo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
        </div>

        {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}

        {!loading && search.trim() === '' && (
          <p className="text-center text-gray-400 text-sm pt-10">Digite para buscar um insumo</p>
        )}

        {results.length === 0 && search.trim() !== '' && !loading && (
          <p className="text-center text-gray-400 text-sm pt-10">Nenhum item encontrado</p>
        )}

        <div className="space-y-2">
          {results.map(item => (
            <button key={item.id} onClick={() => setSelected(item)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-gray-100 bg-white active:scale-[0.98] transition-transform text-left">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-400">{item.category}</p>
              </div>
              <p className="text-sm font-bold text-gray-700 flex-shrink-0">{item.current_stock} <span className="font-normal text-gray-400">{item.unit}</span></p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── NF Photo Screen ─────────────────────────────────────────────────────────
function NfScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<{ supplier: string; invoice_number: string; items: ParsedItem[] } | null>(null);
  const [items, setItems] = useState<StockItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('stock_items').select('id, name, unit, current_stock, category' as any)
      .order('name').range(0, 9999)
      .then(({ data }) => { if (data) setItems(data as unknown as StockItem[]); });
  }, []);

  const matchItems = (raw: any[]): ParsedItem[] => {
    return raw.map(pi => {
      const match = items.find(s =>
        s.name.toLowerCase().includes(pi.name.toLowerCase().slice(0, 6)) ||
        pi.name.toLowerCase().includes(s.name.toLowerCase().slice(0, 6))
      );
      return { name: pi.name, quantity: pi.quantity, unit_cost: pi.unit_cost || 0, unit: pi.unit || 'un', matched_item_id: match?.id || null, matched_item_name: match?.name || null, status: match ? 'matched' : 'unmatched' };
    });
  };

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'heic' || ext === 'heif') { toast.error('Formato HEIC não suportado. Use JPG.'); return; }
    setParsing(true);
    setParsed(null);
    try {
      const isXml = ext === 'xml' || file.type === 'text/xml';
      if (isXml) {
        const text = await file.text();
        // minimal XML parse
        const getTag = (t: string) => text.match(new RegExp(`<${t}[^>]*>([^<]*)</${t}>`))?.[1] ?? '';
        toast.error('Use imagem ou PDF da NF para leitura via IA');
        setParsing(false);
        return;
      }
      const extMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };
      const mimeType = file.type || extMap[ext] || 'application/pdf';
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.byteLength; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      const base64 = btoa(binary);
      const { data, error } = await supabase.functions.invoke('parse-invoice', { body: { base64, mimeType } });
      if (error || data?.error) throw new Error(error?.message || data?.error || 'Erro ao processar');
      setParsed({ supplier: data.supplier || '', invoice_number: data.invoice_number || '', items: matchItems(data.items || []) });
      toast.success('NF processada! Revise os itens.');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar o arquivo');
    } finally {
      setParsing(false);
    }
  };

  const confirm = async () => {
    if (!parsed || !user) return;
    setSubmitting(true);
    try {
      const { data: defaultKitchen } = await supabase.from('kitchens').select('id').eq('is_default', true).single();
      const allItems = [...parsed.items];
      for (let i = 0; i < allItems.length; i++) {
        if (!allItems[i].matched_item_id) {
          const name = allItems[i].name.trim();
          if (!name) continue;
          const { data: created } = await supabase.from('stock_items').insert({ name, unit: allItems[i].unit, unit_cost: allItems[i].unit_cost || 0, category: 'Outros', current_stock: 0, min_stock: 0 } as any).select('id').single();
          if (created && defaultKitchen) {
            await supabase.from('stock_item_locations').insert({ item_id: (created as any).id, kitchen_id: defaultKitchen.id, current_stock: 0 } as any);
            allItems[i] = { ...allItems[i], matched_item_id: (created as any).id };
          }
        }
      }
      const valid = allItems.filter(i => i.matched_item_id);
      if (valid.length === 0) { toast.error('Nenhum item pôde ser importado'); return; }
      const { error } = await supabase.from('stock_entries').insert(valid.map(i => ({
        item_id: i.matched_item_id!, quantity: i.quantity, unit_cost: i.unit_cost || null,
        supplier: parsed.supplier || null, invoice_number: parsed.invoice_number || null,
        notes: 'Importado via NF (mobile)', registered_by: user.id,
      })));
      if (error) throw error;
      toast.success(`${valid.length} entrada(s) registrada(s)!`);
      setParsed(null);
    } catch (e: any) {
      toast.error('Erro ao registrar entradas');
    } finally {
      setSubmitting(false);
    }
  };

  const updateItem = (idx: number, field: keyof ParsedItem, value: any) => {
    if (!parsed) return;
    const updated = [...parsed.items];
    (updated[idx] as any)[field] = value;
    setParsed({ ...parsed, items: updated });
  };

  const removeItem = (idx: number) => {
    if (!parsed) return;
    setParsed({ ...parsed, items: parsed.items.filter((_, i) => i !== idx) });
  };

  if (parsed) {
    const matched = parsed.items.filter(i => i.matched_item_id).length;
    return (
      <>
        <Hero title="Revisar NF" sub={`${parsed.items.length} itens`} onBack={() => setParsed(null)} />
        <div className="p-4 space-y-3 pb-32">
          {parsed.supplier && (
            <div className="rounded-2xl border-2 border-gray-100 bg-white px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Fornecedor</p>
              <p className="font-semibold text-gray-800 mt-0.5">{parsed.supplier}</p>
              {parsed.invoice_number && <p className="text-xs text-gray-400">NF {parsed.invoice_number}</p>}
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1 rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{matched}</p>
              <p className="text-[11px] text-emerald-600 font-medium">vinculados</p>
            </div>
            <div className="flex-1 rounded-2xl border-2 border-amber-100 bg-amber-50 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{parsed.items.length - matched}</p>
              <p className="text-[11px] text-amber-600 font-medium">novos</p>
            </div>
          </div>

          {parsed.items.map((item, idx) => (
            <div key={idx} className={`rounded-2xl border-2 bg-white overflow-hidden ${item.matched_item_id ? 'border-gray-100' : 'border-amber-200'}`}>
              {/* Header do item */}
              <div className={`flex items-center gap-2 px-4 py-3 ${item.matched_item_id ? 'bg-gray-50' : 'bg-amber-50'}`}>
                {item.matched_item_id
                  ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm leading-tight truncate">
                    {item.matched_item_name || item.name}
                  </p>
                  {item.matched_item_name && item.matched_item_name !== item.name && (
                    <p className="text-[11px] text-gray-400 truncate">NF: {item.name}</p>
                  )}
                  {!item.matched_item_id && (
                    <p className="text-[11px] text-amber-600 font-medium">Será criado como novo insumo</p>
                  )}
                </div>
                <button onClick={() => removeItem(idx)} className="p-1 text-gray-300 hover:text-red-400 flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Campos editáveis */}
              <div className="flex gap-0 divide-x divide-gray-100">
                <div className="flex-1 px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Qtd</p>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full h-10 text-center text-lg font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value.replace(',', '.'))}
                  />
                  <p className="text-[10px] text-gray-400 text-center mt-1">{item.unit}</p>
                </div>
                <div className="flex-1 px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Preço unit.</p>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full h-10 pl-7 text-right text-sm font-semibold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white"
                      value={item.unit_cost || ''}
                      placeholder="0,00"
                      onChange={e => updateItem(idx, 'unit_cost', parseFloat(e.target.value.replace(',', '.')) || 0)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="fixed bottom-20 left-4 right-4 z-40">
          <button onClick={confirm} disabled={submitting || parsed.items.length === 0}
            className="w-full h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl"
            style={{ background: `linear-gradient(135deg, ${RON_950}, ${RON_900})` }}>
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Confirmar {parsed.items.length} entrada(s)
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Hero title="Nota Fiscal" sub="Foto ou arquivo" onBack={onBack} />
      <div className="p-4 space-y-4">
        {parsing ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: GOLD_400 }} />
            <p className="text-gray-500 font-medium">Lendo a nota fiscal com IA...</p>
          </div>
        ) : (
          <>
            {/* Camera */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            {/* File picker */}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

            <button onClick={() => cameraRef.current?.click()}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 active:scale-[0.98] transition-transform"
              style={{ borderColor: GOLD_400, background: `${GOLD_400}10` }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: GOLD_400 }}>
                <Camera className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900">Tirar foto</p>
                <p className="text-sm text-gray-500">Aponte a câmera para a NF</p>
              </div>
            </button>

            <button onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-200 bg-white active:scale-[0.98] transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <FileImage className="w-7 h-7 text-gray-500" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900">Escolher arquivo</p>
                <p className="text-sm text-gray-500">PDF ou imagem da galeria</p>
              </div>
            </button>

            <p className="text-xs text-center text-gray-400 pt-2">
              A IA vai ler os itens automaticamente e criar os que não existirem no estoque.
            </p>
          </>
        )}
      </div>
    </>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function MobileStockScreen() {
  const [mode, setMode] = useState<Mode>('home');

  if (mode === 'manual') return <ManualScreen onBack={() => setMode('home')} />;
  if (mode === 'nf') return <NfScreen onBack={() => setMode('home')} />;

  return (
    <>
      <Hero title="Estoque" sub="Movimentações" />
      <div className="p-4 space-y-4 pt-6">
        <button onClick={() => setMode('manual')}
          className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 bg-white shadow-sm active:scale-[0.98] transition-transform">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: `linear-gradient(135deg, ${RON_950}, ${RON_900})` }}>
            <ArrowUpCircle className="w-7 h-7 text-white" />
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-900 text-lg">Entrada / Saída</p>
            <p className="text-sm text-gray-500">Movimentação manual de insumos</p>
          </div>
        </button>

        <button onClick={() => setMode('nf')}
          className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 active:scale-[0.98] transition-transform"
          style={{ borderColor: `${GOLD_400}60`, background: `${GOLD_400}08` }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: GOLD_400 }}>
            <Camera className="w-7 h-7 text-white" />
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-900 text-lg">Nota Fiscal</p>
            <p className="text-sm text-gray-500">Foto ou PDF — IA lê os itens</p>
          </div>
        </button>
      </div>
    </>
  );
}
