import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Upload, FileText, Camera, FileCode, Loader2, Check, X, AlertTriangle, PackagePlus, Download, Receipt, ShoppingCart, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Item = { id: string; name: string; unit: string; current_stock: number; barcode: string | null };
type Entry = { id: string; item_id: string; quantity: number; unit_cost: number | null; supplier: string | null; invoice_number: string | null; notes: string | null; date: string; created_at: string };

type ParsedItem = {
  name: string;
  quantity: number;
  unit_cost: number;
  unit: string;
  barcode: string | null;
  matched_item_id: string | null;
  matched_item_name: string | null;
  status: 'matched' | 'unmatched' | 'creating';
};

type ParsedInvoice = {
  supplier: string;
  invoice_number: string;
  items: ParsedItem[];
};

const exportCsv = (rows: string[][], filename: string) => {
  const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─── Searchable item combobox ───
function ItemSearchCombobox({ items, value, onChange }: {
  items: { id: string; name: string; unit: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find(i => i.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 w-full justify-between text-xs font-normal px-2">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : 'Vincular...'}
          </span>
          <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-50 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar insumo..." className="h-8 text-xs" />
          <CommandList className="max-h-48">
            <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">Não encontrado</CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem value="__clear__" onSelect={() => { onChange(null); setOpen(false); }} className="text-xs text-destructive">
                  <X className="w-3 h-3 mr-2 shrink-0" />
                  Desvincular (criar novo no estoque)
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {items.map(item => (
                <CommandItem key={item.id} value={item.name} onSelect={() => { onChange(item.id); setOpen(false); }} className="text-xs">
                  <Check className={cn("w-3 h-3 mr-2 shrink-0", value === item.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{item.name}</span>
                  <span className="ml-auto text-muted-foreground text-[10px] shrink-0">{item.unit}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function EntriesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // NF import state
  const [nfDialogOpen, setNfDialogOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedInvoice, setParsedInvoice] = useState<ParsedInvoice | null>(null);
  const [submittingNf, setSubmittingNf] = useState(false);
  const [importType, setImportType] = useState<'nf' | 'cupom' | 'recibo'>('nf');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fix orphan entry state
  const [fixEntry, setFixEntry] = useState<typeof entries[0] | null>(null);
  const [fixName, setFixName] = useState('');
  const [fixUnit, setFixUnit] = useState('un');
  const [fixCategory, setFixCategory] = useState('Outros');
  const [fixLoading, setFixLoading] = useState(false);

  const load = async () => {
    const [itemsRes, entriesRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, unit, current_stock, barcode').order('name'),
      supabase.from('stock_entries').select('*').order('created_at', { ascending: false }),
    ]);
    if (itemsRes.data) setItems(itemsRes.data as Item[]);
    if (entriesRes.data) setEntries(entriesRes.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e => {
    const item = items.find(i => i.id === e.item_id);
    const matchDate = filterDate ? e.date === filterDate : true;
    const q = search.toLowerCase();
    const matchSearch = q
      ? (item?.name || '').toLowerCase().includes(q) ||
        (e.supplier || '').toLowerCase().includes(q)
      : true;
    return matchDate && matchSearch;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const resetForm = () => { setItemId(''); setQuantity(''); setUnitCost(''); setSupplier(''); setInvoiceNumber(''); setNotes(''); };

  const handleSave = async () => {
    if (!itemId) { toast.error('Selecione um item'); return; }
    if (!quantity || parseFloat(quantity) <= 0) { toast.error('Quantidade inválida'); return; }
    if (!user) return;

    const { error } = await supabase.from('stock_entries').insert({
      item_id: itemId,
      quantity: parseFloat(quantity),
      unit_cost: unitCost ? parseFloat(unitCost) : null,
      supplier: supplier.trim() || null,
      invoice_number: invoiceNumber.trim() || null,
      notes: notes.trim() || null,
      registered_by: user.id,
    });

    if (error) { toast.error('Erro ao registrar'); return; }
    toast.success('Entrada registrada!');
    resetForm();
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('stock_entries').delete().eq('id', id);
    toast.success('Entrada removida!');
    load();
  };

  const handleFixConfirm = async () => {
    if (!fixEntry || !fixName.trim()) { toast.error('Digite o nome do insumo'); return; }
    setFixLoading(true);
    try {
      // Try to find existing item first
      let itemId: string | null = null;
      const existing = items.find(i => i.name.toLowerCase().trim() === fixName.toLowerCase().trim());
      if (existing) {
        itemId = existing.id;
      } else {
        // Create new stock item
        const { data: created, error } = await supabase.from('stock_items').insert({
          name: fixName.trim(),
          unit: fixUnit,
          unit_cost: fixEntry.unit_cost || 0,
          category: fixCategory,
          current_stock: 0,
          min_stock: 0,
        } as any).select('id, name').single();
        if (error || !created) throw error;
        itemId = (created as any).id;
        // Link to default kitchen
        const { data: dk } = await supabase.from('kitchens').select('id').eq('is_default', true).single();
        if (dk) await supabase.from('stock_item_locations').insert({ item_id: itemId, kitchen_id: dk.id, current_stock: 0 } as any);
        toast.success(`Insumo "${fixName.trim()}" criado!`);
      }
      // Update the entry to point to this item
      await supabase.from('stock_entries').update({ item_id: itemId } as any).eq('id', fixEntry.id);
      toast.success('Entrada corrigida!');
      setFixEntry(null);
      load();
    } catch (e: any) {
      toast.error('Erro ao corrigir entrada');
      console.error(e);
    } finally {
      setFixLoading(false);
    }
  };

  const handleExportCsv = () => {
    const header = ['Data', 'Item', 'Quantidade', 'Unidade', 'Custo Unit.', 'Fornecedor', 'NF', 'Observações'];
    const rows = filtered.map(e => {
      const item = items.find(i => i.id === e.item_id);
      return [
        new Date(e.date).toLocaleDateString('pt-BR'),
        item?.name || '',
        String(e.quantity),
        item?.unit || '',
        e.unit_cost != null ? String(e.unit_cost) : '',
        e.supplier || '',
        e.invoice_number || '',
        e.notes || '',
      ];
    });
    exportCsv([header, ...rows], `entradas-${filterDate || 'todos'}.csv`);
  };

  const selectedItem = items.find(i => i.id === itemId);

  // ─── NF Import Logic ───

  // Client-side XML parser (NF-e) — no edge function needed
  const parseXmlInvoice = (xml: string) => {
    const tag = (name: string) => new RegExp(`<(?:[\\w]+:)?${name}>([\\s\\S]*?)<\\/(?:[\\w]+:)?${name}>`, 'i');
    const tagG = (name: string) => new RegExp(`<(?:[\\w]+:)?${name}[\\s\\S]*?<\\/(?:[\\w]+:)?${name}>`, 'g');
    const decode = (s: string) => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&quot;/g,'"');
    const normalizeUnit = (u: string) => {
      const m: Record<string,string> = { KG:'kg',G:'g',GR:'g',L:'L',LT:'L',ML:'ml',UN:'un',UND:'un',UNID:'un',CX:'cx',PCT:'pct',PC:'un',FD:'cx',DZ:'un',LATA:'lata',GAR:'garrafa',GF:'garrafa' };
      return m[u.toUpperCase().trim()] || u.toLowerCase();
    };
    const invoiceNumber = xml.match(tag('nNF'))?.[1]?.trim() || '';
    const supplierRaw = xml.match(/<(?:[\w]+:)?emit>[\s\S]*?<(?:[\w]+:)?xNome>(.*?)<\/(?:[\w]+:)?xNome>/i)?.[1] || '';
    const supplier = decode(supplierRaw.trim());
    const parsedItems: any[] = [];
    const detRe = tagG('det');
    let m;
    while ((m = detRe.exec(xml)) !== null) {
      const b = m[0];
      const name = decode((b.match(tag('xProd'))?.[1] || '').trim());
      if (!name) continue;
      const quantity = parseFloat(b.match(tag('qCom'))?.[1] || '0');
      const unit_cost = parseFloat(b.match(tag('vUnCom'))?.[1] || '0');
      const unit = normalizeUnit((b.match(tag('uCom'))?.[1] || 'un').trim());
      const ean = (b.match(tag('cEAN'))?.[1] || '').trim();
      parsedItems.push({ name, quantity, unit_cost: Math.round(unit_cost * 100) / 100, unit, barcode: ean && ean !== 'SEM GTIN' ? ean : null });
    }
    return { supplier, invoice_number: invoiceNumber, items: parsedItems };
  };

  // Normalize string: lowercase, remove accents, remove non-alphanumeric
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9\s]/g, '')                      // keep only letters/numbers/spaces
      .replace(/\s+/g, ' ').trim();

  // Returns a score 0-1 of how similar two normalized strings are
  const similarityScore = (a: string, b: string): number => {
    if (a === b) return 1;
    const wordsA = a.split(' ').filter(w => w.length > 2); // ignore short words like "g", "de"
    const wordsB = b.split(' ').filter(w => w.length > 2);
    if (wordsA.length === 0 || wordsB.length === 0) return 0;
    const matches = wordsA.filter(w => wordsB.some(wb => wb.includes(w) || w.includes(wb)));
    return matches.length / Math.max(wordsA.length, wordsB.length);
  };

  const matchItems = (parsedItems: any[]): ParsedItem[] => {
    return parsedItems.map(pi => {
      // 1. Try barcode match first (exact)
      let match = pi.barcode ? items.find(i => i.barcode === pi.barcode) : null;

      // 2. Fuzzy name match
      if (!match) {
        const piNorm = normalize(pi.name);
        let bestScore = 0;
        let bestItem: typeof items[0] | null = null;
        for (const item of items) {
          const iNorm = normalize(item.name);
          // Exact or substring match
          if (iNorm === piNorm || piNorm.includes(iNorm) || iNorm.includes(piNorm)) {
            bestItem = item;
            bestScore = 1;
            break;
          }
          // Word overlap score
          const score = similarityScore(piNorm, iNorm);
          if (score > bestScore && score >= 0.5) { // at least 50% word overlap
            bestScore = score;
            bestItem = item;
          }
        }
        match = bestItem || null;
      }

      return {
        name: pi.name,
        quantity: pi.quantity,
        unit_cost: pi.unit_cost,
        unit: pi.unit || 'un',
        barcode: pi.barcode || null,
        matched_item_id: match?.id || null,
        matched_item_name: match?.name || null,
        status: match ? 'matched' : 'unmatched',
      } as ParsedItem;
    });
  };

  const handleFileUpload = async (file: File) => {
    setParsing(true);
    setParsedInvoice(null);

    try {
      const isXml = file.name.toLowerCase().endsWith('.xml') || file.type === 'text/xml' || file.type === 'application/xml';

      if (isXml) {
        // Parse XML entirely on the client — no edge function needed
        const text = await file.text();
        const data = parseXmlInvoice(text);
        if (data.items.length === 0) throw new Error('Nenhum produto encontrado no XML. Verifique se é um arquivo NF-e válido.');
        const matched = matchItems(data.items);
        setParsedInvoice({ supplier: data.supplier || '', invoice_number: data.invoice_number || '', items: matched });
      } else {
        // PDF or image — send to edge function (AI)
        const buffer = await file.arrayBuffer();
        // btoa safe for large files
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const mimeType = file.type || 'application/pdf';

        const { data, error } = await supabase.functions.invoke('parse-invoice', {
          body: { base64, mimeType },
        });
        if (error) throw new Error('Serviço de IA indisponível. Para PDF e fotos, o sistema precisa da Edge Function implantada no Supabase. Para XML, use o arquivo .xml diretamente.');
        const matched = matchItems(data.items || []);
        setParsedInvoice({ supplier: data.supplier || '', invoice_number: data.invoice_number || '', items: matched });
      }

      toast.success('Documento processado! Revise os itens abaixo.');
    } catch (e: any) {
      console.error('NF parse error:', e);
      toast.error(e.message || 'Erro ao processar o documento');
    } finally {
      setParsing(false);
    }
  };

  const handleNfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  const updateParsedItem = (idx: number, field: string, value: any) => {
    if (!parsedInvoice) return;
    const updated = [...parsedInvoice.items];
    if (field === 'matched_item_id') {
      const match = value ? items.find(i => i.id === value) : null;
      updated[idx] = { ...updated[idx], matched_item_id: value || null, matched_item_name: match?.name || null, status: match ? 'matched' : 'unmatched' };
    } else {
      (updated[idx] as any)[field] = value;
    }
    setParsedInvoice({ ...parsedInvoice, items: updated });
  };

  const removeParsedItem = (idx: number) => {
    if (!parsedInvoice) return;
    setParsedInvoice({ ...parsedInvoice, items: parsedInvoice.items.filter((_, i) => i !== idx) });
  };

  const createItemFromParsed = async (idx: number) => {
    if (!parsedInvoice) return;
    const pi = parsedInvoice.items[idx];
    if (!pi.name.trim()) { toast.error('Produto sem nome — edite o nome antes de criar'); return; }
    updateParsedItem(idx, 'status', 'creating');

    const { data, error } = await supabase.from('stock_items').insert({
      name: pi.name.trim(),
      unit: pi.unit,
      unit_cost: pi.unit_cost,
      category: 'Outros',
      current_stock: 0,
      min_stock: 0,
      barcode: pi.barcode,
    } as any).select('id, name').single();

    if (error || !data) {
      toast.error(`Erro ao criar "${pi.name}"`);
      updateParsedItem(idx, 'status', 'unmatched');
      return;
    }

    // Also link to default kitchen
    const { data: defaultKitchen } = await supabase.from('kitchens').select('id').eq('is_default', true).single();
    if (defaultKitchen) {
      await supabase.from('stock_item_locations').insert({
        item_id: (data as any).id,
        kitchen_id: defaultKitchen.id,
        current_stock: 0,
      } as any);
    }

    setItems(prev => [...prev, { id: (data as any).id, name: (data as any).name, unit: pi.unit, current_stock: 0, barcode: pi.barcode }].sort((a, b) => a.name.localeCompare(b.name)));
    updateParsedItem(idx, 'matched_item_id', (data as any).id);
    updateParsedItem(idx, 'matched_item_name', (data as any).name);
    toast.success(`"${pi.name}" criado no estoque!`);
  };

  const confirmNfImport = async () => {
    if (!parsedInvoice || !user) return;
    if (parsedInvoice.items.length === 0) { toast.error('Nenhum item para importar'); return; }

    setSubmittingNf(true);
    try {
      const importLabel = importType === 'cupom' ? 'Cupom Fiscal' : importType === 'recibo' ? 'Recibo' : 'NF';
      const allItems = [...parsedInvoice.items];

      // Auto-create unmatched items
      const { data: defaultKitchen } = await supabase.from('kitchens').select('id').eq('is_default', true).single();
      for (let i = 0; i < allItems.length; i++) {
        if (!allItems[i].matched_item_id) {
          const name = allItems[i].name.trim();
          if (!name) continue;
          const { data: created } = await supabase.from('stock_items').insert({
            name,
            unit: allItems[i].unit,
            unit_cost: allItems[i].unit_cost || 0,
            category: 'Outros',
            current_stock: 0,
            min_stock: 0,
            barcode: allItems[i].barcode,
          } as any).select('id, name').single();
          if (created) {
            if (defaultKitchen) {
              await supabase.from('stock_item_locations').insert({ item_id: (created as any).id, kitchen_id: defaultKitchen.id, current_stock: 0 } as any);
            }
            allItems[i] = { ...allItems[i], matched_item_id: (created as any).id };
          }
        }
      }

      const validItems = allItems.filter(i => i.matched_item_id);
      if (validItems.length === 0) { toast.error('Nenhum item pôde ser importado'); return; }

      const inserts = validItems.map(i => ({
        item_id: i.matched_item_id!,
        quantity: i.quantity,
        unit_cost: i.unit_cost || null,
        supplier: parsedInvoice.supplier || null,
        invoice_number: parsedInvoice.invoice_number || null,
        notes: `Importado via ${importLabel}`,
        registered_by: user.id,
      }));

      const { error } = await supabase.from('stock_entries').insert(inserts);
      if (error) throw error;

      // Update unit_cost on stock_items
      for (const i of validItems) {
        if (i.unit_cost > 0) {
          await supabase.from('stock_items').update({ unit_cost: i.unit_cost } as any).eq('id', i.matched_item_id!);
        }
      }

      toast.success(`${validItems.length} entrada(s) registrada(s) via ${importLabel}!`);
      setParsedInvoice(null);
      setNfDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error('Erro ao registrar entradas');
      console.error(e);
    } finally {
      setSubmittingNf(false);
    }
  };

  const matchedCount = parsedInvoice?.items.filter(i => i.matched_item_id).length || 0;
  const unmatchedCount = parsedInvoice?.items.filter(i => !i.matched_item_id).length || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Entradas</h1>
          <p className="text-muted-foreground mt-1">Registre o recebimento de mercadorias</p>
        </div>
        <div className="flex gap-2">
          {/* NF Import */}
          <Dialog open={nfDialogOpen} onOpenChange={o => { setNfDialogOpen(o); if (!o) { setParsedInvoice(null); setImportType('nf'); } }}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="w-4 h-4 mr-2" />Importar Documento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  {importType === 'cupom' ? 'Importar Cupom Fiscal' : importType === 'recibo' ? 'Importar Recibo' : 'Importar Nota Fiscal'}
                </DialogTitle>
                <DialogDescription>
                  Envie o documento (PDF, foto ou XML) para lançar entradas automaticamente via IA
                </DialogDescription>
              </DialogHeader>

              {!parsedInvoice && !parsing && (
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium text-foreground mb-1">Arraste ou clique para enviar</p>
                    <p className="text-sm text-muted-foreground">PDF, imagem (JPG/PNG/WEBP) ou XML da NF-e</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xml,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleNfFileChange}
                  />
                  {/* Camera input — opens camera directly on mobile */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleNfFileChange}
                  />
                  <div className="grid grid-cols-3 gap-3">
                    {/* Row 1: NF formats */}
                    <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => { setImportType('nf'); fileInputRef.current!.accept = '.pdf'; fileInputRef.current?.click(); }}>
                      <CardContent className="p-4 flex flex-col items-center gap-2">
                        <FileText className="w-6 h-6 text-primary" />
                        <span className="text-xs font-medium">PDF (DANFE)</span>
                        <span className="text-[10px] text-muted-foreground">Nota Fiscal</span>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => { setImportType('nf'); fileInputRef.current!.accept = '.jpg,.jpeg,.png,.webp'; fileInputRef.current?.click(); }}>
                      <CardContent className="p-4 flex flex-col items-center gap-2">
                        <Camera className="w-6 h-6 text-primary" />
                        <span className="text-xs font-medium">Foto da Galeria</span>
                        <span className="text-[10px] text-muted-foreground">Nota Fiscal</span>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => { setImportType('nf'); fileInputRef.current!.accept = '.xml'; fileInputRef.current?.click(); }}>
                      <CardContent className="p-4 flex flex-col items-center gap-2">
                        <FileCode className="w-6 h-6 text-primary" />
                        <span className="text-xs font-medium">XML (NF-e)</span>
                        <span className="text-[10px] text-muted-foreground">Nota Fiscal</span>
                      </CardContent>
                    </Card>
                    {/* Row 2: Camera + Cupom + Recibo */}
                    <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all border-primary/20 bg-primary/3" onClick={() => { setImportType('nf'); cameraInputRef.current?.click(); }}>
                      <CardContent className="p-4 flex flex-col items-center gap-2">
                        <Camera className="w-6 h-6 text-primary" />
                        <span className="text-xs font-medium">Tirar Foto</span>
                        <span className="text-[10px] text-muted-foreground">Câmera direta</span>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => { setImportType('cupom'); fileInputRef.current!.accept = '.jpg,.jpeg,.png,.webp,.pdf'; fileInputRef.current?.click(); }}>
                      <CardContent className="p-4 flex flex-col items-center gap-2">
                        <ShoppingCart className="w-6 h-6 text-amber-500" />
                        <span className="text-xs font-medium">Cupom Fiscal</span>
                        <span className="text-[10px] text-muted-foreground">Foto ou PDF</span>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => { setImportType('recibo'); fileInputRef.current!.accept = '.jpg,.jpeg,.png,.webp,.pdf'; fileInputRef.current?.click(); }}>
                      <CardContent className="p-4 flex flex-col items-center gap-2">
                        <Receipt className="w-6 h-6 text-amber-500" />
                        <span className="text-xs font-medium">Recibo</span>
                        <span className="text-[10px] text-muted-foreground">Foto ou PDF</span>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {parsing && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Processando nota fiscal...</p>
                  <p className="text-xs text-muted-foreground">A IA está lendo o documento</p>
                </div>
              )}

              {parsedInvoice && (
                <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                  {/* Invoice header */}
                  <div className="flex flex-wrap gap-3">
                    {parsedInvoice.supplier && <Badge variant="secondary">Fornecedor: {parsedInvoice.supplier}</Badge>}
                    {parsedInvoice.invoice_number && <Badge variant="outline">NF: {parsedInvoice.invoice_number}</Badge>}
                    <Badge className="bg-emerald-500/20 text-emerald-400">{matchedCount} vinculados</Badge>
                    {unmatchedCount > 0 && <Badge className="bg-amber-500/20 text-amber-400">{unmatchedCount} não encontrados</Badge>}
                  </div>

                  {/* Items table */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_80px_80px_60px_1fr_32px] gap-2 text-[10px] text-muted-foreground px-1 font-medium">
                      <span>Produto (NF)</span><span>Qtd</span><span>Custo Un.</span><span>Un.</span><span>Vincular ao estoque</span><span></span>
                    </div>
                    {parsedInvoice.items.map((pi, idx) => (
                      <div key={idx} className={cn(
                        "grid grid-cols-[1fr_80px_80px_60px_1fr_32px] gap-2 items-center p-2 rounded-lg",
                        pi.matched_item_id ? "bg-emerald-500/5" : "bg-amber-500/5"
                      )}>
                        <div className="min-w-0">
                          {pi.name ? (
                            <p className="text-xs font-medium text-foreground truncate">{pi.name}</p>
                          ) : (
                            <Input
                              className="h-6 text-xs"
                              placeholder="Nome do produto..."
                              value={pi.name}
                              onChange={e => updateParsedItem(idx, 'name', e.target.value)}
                            />
                          )}
                          {pi.matched_item_name && (
                            <p className="text-[10px] text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />{pi.matched_item_name}</p>
                          )}
                        </div>
                        <Input
                          type="number"
                          step="any"
                          className="h-7 text-xs"
                          value={pi.quantity}
                          onChange={e => updateParsedItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 text-xs"
                          value={pi.unit_cost}
                          onChange={e => updateParsedItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                        />
                        <span className="text-xs text-muted-foreground text-center">{pi.unit}</span>
                        <div className="flex gap-1 items-center">
                          <div className="flex-1">
                            <ItemSearchCombobox
                              items={items}
                              value={pi.matched_item_id}
                              onChange={v => updateParsedItem(idx, 'matched_item_id', v)}
                            />
                          </div>
                          {!pi.matched_item_id && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 shrink-0 border-primary/40 text-primary hover:bg-primary/10"
                              title={`Criar "${pi.name}" no estoque e vincular`}
                              disabled={pi.status === 'creating' || !pi.name.trim()}
                              onClick={() => createItemFromParsed(idx)}
                            >
                              {pi.status === 'creating' ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackagePlus className="w-3 h-3" />}
                            </Button>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeParsedItem(idx)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {unmatchedCount > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-600 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{unmatchedCount} item(ns) não vinculado(s). Clique em <PackagePlus className="w-3 h-3 inline mx-0.5" /> para criar no estoque e vincular, ou selecione um item existente no combobox.</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button onClick={confirmNfImport} className="flex-1" disabled={submittingNf || parsedInvoice.items.length === 0}>
                      {submittingNf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                      Confirmar {parsedInvoice.items.length} entrada(s)
                    </Button>
                    <Button variant="outline" onClick={() => setParsedInvoice(null)}>Reenviar NF</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Manual entry */}
          <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nova Entrada</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar Entrada</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Item</label>
                  <Select value={itemId} onValueChange={setItemId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
                    <SelectContent>
                      {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Quantidade</label>
                    <div className="relative">
                      <Input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" className={selectedItem ? 'pr-16' : ''} />
                      {selectedItem && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {selectedItem.unit}
                        </span>
                      )}
                    </div>
                    {selectedItem && <p className="text-xs text-muted-foreground mt-1">Estoque atual: {selectedItem.current_stock} {selectedItem.unit}</p>}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Custo Unit. (R$/{selectedItem?.unit || 'un'})</label>
                    <Input
                      type="number" step="0.01" value={unitCost}
                      onChange={e => setUnitCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {/* Total price helper */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <label className="text-sm font-medium text-amber-800 mb-1 block">
                    💡 Calcular pelo preço total da nota
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-0.5 block">Preço total pago (R$)</label>
                      <Input
                        type="number" step="0.01" placeholder="Ex: 50,00"
                        className="h-8 text-sm bg-white"
                        onChange={e => {
                          const total = parseFloat(e.target.value);
                          const qty = parseFloat(quantity);
                          if (total > 0 && qty > 0) {
                            setUnitCost((total / qty).toFixed(4));
                          }
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-4">÷ qtde = custo/un</div>
                  </div>
                  {unitCost && quantity && (
                    <p className="text-xs text-amber-700 mt-1">
                      = R$ {parseFloat(unitCost).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} por {selectedItem?.unit || 'un'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Fornecedor (opcional)</label>
                  <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nome do fornecedor" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Nota Fiscal (opcional)</label>
                  <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Nº da NF" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Observações (opcional)</label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações" />
                </div>
                <Button onClick={handleSave} className="w-full">Registrar Entrada</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-48" />
        <Input
          type="text"
          placeholder="Buscar por item ou fornecedor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64"
        />
        {filterDate && <Button variant="ghost" size="sm" onClick={() => setFilterDate('')}>Limpar</Button>}
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filtered.length === 0}>
          <Download className="w-4 h-4 mr-2" />Exportar CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma entrada registrada.</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead>Un.</TableHead>
                <TableHead>Custo Unit.</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>NF</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(entry => {
                const item = items.find(i => i.id === entry.item_id);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item?.name || (
                        <button
                          onClick={() => { setFixEntry(entry); setFixName(''); setFixUnit('un'); setFixCategory('Outros'); }}
                          className="text-amber-500 italic text-xs underline underline-offset-2 hover:text-amber-400 transition-colors"
                        >
                          ⚠ Corrigir item
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-emerald-400 font-semibold">+{entry.quantity}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-medium">{item?.unit || ''}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.unit_cost != null ? `R$ ${entry.unit_cost}` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.supplier || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.invoice_number || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{entry.notes || '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
              <span>Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} entradas</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Anterior</Button>
                <span>Página {page + 1} de {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima →</Button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ── Fix orphan entry dialog ── */}
      <Dialog open={!!fixEntry} onOpenChange={o => { if (!o) setFixEntry(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Corrigir entrada</DialogTitle>
            <DialogDescription>
              Informe o insumo desta entrada para religar ao estoque.
              {fixEntry && <span className="block mt-1 text-xs">Qtd: <strong>+{fixEntry.quantity}</strong> · Custo: <strong>R$ {fixEntry.unit_cost ?? '—'}</strong> · NF: <strong>{fixEntry.invoice_number || '—'}</strong></span>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nome do insumo</label>
              <ItemSearchCombobox
                items={items}
                value={null}
                onChange={id => {
                  const found = items.find(i => i.id === id);
                  if (found) { setFixName(found.name); setFixUnit(found.unit); }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">Ou digite abaixo para criar novo:</p>
              <Input
                className="mt-1"
                placeholder="Nome do produto (ex: Torrada Rústica 150g)"
                value={fixName}
                onChange={e => setFixName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Unidade</label>
                <Select value={fixUnit} onValueChange={setFixUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'lata', 'bd', 'fatias'].map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Categoria</label>
                <Input placeholder="Outros" value={fixCategory} onChange={e => setFixCategory(e.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={handleFixConfirm} disabled={fixLoading || !fixName.trim()}>
              {fixLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Criar e religar insumo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
