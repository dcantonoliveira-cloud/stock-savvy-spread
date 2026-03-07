import { useEffect, useState } from 'react';
import { getOutputs, getSheets } from '@/lib/storage';
import { StockOutput, TechnicalSheet } from '@/types/inventory';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';

export default function ComparisonPage() {
  const [sheets, setSheets] = useState<TechnicalSheet[]>([]);
  const [outputs, setOutputs] = useState<StockOutput[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    setSheets(getSheets());
    setOutputs(getOutputs());
  }, []);

  const sheet = sheets.find(s => s.id === selectedSheet);

  const filteredOutputs = outputs.filter(o => {
    if (dateFrom && o.date < dateFrom) return false;
    if (dateTo && o.date > dateTo) return false;
    return true;
  });

  // Aggregate actual usage per item
  const actualUsage: Record<string, number> = {};
  filteredOutputs.forEach(o => {
    actualUsage[o.itemId] = (actualUsage[o.itemId] || 0) + o.quantity;
  });

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
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-4">
            <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b border-border pb-3 mb-3">
              <span>Item</span>
              <span className="text-center">Previsto (ficha)</span>
              <span className="text-center">Saída Real</span>
              <span className="text-center">Diferença</span>
            </div>
            {sheet.items.map(item => {
              const actual = actualUsage[item.itemId] || 0;
              const diff = actual - item.quantity;
              const diffPercent = item.quantity > 0 ? ((diff / item.quantity) * 100).toFixed(0) : '—';

              return (
                <div key={item.itemId} className="grid grid-cols-4 gap-4 text-sm py-3 border-b border-border/50 last:border-0 items-center">
                  <div>
                    <p className="text-foreground font-medium">{item.itemName}</p>
                    <p className="text-xs text-muted-foreground">{item.unit}</p>
                  </div>
                  <p className="text-center text-muted-foreground">{item.quantity}</p>
                  <p className="text-center text-foreground font-medium">{actual}</p>
                  <div className="flex items-center justify-center gap-1">
                    {diff > 0 ? (
                      <span className="text-destructive flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />+{diff} ({diffPercent}%)
                      </span>
                    ) : diff < 0 ? (
                      <span className="text-success flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" />{diff} ({diffPercent}%)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-12 text-center animate-fade-in">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-display font-semibold text-foreground mb-2">Selecione uma Ficha Técnica</h2>
          <p className="text-muted-foreground text-sm">Compare as saídas reais com o consumo previsto na ficha técnica.</p>
        </div>
      )}
    </div>
  );
}
