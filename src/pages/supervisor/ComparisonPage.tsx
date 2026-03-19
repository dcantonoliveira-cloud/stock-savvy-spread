import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { BarChart3, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

type Item = { id: string; name: string; unit: string };
type Sheet = { id: string; name: string; servings: number; items: { item_id: string; quantity: number }[] };
type Output = { item_id: string; quantity: number; date: string };

export default function SupervisorComparisonPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [itemsRes, sheetsRes, outputsRes] = await Promise.all([
        supabase.from('stock_items').select('id, name, unit'),
        supabase.from('technical_sheets').select('*'),
        supabase.from('stock_outputs').select('item_id, quantity, date'),
      ]);
      if (itemsRes.data) setItems(itemsRes.data);
      if (outputsRes.data) setOutputs(outputsRes.data);
      if (sheetsRes.data) {
        const withItems = await Promise.all(
          sheetsRes.data.map(async s => {
            const { data: si } = await supabase.from('technical_sheet_items').select('item_id, quantity').eq('sheet_id', s.id);
            return { ...s, items: si || [] };
          })
        );
        setSheets(withItems);
      }
      setLoading(false);
    };
    load();
  }, []);

  const sheet = sheets.find(s => s.id === selectedSheet);
  const filteredOutputs = outputs.filter(o => {
    if (dateFrom && o.date < dateFrom) return false;
    if (dateTo && o.date > dateTo) return false;
    return true;
  });

  const actualUsage: Record<string, number> = {};
  filteredOutputs.forEach(o => { actualUsage[o.item_id] = (actualUsage[o.item_id] || 0) + o.quantity; });

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold gold-text">Comparativo</h1>
        <p className="text-muted-foreground mt-1">Saída real vs ficha técnica</p>
      </div>

      <div className="flex gap-4 mb-8 flex-wrap">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Ficha Técnica</label>
          <Select value={selectedSheet} onValueChange={setSelectedSheet}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Selecione uma ficha" /></SelectTrigger>
            <SelectContent>
              {sheets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Data Início</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Data Fim</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-44" />
        </div>
      </div>

      {sheet ? (
        <div className="glass-card rounded-xl p-4">
          <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b border-border pb-3 mb-3">
            <span>Item</span>
            <span className="text-center">Previsto</span>
            <span className="text-center">Saída Real</span>
            <span className="text-center">Diferença</span>
          </div>
          {sheet.items.map(si => {
            const item = items.find(i => i.id === si.item_id);
            const actual = actualUsage[si.item_id] || 0;
            const diff = actual - si.quantity;
            const pct = si.quantity > 0 ? ((diff / si.quantity) * 100).toFixed(0) : '—';
            return (
              <div key={si.item_id} className="grid grid-cols-4 gap-4 text-sm py-3 border-b border-border/50 last:border-0 items-center">
                <div>
                  <p className="text-foreground font-medium">{item?.name}</p>
                  <p className="text-xs text-muted-foreground">{item?.unit}</p>
                </div>
                <p className="text-center text-muted-foreground">{si.quantity}</p>
                <p className="text-center text-foreground font-medium">{actual}</p>
                <div className="flex items-center justify-center gap-1">
                  {diff > 0 ? (
                    <span className="text-destructive flex items-center gap-1"><TrendingUp className="w-3 h-3" />+{diff} ({pct}%)</span>
                  ) : diff < 0 ? (
                    <span className="text-success flex items-center gap-1"><TrendingDown className="w-3 h-3" />{diff} ({pct}%)</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card rounded-xl p-12 text-center animate-fade-in">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-display font-semibold text-foreground mb-2">Selecione uma Ficha Técnica</h2>
          <p className="text-muted-foreground text-sm">Compare as saídas reais com o consumo previsto.</p>
        </div>
      )}
    </div>
  );
}
