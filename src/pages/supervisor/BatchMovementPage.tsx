import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, Search, Trash2, Loader2, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { fmtNum } from '@/lib/format';

type Item = { id: string; name: string; category: string; unit: string; current_stock: number };
type BatchLine = { item: Item; qty: string };

export default function BatchMovementPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<'entrada' | 'saida'>('entrada');
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [batch, setBatch] = useState<BatchLine[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('stock_items').select('id, name, category, unit, current_stock')
      .neq('category', '_sistema_').order('name').range(0, 9999)
      .then(({ data }) => { if (data) setItems(data as Item[]); });
  }, []);

  const filtered = search.trim().length < 1 ? [] : items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) &&
    !batch.some(b => b.item.id === i.id)
  ).slice(0, 12);

  const addItem = (item: Item) => {
    setBatch(prev => [...prev, { item, qty: '' }]);
    setSearch('');
    setShowDropdown(false);
    searchRef.current?.focus();
  };

  const removeItem = (id: string) => setBatch(prev => prev.filter(b => b.item.id !== id));

  const updateQty = (id: string, val: string) => {
    setBatch(prev => prev.map(b => b.item.id === id ? { ...b, qty: val } : b));
  };

  const validLines = batch.filter(b => parseFloat(b.qty) > 0);

  const handleConfirm = async () => {
    if (!validLines.length) { toast.error('Adicione pelo menos um item com quantidade'); return; }
    if (!user) return;
    setSaving(true);

    const now = new Date().toISOString();
    let hasError = false;

    for (const line of validLines) {
      const qty = parseFloat(line.qty);
      if (mode === 'entrada') {
        const { error } = await (supabase.from('stock_entries') as any).insert({
          item_id: line.item.id, quantity: qty,
          notes: notes.trim() || null,
          registered_by: user.id,
        });
        if (error) { console.error(error); hasError = true; continue; }
        await (supabase.from('stock_items') as any)
          .update({ current_stock: line.item.current_stock + qty })
          .eq('id', line.item.id);
      } else {
        const { error } = await (supabase.from('stock_outputs') as any).insert({
          item_id: line.item.id, quantity: qty,
          notes: notes.trim() || null,
          employee_name: user.email || 'Supervisor',
          date: now.split('T')[0],
        });
        if (error) { console.error(error); hasError = true; continue; }
        await (supabase.from('stock_items') as any)
          .update({ current_stock: Math.max(0, line.item.current_stock - qty) })
          .eq('id', line.item.id);
      }
    }

    setSaving(false);
    if (hasError) {
      toast.error('Alguns itens tiveram erro. Verifique o console.');
    } else {
      toast.success(`${validLines.length} ${mode === 'entrada' ? 'entradas' : 'saídas'} registradas!`);
      setSaved(true);
      // Refresh item stocks
      const { data } = await (supabase.from('stock_items') as any)
        .select('id, name, category, unit, current_stock')
        .neq('category', '_sistema_').order('name').range(0, 9999);
      if (data) setItems(data as Item[]);
      setBatch([]);
      setNotes('');
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const total = validLines.reduce((s, l) => s + parseFloat(l.qty), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold gold-text">Lançamento em Lote</h1>
        <p className="text-muted-foreground mt-1 text-sm">Registre entradas ou saídas de vários itens de uma vez.</p>
      </div>

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
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Estoque Atual</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-36">
                  Qtd. {mode === 'entrada' ? 'Entrada' : 'Saída'}
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {batch.map(line => {
                const qty = parseFloat(line.qty) || 0;
                const newStock = mode === 'entrada'
                  ? line.item.current_stock + qty
                  : Math.max(0, line.item.current_stock - qty);
                const isOver = mode === 'saida' && qty > line.item.current_stock;

                return (
                  <tr key={line.item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{line.item.name}</p>
                      <p className="text-xs text-muted-foreground">{line.item.category}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtNum(line.item.current_stock)} {line.item.unit}
                      {qty > 0 && (
                        <span className={`ml-2 text-xs font-medium ${mode === 'entrada' ? 'text-success' : isOver ? 'text-destructive' : 'text-orange-500'}`}>
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
                        onChange={e => updateQty(line.item.id, e.target.value)}
                        placeholder="0"
                        className={`w-28 text-right ${isOver ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        autoFocus={batch.length === 1}
                      />
                      {isOver && <p className="text-xs text-destructive mt-1">Acima do estoque</p>}
                    </td>
                    <td className="px-2 py-3">
                      <button onClick={() => removeItem(line.item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
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
          Use a busca acima para adicionar itens ao lançamento.
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
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{validLines.length} item{validLines.length !== 1 ? 's' : ''}</span>
            {' · '}total de{' '}
            <span className="font-medium text-foreground">{fmtNum(total)} unid.</span>
            {' '}
            <Badge variant={mode === 'entrada' ? 'default' : 'destructive'} className="text-xs ml-1">
              {mode === 'entrada' ? 'Entrada' : 'Saída'}
            </Badge>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={saving || saved}
            className={mode === 'saida' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              : saved ? <><CheckCircle2 className="w-4 h-4 mr-2" />Salvo!</>
              : mode === 'entrada'
                ? <><ArrowUpCircle className="w-4 h-4 mr-2" />Confirmar {validLines.length} Entrada{validLines.length !== 1 ? 's' : ''}</>
                : <><ArrowDownCircle className="w-4 h-4 mr-2" />Confirmar {validLines.length} Saída{validLines.length !== 1 ? 's' : ''}</>
            }
          </Button>
        </div>
      )}
    </div>
  );
}
