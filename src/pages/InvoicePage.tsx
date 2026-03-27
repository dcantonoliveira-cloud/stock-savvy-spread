// ============================================================
//  InvoicePage.tsx
//  Salve em: src/pages/InvoicePage.tsx
//  (Adicione a rota no App.tsx para supervisor e funcionário)
// ============================================================

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Upload, FileText, CheckCircle, AlertTriangle, Plus,
  Package, ArrowRight, RefreshCw, ChevronDown, ChevronUp, X
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────
type StockItem = { id: string; name: string; unit: string; unit_cost: number; category: string; current_stock: number };

type ParsedNFItem = {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  matchedItem: StockItem | null;
  status: 'matched' | 'new_item' | 'unmatched';
  // editable fields
  selectedItemId: string | null;
  newItemName: string;
  newItemCategory: string;
  newItemUnit: string;
  skip: boolean;
};

type ParsedNF = {
  number: string;
  series: string;
  supplierName: string;
  supplierCnpj: string;
  issueDate: string;
  totalValue: number;
  items: ParsedNFItem[];
  fileType: 'xml' | 'pdf';
  rawFile: File;
};

const CATEGORIES = ['Carnes', 'Bebidas', 'Frios', 'Hortifruti', 'Secos', 'Descartáveis', 'Limpeza', 'Outros'];

// ── XML Parser ────────────────────────────────────────────────
function parseNFeXML(xmlContent: string): Omit<ParsedNF, 'rawFile' | 'fileType'> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  const getText = (selector: string): string => {
    const el = doc.querySelector(selector);
    return el?.textContent?.trim() || '';
  };

  const number = getText('nNF') || getText('ide nNF');
  const series = getText('serie') || getText('ide serie');
  const supplierName = getText('emit xNome') || getText('xNome');
  const supplierCnpj = getText('emit CNPJ') || getText('CNPJ');
  const issueDate = getText('dhEmi') || getText('dEmi');
  const totalValue = parseFloat(getText('vNF') || getText('ICMSTot vNF') || '0');

  const detElements = doc.querySelectorAll('det');
  const items: Omit<ParsedNFItem, 'matchedItem' | 'selectedItemId' | 'skip'>[] = [];

  detElements.forEach(det => {
    const description = det.querySelector('xProd')?.textContent?.trim() || '';
    const unit = det.querySelector('uCom')?.textContent?.trim() || det.querySelector('uTrib')?.textContent?.trim() || 'un';
    const quantity = parseFloat(det.querySelector('qCom')?.textContent || det.querySelector('qTrib')?.textContent || '0');
    const unitPrice = parseFloat(det.querySelector('vUnCom')?.textContent || det.querySelector('vUnTrib')?.textContent || '0');

    if (description && quantity > 0) {
      items.push({
        description,
        unit: normalizeUnit(unit),
        quantity,
        unitPrice,
        status: 'unmatched',
        newItemName: description,
        newItemCategory: 'Outros',
        newItemUnit: normalizeUnit(unit),
      });
    }
  });

  return {
    number,
    series,
    supplierName,
    supplierCnpj,
    issueDate: issueDate ? issueDate.split('T')[0] : new Date().toISOString().split('T')[0],
    totalValue,
    items: items as ParsedNFItem[],
  };
}

function normalizeUnit(unit: string): string {
  const u = unit.toUpperCase().trim();
  if (['KG', 'KGS', 'KILO', 'QUILOGRAMA'].includes(u)) return 'kg';
  if (['G', 'GR', 'GRS', 'GRAMA'].includes(u)) return 'g';
  if (['L', 'LT', 'LTS', 'LITRO', 'LITROS'].includes(u)) return 'L';
  if (['ML', 'MILILITRO'].includes(u)) return 'ml';
  if (['UN', 'UND', 'UNID', 'UNIDADE', 'PC', 'PCS', 'PEÇA'].includes(u)) return 'un';
  if (['CX', 'CAIXA'].includes(u)) return 'cx';
  if (['PCT', 'PACOTE'].includes(u)) return 'pct';
  return unit.toLowerCase();
}

// ── Fuzzy match helper ────────────────────────────────────────
function findBestMatch(description: string, stockItems: StockItem[]): StockItem | null {
  const normalize = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim();

  const desc = normalize(description);
  const words = desc.split(/\s+/).filter(w => w.length > 2);

  let best: StockItem | null = null;
  let bestScore = 0;

  stockItems.forEach(item => {
    const itemName = normalize(item.name);
    let score = 0;
    if (itemName === desc) { score = 100; }
    else if (itemName.includes(desc) || desc.includes(itemName)) { score = 80; }
    else {
      const matchedWords = words.filter(w => itemName.includes(w));
      score = (matchedWords.length / Math.max(words.length, 1)) * 60;
    }
    if (score > bestScore && score >= 40) {
      bestScore = score;
      best = item;
    }
  });

  return best;
}

// ── Main Component ────────────────────────────────────────────
export default function InvoicePage() {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [parsedNF, setParsedNF] = useState<ParsedNF | null>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load stock items
  const loadStockItems = async () => {
    const { data } = await supabase.from('stock_items').select('id, name, unit, unit_cost, category, current_stock').order('name').range(0, 9999);
    return (data || []) as StockItem[];
  };

  // Process file
  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const items = await loadStockItems();
      setStockItems(items);

      let parsed: Omit<ParsedNF, 'rawFile' | 'fileType'>;
      let fileType: 'xml' | 'pdf' = 'xml';

      if (file.name.endsWith('.xml') || file.type.includes('xml')) {
        const text = await file.text();
        parsed = parseNFeXML(text);
        fileType = 'xml';
      } else if (file.type.includes('pdf')) {
        fileType = 'pdf';
        // For PDF, use AI to extract
        const base64 = await new Promise<string>(res => {
          const reader = new FileReader();
          reader.onload = () => res((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{
              role: 'user',
              content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                { type: 'text', text: `Extraia os dados desta Nota Fiscal e retorne SOMENTE um JSON válido, sem texto adicional, sem blocos de código, no formato:
{
  "number": "número da NF",
  "series": "série",
  "supplierName": "nome do fornecedor",
  "supplierCnpj": "CNPJ",
  "issueDate": "YYYY-MM-DD",
  "totalValue": 0.00,
  "items": [
    {
      "description": "descrição do produto",
      "unit": "unidade (kg, L, un, etc)",
      "quantity": 0.00,
      "unitPrice": 0.00
    }
  ]
}` }
              ]
            }]
          })
        });

        const aiData = await response.json();
        const rawText = aiData.content?.[0]?.text || '{}';
        const clean = rawText.replace(/```json|```/g, '').trim();
        const aiParsed = JSON.parse(clean);

        parsed = {
          number: aiParsed.number || '',
          series: aiParsed.series || '',
          supplierName: aiParsed.supplierName || '',
          supplierCnpj: aiParsed.supplierCnpj || '',
          issueDate: aiParsed.issueDate || new Date().toISOString().split('T')[0],
          totalValue: aiParsed.totalValue || 0,
          items: (aiParsed.items || []).map((i: any) => ({
            description: i.description || '',
            unit: normalizeUnit(i.unit || 'un'),
            quantity: i.quantity || 0,
            unitPrice: i.unitPrice || 0,
            status: 'unmatched' as const,
            newItemName: i.description || '',
            newItemCategory: 'Outros',
            newItemUnit: normalizeUnit(i.unit || 'un'),
          })),
        };
      } else {
        toast.error('Formato não suportado. Use XML ou PDF.');
        setLoading(false);
        return;
      }

      // Auto-match items
      const matchedItems: ParsedNFItem[] = parsed.items.map(item => {
        const match = findBestMatch(item.description, items);
        return {
          ...item,
          matchedItem: match,
          selectedItemId: match?.id || null,
          skip: false,
          status: match ? 'matched' : 'new_item',
          newItemName: item.description,
          newItemCategory: 'Outros',
          newItemUnit: item.unit,
        };
      });

      setParsedNF({ ...parsed, items: matchedItems, fileType, rawFile: file });
      setStep('review');
    } catch (err: any) {
      toast.error('Erro ao processar arquivo: ' + (err.message || err));
    }
    setLoading(false);
  }, []);

  // Handle drag & drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  // Update item field
  const updateItem = (index: number, updates: Partial<ParsedNFItem>) => {
    setParsedNF(prev => {
      if (!prev) return prev;
      const items = [...prev.items];
      items[index] = { ...items[index], ...updates };
      if (updates.selectedItemId) {
        const found = stockItems.find(s => s.id === updates.selectedItemId);
        items[index].matchedItem = found || null;
        items[index].status = found ? 'matched' : 'new_item';
      }
      return { ...prev, items };
    });
  };

  // Toggle item expanded
  const toggleExpanded = (i: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  // Confirm and process NF
  const confirmNF = async () => {
    if (!parsedNF || !user) return;
    setSubmitting(true);

    try {
      // 1. Upload file to storage
      const filePath = `${user.id}/${Date.now()}_${parsedNF.rawFile.name}`;
      const { data: uploadData } = await supabase.storage.from('invoices').upload(filePath, parsedNF.rawFile);
      const fileUrl = uploadData?.path || filePath;

      // 2. Create invoice record
      const { data: invoice, error: invErr } = await supabase.from('invoices').insert({
        number: parsedNF.number,
        series: parsedNF.series,
        supplier_name: parsedNF.supplierName,
        supplier_cnpj: parsedNF.supplierCnpj,
        issue_date: parsedNF.issueDate || null,
        total_value: parsedNF.totalValue,
        file_url: fileUrl,
        file_type: parsedNF.fileType,
        status: 'confirmed',
        registered_by: user.id,
      } as any).select('id').single();

      if (invErr || !invoice) throw new Error('Erro ao salvar NF: ' + invErr?.message);

      const newItemsCreated: string[] = [];

      for (const item of parsedNF.items) {
        if (item.skip) continue;

        let stockItemId = item.selectedItemId;

        // Create new stock item if needed
        if (!stockItemId || item.status === 'new_item') {
          const { data: newItem, error: newErr } = await supabase.from('stock_items').insert({
            name: item.newItemName || item.description,
            category: item.newItemCategory || 'Outros',
            unit: item.newItemUnit || item.unit,
            current_stock: 0,
            min_stock: 0,
            unit_cost: item.unitPrice,
          } as any).select('id').single();

          if (newErr || !newItem) continue;
          stockItemId = newItem.id;
          newItemsCreated.push(item.newItemName || item.description);
        } else {
          // Update price if different
          const existing = stockItems.find(s => s.id === stockItemId);
          if (existing && Math.abs(existing.unit_cost - item.unitPrice) > 0.01 && item.unitPrice > 0) {
            await supabase.from('stock_items').update({ unit_cost: item.unitPrice } as any).eq('id', stockItemId);
          }
        }

        // Register stock entry
        await supabase.from('stock_entries').insert({
          item_id: stockItemId,
          quantity: item.quantity,
          notes: `NF ${parsedNF.number} — ${parsedNF.supplierName}`,
          registered_by: user.id,
          invoice_number: parsedNF.number,
        } as any);

        // Save invoice item
        const existingItem = stockItems.find(s => s.id === item.selectedItemId);
        await supabase.from('invoice_items').insert({
          invoice_id: invoice.id,
          stock_item_id: stockItemId,
          nf_description: item.description,
          nf_unit: item.unit,
          nf_quantity: item.quantity,
          nf_unit_price: item.unitPrice,
          previous_unit_cost: existingItem?.unit_cost || null,
          status: item.status,
        } as any);
      }

      // Notify supervisor about new items
      if (newItemsCreated.length > 0) {
        await supabase.from('app_notifications').insert({
          type: 'new_item_from_nf',
          title: `${newItemsCreated.length} novo(s) item(s) criado(s) via NF`,
          message: `NF ${parsedNF.number} de ${parsedNF.supplierName} criou: ${newItemsCreated.join(', ')}`,
          data: { invoice_id: invoice.id, items: newItemsCreated },
        } as any);
      }

      toast.success(`✅ NF processada! ${parsedNF.items.filter(i => !i.skip).length} itens registrados.`);
      setStep('done');
    } catch (err: any) {
      toast.error('Erro ao confirmar NF: ' + (err.message || err));
    }
    setSubmitting(false);
  };

  const itemsMatched = parsedNF?.items.filter(i => i.status === 'matched' && !i.skip).length || 0;
  const itemsNew = parsedNF?.items.filter(i => i.status === 'new_item' && !i.skip).length || 0;
  const itemsSkipped = parsedNF?.items.filter(i => i.skip).length || 0;

  // ── STEP: Upload ──────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold gold-text">Receber Nota Fiscal</h1>
          <p className="text-muted-foreground mt-1 text-sm">Faça upload do XML ou PDF da NF para dar entrada automática no estoque</p>
        </div>

        {/* Drop zone */}
        <div
          className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer p-12 text-center
            ${dragging ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,.pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Processando arquivo...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Arraste aqui ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground mt-1">Suporta XML (NF-e) e PDF/DANFE</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">XML NF-e</Badge>
                <Badge variant="outline" className="text-xs">PDF / DANFE</Badge>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 rounded-xl bg-muted/40 border border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Como funciona:</span> O sistema lê automaticamente os itens da NF,
            tenta vincular com os produtos do estoque e dá entrada nas quantidades.
            Itens novos são criados automaticamente e o supervisor é notificado.
          </p>
        </div>
      </div>
    );
  }

  // ── STEP: Done ────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">NF Processada!</h2>
        <p className="text-muted-foreground mb-8">O estoque foi atualizado com os itens da nota fiscal.</p>
        <Button className="rounded-xl" onClick={() => { setParsedNF(null); setStep('upload'); }}>
          Processar outra NF
        </Button>
      </div>
    );
  }

  // ── STEP: Review ──────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revisar Nota Fiscal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {parsedNF?.supplierName || 'Fornecedor'} · NF {parsedNF?.number || '—'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setParsedNF(null); setStep('upload'); }}>
          <X className="w-4 h-4 mr-1" /> Cancelar
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-success/10 border border-success/20 p-3 text-center">
          <p className="text-2xl font-bold text-success">{itemsMatched}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Vinculados</p>
        </div>
        <div className="rounded-xl bg-warning/10 border border-warning/20 p-3 text-center">
          <p className="text-2xl font-bold text-warning">{itemsNew}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Itens novos</p>
        </div>
        <div className="rounded-xl bg-muted/50 border border-border p-3 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{itemsSkipped}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Ignorados</p>
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-2 mb-6">
        {parsedNF?.items.map((item, i) => (
          <div
            key={i}
            className={`rounded-xl border transition-all ${item.skip ? 'opacity-40 border-border bg-muted/20' : item.status === 'matched' ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}`}
          >
            {/* Row summary */}
            <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => toggleExpanded(i)}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${item.skip ? 'bg-muted-foreground' : item.status === 'matched' ? 'bg-success' : 'bg-warning'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} {item.unit} · R$ {item.unitPrice.toFixed(2)}/un
                  {item.matchedItem && !item.skip && (
                    <span className="ml-1 text-success">→ {item.matchedItem.name}</span>
                  )}
                  {item.status === 'new_item' && !item.skip && (
                    <span className="ml-1 text-warning">· Novo item</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={e => { e.stopPropagation(); updateItem(i, { skip: !item.skip }); }}
                >
                  {item.skip ? 'Incluir' : 'Ignorar'}
                </Button>
                {expandedItems.has(i) ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>

            {/* Expanded detail */}
            {expandedItems.has(i) && !item.skip && (
              <div className="px-3 pb-3 border-t border-border/50 pt-3 space-y-3">
                {/* Link to existing item */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Vincular ao item do estoque</label>
                  <Select
                    value={item.selectedItemId || 'new'}
                    onValueChange={v => updateItem(i, {
                      selectedItemId: v === 'new' ? null : v,
                      status: v === 'new' ? 'new_item' : 'matched',
                      matchedItem: v === 'new' ? null : (stockItems.find(s => s.id === v) || null),
                    })}
                  >
                    <SelectTrigger className="h-9 text-sm rounded-lg">
                      <SelectValue placeholder="Selecionar produto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">
                        <span className="flex items-center gap-2 text-warning"><Plus className="w-3 h-3" /> Criar novo item</span>
                      </SelectItem>
                      {stockItems.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* New item fields */}
                {item.status === 'new_item' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Nome no estoque</label>
                      <Input
                        className="h-9 text-sm rounded-lg"
                        value={item.newItemName}
                        onChange={e => updateItem(i, { newItemName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
                      <Select value={item.newItemCategory} onValueChange={v => updateItem(i, { newItemCategory: v })}>
                        <SelectTrigger className="h-9 text-sm rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Price comparison */}
                {item.status === 'matched' && item.matchedItem && item.unitPrice > 0 && (
                  <div className={`text-xs rounded-lg p-2 ${Math.abs(item.matchedItem.unit_cost - item.unitPrice) > 0.01 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                    {Math.abs(item.matchedItem.unit_cost - item.unitPrice) > 0.01 ? (
                      <>⚠️ Preço mudou: R$ {item.matchedItem.unit_cost.toFixed(2)} → R$ {item.unitPrice.toFixed(2)} (será atualizado)</>
                    ) : (
                      <>✓ Preço igual ao cadastrado: R$ {item.unitPrice.toFixed(2)}</>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirm button */}
      <Button
        className="w-full h-14 text-base rounded-xl font-semibold"
        onClick={confirmNF}
        disabled={submitting || (parsedNF?.items.every(i => i.skip) ?? true)}
      >
        {submitting ? (
          <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Processando...</>
        ) : (
          <><CheckCircle className="w-5 h-5 mr-2" /> Confirmar entrada de {parsedNF?.items.filter(i => !i.skip).length} itens</>
        )}
      </Button>
    </div>
  );
}
