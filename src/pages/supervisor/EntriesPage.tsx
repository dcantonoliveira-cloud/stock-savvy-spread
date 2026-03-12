import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Upload, FileText, Camera, FileCode, Loader2, Check, X, AlertTriangle, PackagePlus } from 'lucide-react';
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

export default function EntriesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterDate, setFilterDate] = useState('');

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [itemsRes, entriesRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, unit, current_stock, barcode').order('name'),
      supabase.from('stock_entries').select('*').order('created_at', { ascending: false }),
    ]);
    if (itemsRes.data) setItems(itemsRes.data as Item[]);
    if (entriesRes.data) setEntries(entriesRes.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = filterDate ? entries.filter(e => e.date === filterDate) : entries;

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

  const selectedItem = items.find(i => i.id === itemId);

  // ─── NF Import Logic ───

  const matchItems = (parsedItems: any[]): ParsedItem[] => {
    return parsedItems.map(pi => {
      // Try barcode match first
      let match = pi.barcode ? items.find(i => i.barcode === pi.barcode) : null;

      // Then name similarity
      if (!match) {
        const piName = pi.name.toLowerCase().trim();
        match = items.find(i => {
          const iName = i.name.toLowerCase().trim();
          return iName === piName || piName.includes(iName) || iName.includes(piName);
        });
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
        const text = await file.text();
        const { data, error } = await supabase.functions.invoke('parse-invoice', {
          body: { xml: text },
        });
        if (error) throw new Error(error.message || 'Erro ao processar XML');
        const matched = matchItems(data.items || []);
        setParsedInvoice({ supplier: data.supplier || '', invoice_number: data.invoice_number || '', items: matched });
      } else {
        // PDF or image — convert to base64
        const buffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const mimeType = file.type || 'application/pdf';

        const { data, error } = await supabase.functions.invoke('parse-invoice', {
          body: { base64, mimeType },
        });
        if (error) throw new Error(error.message || 'Erro ao processar NF');
        const matched = matchItems(data.items || []);
        setParsedInvoice({ supplier: data.supplier || '', invoice_number: data.invoice_number || '', items: matched });
      }

      toast.success('NF processada! Revise os itens abaixo.');
    } catch (e: any) {
      console.error('NF parse error:', e);
      toast.error(e.message || 'Erro ao processar a nota fiscal');
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
      const match = items.find(i => i.id === value);
      updated[idx] = { ...updated[idx], matched_item_id: value, matched_item_name: match?.name || null, status: 'matched' };
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
    updateParsedItem(idx, 'status', 'creating');

    const { data, error } = await supabase.from('stock_items').insert({
      name: pi.name,
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
    const validItems = parsedInvoice.items.filter(i => i.matched_item_id);
    if (validItems.length === 0) { toast.error('Nenhum item vinculado ao estoque'); return; }

    setSubmittingNf(true);
    try {
      const inserts = validItems.map(i => ({
        item_id: i.matched_item_id!,
        quantity: i.quantity,
        unit_cost: i.unit_cost || null,
        supplier: parsedInvoice.supplier || null,
        invoice_number: parsedInvoice.invoice_number || null,
        notes: `Importado via NF`,
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

      toast.success(`${validItems.length} entrada(s) registrada(s) via NF!`);
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
          <Dialog open={nfDialogOpen} onOpenChange={o => { setNfDialogOpen(o); if (!o) setParsedInvoice(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="w-4 h-4 mr-2" />Importar NF</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Importar Nota Fiscal</DialogTitle>
                <DialogDescription>Envie a NF (PDF, foto ou XML) para lançar entradas automaticamente</DialogDescription>
              </DialogHeader>

              {!parsedInvoice && !parsing && (
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium text-foreground mb-1">Arraste ou clique para enviar</p>
                    <p className="text-sm text-muted-foreground">PDF, imagem (JPG/PNG) ou XML da NF-e</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xml,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleNfFileChange}
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => { fileInputRef.current!.accept = '.pdf'; fileInputRef.current?.click(); }}>
                      <CardContent className="p-4 flex flex-col items-center gap-2">
                        <FileText className="w-6 h-6 text-primary" />
                        <span className="text-xs font-medium">PDF (DANFE)</span>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => { fileInputRef.current!.accept = '.jpg,.jpeg,.png,.webp'; fileInputRef.current?.click(); }}>
                      <CardContent className="p-4 flex flex-col items-center gap-2">
                        <Camera className="w-6 h-6 text-primary" />
                        <span className="text-xs font-medium">Foto da NF</span>
                      </CardContent>
                    </Card>
                    <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => { fileInputRef.current!.accept = '.xml'; fileInputRef.current?.click(); }}>
                      <CardContent className="p-4 flex flex-col items-center gap-2">
                        <FileCode className="w-6 h-6 text-primary" />
                        <span className="text-xs font-medium">XML (NF-e)</span>
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
                    <div className="grid grid-cols-[1fr_80px_80px_60px_140px_32px] gap-2 text-[10px] text-muted-foreground px-1 font-medium">
                      <span>Produto (NF)</span><span>Qtd</span><span>Custo Un.</span><span>Un.</span><span>Estoque</span><span></span>
                    </div>
                    {parsedInvoice.items.map((pi, idx) => (
                      <div key={idx} className={cn(
                        "grid grid-cols-[1fr_80px_80px_60px_140px_32px] gap-2 items-center p-2 rounded-lg",
                        pi.matched_item_id ? "bg-emerald-500/5" : "bg-amber-500/5"
                      )}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{pi.name}</p>
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
                        <div>
                          {pi.matched_item_id ? (
                            <Select value={pi.matched_item_id} onValueChange={v => updateParsedItem(idx, 'matched_item_id', v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex gap-1">
                              <Select onValueChange={v => updateParsedItem(idx, 'matched_item_id', v)}>
                                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Vincular..." /></SelectTrigger>
                                <SelectContent>
                                  {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                title="Criar insumo"
                                disabled={pi.status === 'creating'}
                                onClick={() => createItemFromParsed(idx)}
                              >
                                {pi.status === 'creating' ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackagePlus className="w-3 h-3" />}
                              </Button>
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeParsedItem(idx)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {unmatchedCount > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-400 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{unmatchedCount} item(ns) não encontrado(s) no estoque. Vincule manualmente ou crie novos insumos.</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button onClick={confirmNfImport} className="flex-1" disabled={submittingNf || matchedCount === 0}>
                      {submittingNf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                      Confirmar {matchedCount} entrada(s)
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
                    <label className="text-sm text-muted-foreground mb-1 block">Quantidade {selectedItem ? `(${selectedItem.unit})` : ''}</label>
                    <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Custo Unit. (R$)</label>
                    <Input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="0.00" />
                  </div>
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

      <div className="mb-6 flex items-center gap-2">
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-48" />
        {filterDate && <Button variant="ghost" size="sm" onClick={() => setFilterDate('')}>Limpar</Button>}
      </div>

      <div className="space-y-3">
        {filtered.map(entry => {
          const item = items.find(i => i.id === entry.item_id);
          return (
            <div key={entry.id} className="glass-card rounded-xl p-4 flex items-center justify-between animate-fade-in">
              <div>
                <p className="font-medium text-foreground">{item?.name || '?'}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(entry.date).toLocaleDateString('pt-BR')}
                  {entry.supplier && ` · ${entry.supplier}`}
                  {entry.invoice_number && ` · NF: ${entry.invoice_number}`}
                </p>
                {entry.notes && <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-lg font-semibold text-success">+{entry.quantity}</p>
                  {entry.unit_cost && <p className="text-xs text-muted-foreground">R$ {entry.unit_cost}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">Nenhuma entrada registrada.</div>
        )}
      </div>
    </div>
  );
}
