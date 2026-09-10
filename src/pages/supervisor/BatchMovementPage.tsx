import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, Search, Trash2, Loader2, CheckCircle2, X, Download, Upload, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { fmtNum } from '@/lib/format';

type Item = { id: string; name: string; category: string; unit: string; current_stock: number; subcategory_id: string | null };
type LineType = 'entrada' | 'saida';
type BatchLine = { item: Item; qty: string; type: LineType };
type UnmatchedRow = { name: string; entrada: number; saida: number };

const lineKey = (itemId: string, type: LineType) => `${itemId}::${type}`;

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default function BatchMovementPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [aliases, setAliases] = useState<{ item_id: string; alias: string }[]>([]);
  const [mode, setMode] = useState<LineType>('entrada');
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [batch, setBatch] = useState<BatchLine[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unmatched, setUnmatched] = useState<UnmatchedRow[]>([]);
  const [subcategories, setSubcategories] = useState<{ id: string; name: string }[]>([]);
  const [tagsByItem, setTagsByItem] = useState<Record<string, string[]>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = () =>
    Promise.all([
      supabase.from('stock_items').select('id, name, category, unit, current_stock, subcategory_id')
        .neq('category', '_sistema_').order('name').range(0, 9999),
      (supabase.from('stock_item_aliases') as any).select('item_id, alias'),
      supabase.from('subcategories').select('id, name'),
      (supabase.from('stock_item_tags') as any).select('item_id, tags:tag_id(name)'),
    ]).then(([itemsRes, aliasesRes, subcatsRes, tagsRes]) => {
      if (itemsRes.data) setItems(itemsRes.data as Item[]);
      if (aliasesRes.data) setAliases(aliasesRes.data as { item_id: string; alias: string }[]);
      if (subcatsRes.data) setSubcategories(subcatsRes.data as { id: string; name: string }[]);
      const tMap: Record<string, string[]> = {};
      for (const l of (tagsRes.data ?? []) as any[]) {
        if (!l.tags?.name) continue;
        (tMap[l.item_id] ??= []).push(l.tags.name);
      }
      setTagsByItem(tMap);
    });

  useEffect(() => { loadItems(); }, []);

  const filtered = search.trim().length < 1 ? [] : items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) &&
    !batch.some(b => b.item.id === i.id && b.type === mode)
  ).slice(0, 12);

  const addItem = (item: Item) => {
    setBatch(prev => [...prev, { item, qty: '', type: mode }]);
    setSearch('');
    setShowDropdown(false);
    searchRef.current?.focus();
  };

  const removeItem = (itemId: string, type: LineType) =>
    setBatch(prev => prev.filter(b => lineKey(b.item.id, b.type) !== lineKey(itemId, type)));

  const updateQty = (itemId: string, type: LineType, val: string) => {
    setBatch(prev => prev.map(b => lineKey(b.item.id, b.type) === lineKey(itemId, type) ? { ...b, qty: val } : b));
  };

  const toggleType = (itemId: string, type: LineType) => {
    const newType: LineType = type === 'entrada' ? 'saida' : 'entrada';
    setBatch(prev => {
      // Evita duas linhas do mesmo item + tipo depois de trocar
      if (prev.some(b => b.item.id === itemId && b.type === newType)) {
        toast.error('Esse item já tem uma linha desse tipo.');
        return prev;
      }
      return prev.map(b => (b.item.id === itemId && b.type === type) ? { ...b, type: newType } : b);
    });
  };

  const validLines = batch.filter(b => parseFloat(b.qty) > 0);

  // ── Planilha: baixar modelo com nomes já preenchidos ──
  const handleDownloadTemplate = () => {
    const subcatName = (id: string | null) => subcategories.find(s => s.id === id)?.name ?? '';
    const rows = [...items].sort((a, b) => a.name.localeCompare(b.name)).map(i => ({
      'Nome': i.name,
      'Categoria': i.category,
      'Subcategoria': subcatName(i.subcategory_id),
      'Tags': (tagsByItem[i.id] ?? []).join(', '),
      'Unidade': i.unit,
      'Estoque Atual': i.current_stock,
      'Entrada': '',
      'Saída': '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lançamento em Lote');
    XLSX.writeFile(wb, `lote_estoque_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Planilha: casa nome exato (ou apelido já conhecido) — nunca "chuta" por similaridade ──
  const matchItemByName = (raw: string): Item | null => {
    const norm = normalize(raw);
    if (!norm) return null;
    const exact = items.find(i => normalize(i.name) === norm);
    if (exact) return exact;
    const aliasHit = aliases.find(a => normalize(a.alias) === norm);
    return aliasHit ? items.find(i => i.id === aliasHit.item_id) ?? null : null;
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      const newLines: BatchLine[] = [];
      const notFound: UnmatchedRow[] = [];

      for (const row of rows) {
        const rawName = (row['Nome'] ?? row['NOME'] ?? row['nome'] ?? row['Item'] ?? row['ITEM'])?.toString().trim();
        if (!rawName) continue;
        const entradaVal = parseFloat(row['Entrada'] ?? row['ENTRADA'] ?? row['entrada']) || 0;
        const saidaVal = parseFloat(row['Saída'] ?? row['SAÍDA'] ?? row['Saida'] ?? row['SAIDA'] ?? row['saída'] ?? row['saida']) || 0;
        if (entradaVal <= 0 && saidaVal <= 0) continue;

        const match = matchItemByName(rawName);
        if (!match) { notFound.push({ name: rawName, entrada: entradaVal, saida: saidaVal }); continue; }
        if (entradaVal > 0) newLines.push({ item: match, qty: String(entradaVal), type: 'entrada' });
        if (saidaVal > 0) newLines.push({ item: match, qty: String(saidaVal), type: 'saida' });
      }

      setBatch(prev => {
        const merged = [...prev];
        for (const line of newLines) {
          const idx = merged.findIndex(b => b.item.id === line.item.id && b.type === line.type);
          if (idx >= 0) merged[idx] = line; else merged.push(line);
        }
        return merged;
      });
      setUnmatched(notFound);

      if (newLines.length > 0) toast.success(`${newLines.length} lançamento(s) importado(s) da planilha.`);
      if (notFound.length > 0) toast.error(`${notFound.length} linha(s) da planilha não reconhecida(s) — confira abaixo.`);
      if (newLines.length === 0 && notFound.length === 0) toast('Nenhuma linha com quantidade preenchida foi encontrada na planilha.');
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirm = async () => {
    if (!validLines.length) { toast.error('Adicione pelo menos um item com quantidade'); return; }
    if (!user) return;
    setSaving(true);

    const now = new Date().toISOString();
    let hasError = false;

    for (const line of validLines) {
      const qty = parseFloat(line.qty);
      // Não seta stock_items.current_stock diretamente: o trigger do banco (on_stock_entry/on_stock_output)
      // já ajusta o valor sozinho a partir da quantidade inserida. Setar os dois duplicaria o ajuste.
      if (line.type === 'entrada') {
        const { error } = await (supabase.from('stock_entries') as any).insert({
          item_id: line.item.id, quantity: qty,
          notes: notes.trim() || null,
          registered_by: user.id,
        });
        if (error) { console.error(error); hasError = true; continue; }
      } else {
        const { error } = await (supabase.from('stock_outputs') as any).insert({
          item_id: line.item.id, quantity: qty,
          notes: notes.trim() || null,
          employee_name: user.email || 'Supervisor',
          date: now.split('T')[0],
          registered_by: user.id,
        });
        if (error) { console.error(error); hasError = true; continue; }
      }
    }

    setSaving(false);
    if (hasError) {
      toast.error('Alguns itens tiveram erro. Verifique o console.');
    } else {
      const entradaCount = validLines.filter(l => l.type === 'entrada').length;
      const saidaCount = validLines.filter(l => l.type === 'saida').length;
      const parts = [
        entradaCount > 0 ? `${entradaCount} entrada${entradaCount !== 1 ? 's' : ''}` : null,
        saidaCount > 0 ? `${saidaCount} saída${saidaCount !== 1 ? 's' : ''}` : null,
      ].filter(Boolean);
      toast.success(`${parts.join(' · ')} registrada(s)!`);
      setSaved(true);
      setUnmatched([]);
      await loadItems();
      setBatch([]);
      setNotes('');
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const total = validLines.reduce((s, l) => s + parseFloat(l.qty), 0);
  const entradaLines = validLines.filter(l => l.type === 'entrada');
  const saidaLines = validLines.filter(l => l.type === 'saida');
  const isMixed = entradaLines.length > 0 && saidaLines.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Lançamento em Lote</h1>
          <p className="text-muted-foreground mt-1 text-sm">Registre entradas ou saídas de vários itens de uma vez.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-2" />Baixar planilha
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />Subir planilha
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      {/* Não reconhecidos na importação */}
      {unmatched.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-medium mb-2">
            <AlertTriangle className="w-4 h-4" />
            {unmatched.length} linha{unmatched.length !== 1 ? 's' : ''} da planilha não reconhecida{unmatched.length !== 1 ? 's' : ''}
          </div>
          <p className="text-xs text-amber-700 mb-2">
            O nome não bateu com nenhum insumo cadastrado. Corrija o nome na planilha e suba de novo, ou adicione manualmente pela busca abaixo.
          </p>
          <ul className="space-y-0.5 text-xs">
            {unmatched.map((u, idx) => (
              <li key={idx}>
                <span className="font-medium">"{u.name}"</span>
                {u.entrada > 0 && <span className="ml-1">· entrada {fmtNum(u.entrada)}</span>}
                {u.saida > 0 && <span className="ml-1">· saída {fmtNum(u.saida)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('entrada')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border-2 ${
            mode === 'entrada'
              ? 'bg-success/10 border-success text-success'
              : 'border-border text-muted-foreground hover:border-success/50'
          }`}
        >
          <ArrowUpCircle className="w-4 h-4" /> Entrada
        </button>
        <button
          onClick={() => setMode('saida')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border-2 ${
            mode === 'saida'
              ? 'bg-destructive/10 border-destructive text-destructive'
              : 'border-border text-muted-foreground hover:border-destructive/50'
          }`}
        >
          <ArrowDownCircle className="w-4 h-4" /> Saída
        </button>
        <span className="text-xs text-muted-foreground self-center ml-1">define o tipo dos itens adicionados pela busca</span>
      </div>

      {/* Search + dropdown */}
      <div className="relative">
        <div className="flex items-center border border-border rounded-xl px-3 bg-background focus-within:ring-2 focus-within:ring-primary/30">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            ref={searchRef}
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Buscar item para adicionar..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        {showDropdown && filtered.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {filtered.map(item => (
              <button
                key={item.id}
                onMouseDown={() => addItem(item)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary text-left text-sm"
              >
                <div>
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">({item.category})</span>
                </div>
                <span className="text-muted-foreground text-xs">{fmtNum(item.current_stock)} {item.unit}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Batch list */}
      {batch.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Item</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-24">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Estoque Atual</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-36">Qtd.</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {batch.map(line => {
                const qty = parseFloat(line.qty) || 0;
                const newStock = line.type === 'entrada'
                  ? line.item.current_stock + qty
                  : Math.max(0, line.item.current_stock - qty);
                const isOver = line.type === 'saida' && qty > line.item.current_stock;

                return (
                  <tr key={lineKey(line.item.id, line.type)} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{line.item.name}</p>
                      <p className="text-xs text-muted-foreground">{line.item.category}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleType(line.item.id, line.type)}
                        title="Clique para trocar o tipo"
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition-colors ${
                          line.type === 'entrada'
                            ? 'bg-success/10 border-success/30 text-success hover:border-success'
                            : 'bg-destructive/10 border-destructive/30 text-destructive hover:border-destructive'
                        }`}
                      >
                        {line.type === 'entrada' ? <ArrowUpCircle className="w-3.5 h-3.5" /> : <ArrowDownCircle className="w-3.5 h-3.5" />}
                        {line.type === 'entrada' ? 'Entrada' : 'Saída'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtNum(line.item.current_stock)} {line.item.unit}
                      {qty > 0 && (
                        <span className={`ml-2 text-xs font-medium ${line.type === 'entrada' ? 'text-success' : isOver ? 'text-destructive' : 'text-orange-500'}`}>
                          → {fmtNum(newStock)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.qty}
                        onChange={e => updateQty(line.item.id, line.type, e.target.value)}
                        placeholder="0"
                        className={`w-28 text-right ${isOver ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        autoFocus={batch.length === 1}
                      />
                      {isOver && <p className="text-xs text-destructive mt-1">Acima do estoque</p>}
                    </td>
                    <td className="px-2 py-3">
                      <button onClick={() => removeItem(line.item.id, line.type)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-border py-16 text-center text-muted-foreground text-sm">
          Use a busca acima, ou baixe a planilha, preencha e suba de novo.
        </div>
      )}

      {/* Notes */}
      {batch.length > 0 && (
        <div>
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observação (opcional) — vale para todos os itens"
          />
        </div>
      )}

      {/* Summary + confirm */}
      {validLines.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{validLines.length} item{validLines.length !== 1 ? 's' : ''}</span>
            {' · '}total de{' '}
            <span className="font-medium text-foreground">{fmtNum(total)} unid.</span>
            {' '}
            {isMixed ? (
              <>
                <Badge className="text-xs ml-1">{entradaLines.length} entrada{entradaLines.length !== 1 ? 's' : ''}</Badge>
                <Badge variant="destructive" className="text-xs ml-1">{saidaLines.length} saída{saidaLines.length !== 1 ? 's' : ''}</Badge>
              </>
            ) : (
              <Badge variant={entradaLines.length > 0 ? 'default' : 'destructive'} className="text-xs ml-1">
                {entradaLines.length > 0 ? 'Entrada' : 'Saída'}
              </Badge>
            )}
          </div>
          <Button
            onClick={handleConfirm}
            disabled={saving || saved}
            className={!isMixed && saidaLines.length > 0 ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              : saved ? <><CheckCircle2 className="w-4 h-4 mr-2" />Salvo!</>
              : <>Confirmar {validLines.length} lançamento{validLines.length !== 1 ? 's' : ''}</>
            }
          </Button>
        </div>
      )}
    </div>
  );
}
