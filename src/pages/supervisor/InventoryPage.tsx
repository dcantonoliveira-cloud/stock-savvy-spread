import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardCheck, Plus, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type StockItem = {
  id: string; name: string; category: string; unit: string; current_stock: number;
};

type CountItem = {
  item: StockItem;
  counted: string;
};

type InventoryCount = {
  id: string;
  date: string;
  status: string;
  counted_by: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
};

export default function InventoryPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [activeCount, setActiveCount] = useState<string | null>(null);
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [countedBy, setCountedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<InventoryCount[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDetails, setHistoryDetails] = useState<any[]>([]);
  const [detailCountId, setDetailCountId] = useState<string | null>(null);

  const load = async () => {
    const { data: itemsData } = await supabase.from('stock_items').select('id, name, category, unit, current_stock').order('category').order('name');
    if (itemsData) setItems(itemsData);

    const { data: historyData } = await supabase.from('inventory_counts' as any).select('*').order('created_at', { ascending: false }).limit(20);
    if (historyData) setHistory(historyData as unknown as InventoryCount[]);
  };

  useEffect(() => { load(); }, []);

  const startNewCount = async () => {
    // Create a new count
    const { data, error } = await supabase.from('inventory_counts' as any).insert({
      status: 'in_progress',
    }).select('id').single();

    if (error || !data) { toast.error('Erro ao iniciar contagem'); return; }
    const countId = (data as any).id;

    // Create count items for each stock item
    const countItemsData = items.map(item => ({
      count_id: countId,
      item_id: item.id,
      system_stock: item.current_stock,
    }));

    const { error: insertError } = await supabase.from('inventory_count_items' as any).insert(countItemsData);
    if (insertError) { toast.error('Erro ao criar itens de contagem'); return; }

    setActiveCount(countId);
    setCountItems(items.map(item => ({ item, counted: '' })));
    setCountedBy('');
    setNotes('');
    toast.success('Contagem iniciada! Conte cada item.');
  };

  const handleFinishCount = async () => {
    if (!countedBy.trim()) {
      toast.error('Informe quem fez a contagem');
      return;
    }
    if (!activeCount) return;
    setSubmitting(true);

    // Update each count item with the counted value
    for (const ci of countItems) {
      const counted = ci.counted ? parseFloat(ci.counted) : null;
      await supabase.from('inventory_count_items' as any)
        .update({ counted_stock: counted })
        .eq('count_id', activeCount)
        .eq('item_id', ci.item.id);
    }

    // Mark count as completed
    await supabase.from('inventory_counts' as any)
      .update({
        status: 'completed',
        counted_by: countedBy.trim(),
        notes: notes.trim() || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', activeCount);

    toast.success('✅ Contagem finalizada com sucesso!');
    setActiveCount(null);
    setCountItems([]);
    setSubmitting(false);
    load();
  };

  const loadDetails = async (countId: string) => {
    const { data } = await supabase
      .from('inventory_count_items' as any)
      .select('*, stock_items:item_id(name, unit, category)' as any)
      .eq('count_id', countId);
    if (data) {
      setHistoryDetails(data as any);
      setDetailCountId(countId);
    }
  };

  // Group items by category for counting
  const groupedCountItems = countItems.reduce<Record<string, CountItem[]>>((acc, ci) => {
    const cat = ci.item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ci);
    return acc;
  }, {});

  const countedCount = countItems.filter(ci => ci.counted !== '').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Inventário</h1>
          <p className="text-muted-foreground mt-1">Contagem física do estoque</p>
        </div>
        {!activeCount && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Fechar Histórico' : 'Histórico'}
            </Button>
            <Button onClick={startNewCount}>
              <Plus className="w-4 h-4 mr-2" />Nova Contagem
            </Button>
          </div>
        )}
      </div>

      {/* Active counting */}
      {activeCount && (
        <div>
          <div className="bg-accent rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Contagem em andamento</p>
              <p className="text-sm text-muted-foreground">{countedCount} de {countItems.length} itens contados</p>
            </div>
            <Badge variant="outline" className="text-primary border-primary/30">
              {Math.round((countedCount / countItems.length) * 100)}%
            </Badge>
          </div>

          {Object.entries(groupedCountItems).map(([cat, catItems]) => (
            <div key={cat} className="mb-6">
              <h3 className="text-sm font-display font-semibold text-muted-foreground mb-3 uppercase tracking-wider">{cat}</h3>
              <div className="space-y-2">
                {catItems.map(ci => {
                  const diff = ci.counted ? parseFloat(ci.counted) - ci.item.current_stock : null;
                  return (
                    <div key={ci.item.id} className="glass-card rounded-xl p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{ci.item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Sistema: {ci.item.current_stock} {ci.item.unit}
                          {diff !== null && diff !== 0 && (
                            <span className={diff > 0 ? ' text-success' : ' text-destructive'}>
                              {' '}({diff > 0 ? '+' : ''}{diff})
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          inputMode="decimal"
                          className="h-10 text-center font-semibold rounded-lg"
                          placeholder="Qtd"
                          value={ci.counted}
                          onChange={e => {
                            setCountItems(prev => prev.map(c =>
                              c.item.id === ci.item.id ? { ...c, counted: e.target.value } : c
                            ));
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Finish section */}
          <Card className="mt-6 border-primary/20">
            <CardContent className="p-5 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Quem fez a contagem? *</label>
                <Input
                  value={countedBy}
                  onChange={e => setCountedBy(e.target.value)}
                  placeholder="Nome do funcionário"
                  className="h-12 text-base rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Observações (opcional)</label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Contagem mensal de março"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1 h-12 text-base rounded-xl"
                  onClick={handleFinishCount}
                  disabled={submitting || !countedBy.trim()}
                >
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Finalizar Contagem
                </Button>
                <Button variant="outline" onClick={() => { setActiveCount(null); setCountItems([]); }}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History */}
      {!activeCount && showHistory && (
        <div className="space-y-3">
          {history.length === 0 && (
            <p className="text-center text-muted-foreground py-12">Nenhuma contagem realizada ainda.</p>
          )}
          {history.map(h => (
            <div key={h.id} className="glass-card rounded-xl p-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-primary" />
                    <p className="font-medium text-foreground">
                      {new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Por: {h.counted_by || '—'} {h.notes ? `· ${h.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={h.status === 'completed' ? 'default' : 'outline'}>
                    {h.status === 'completed' ? 'Concluída' : 'Em andamento'}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => loadDetails(h.id)}>
                    Detalhes
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No active count, no history shown */}
      {!activeCount && !showHistory && (
        <div className="text-center py-16">
          <ClipboardCheck className="w-20 h-20 text-primary/30 mx-auto mb-4" />
          <h3 className="text-xl font-display font-semibold text-foreground mb-2">Contagem de Inventário</h3>
          <p className="text-muted-foreground mb-2 max-w-md mx-auto">
            Inicie uma nova contagem para comparar o estoque físico com o sistema. 
            Ideal para o 1º dia útil do mês.
          </p>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            💡 <strong>Modo cozinha:</strong> Qualquer pessoa pode contar sem precisar logar. 
            Basta informar o nome ao finalizar.
          </p>
          <Button size="lg" onClick={startNewCount}>
            <Plus className="w-5 h-5 mr-2" /> Iniciar Contagem
          </Button>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={detailCountId !== null} onOpenChange={open => { if (!open) setDetailCountId(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Contagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {historyDetails.map((d: any) => {
              const diff = (d.counted_stock ?? 0) - d.system_stock;
              const hasDiscrepancy = d.counted_stock !== null && diff !== 0;
              return (
                <div key={d.id} className={`flex items-center justify-between p-3 rounded-lg ${hasDiscrepancy ? 'bg-warning/5 border border-warning/20' : 'bg-accent'}`}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.stock_items?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{d.stock_items?.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Sistema: {d.system_stock}</span>
                      {' → '}
                      <span className="font-semibold">{d.counted_stock ?? '—'}</span>
                    </p>
                    {hasDiscrepancy && (
                      <p className={`text-xs font-semibold ${diff > 0 ? 'text-success' : 'text-destructive'}`}>
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        {diff > 0 ? '+' : ''}{diff} {d.stock_items?.unit}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
