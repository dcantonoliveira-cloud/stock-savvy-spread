import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardCheck, CheckCircle, Loader2, ShieldAlert, Clock } from 'lucide-react';

type StockItem = { id: string; name: string; category: string; unit: string; current_stock: number };
type CountItem = { item: StockItem; counted: string };

export default function PublicInventoryPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'invalid' | 'expired' | 'ready' | 'counting' | 'done'>('loading');
  const [countId, setCountId] = useState<string | null>(null);
  const [kitchenName, setKitchenName] = useState('');
  const [items, setItems] = useState<StockItem[]>([]);
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [countedBy, setCountedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    const { data, error } = await supabase
      .from('inventory_tokens')
      .select('*')
      .eq('token', token!)
      .single();

    if (error || !data) { setStatus('invalid'); return; }

    const tokenData = data as any;
    if (new Date(tokenData.expires_at) < new Date()) { setStatus('expired'); return; }

    setCountId(tokenData.count_id);

    // Load kitchen name
    if (tokenData.kitchen_id) {
      const { data: kd } = await supabase.from('kitchens').select('name').eq('id', tokenData.kitchen_id).single();
      if (kd) setKitchenName((kd as any).name);
    }

    // Load items
    const { data: itemsData } = await supabase
      .from('stock_items')
      .select('id, name, category, unit, current_stock')
      .order('category')
      .order('name');
    if (itemsData) setItems(itemsData);

    setStatus('ready');
  };

  const startCounting = () => {
    setCountItems(items.map(item => ({ item, counted: '' })));
    setStatus('counting');
  };

  const handleFinish = async () => {
    if (!countedBy.trim()) { return; }
    if (!countId) return;
    setSubmitting(true);

    for (const ci of countItems) {
      const counted = ci.counted ? parseFloat(ci.counted) : null;
      await supabase.from('inventory_count_items' as any)
        .update({ counted_stock: counted })
        .eq('count_id', countId)
        .eq('item_id', ci.item.id);
    }

    await supabase.from('inventory_counts' as any)
      .update({
        status: 'completed',
        counted_by: countedBy.trim(),
        notes: notes.trim() || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', countId);

    setSubmitting(false);
    setStatus('done');
  };

  const groupedCountItems = countItems.reduce<Record<string, CountItem[]>>((acc, ci) => {
    const cat = ci.item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ci);
    return acc;
  }, {});

  const countedCount = countItems.filter(ci => ci.counted !== '').length;

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-display font-bold text-foreground mb-2">Link Inválido</h1>
          <p className="text-muted-foreground">Este link de inventário não é válido. Solicite um novo ao supervisor.</p>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <Clock className="w-16 h-16 text-warning mx-auto mb-4" />
          <h1 className="text-xl font-display font-bold text-foreground mb-2">Link Expirado</h1>
          <p className="text-muted-foreground">Este link já expirou. Solicite um novo ao supervisor.</p>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="text-xl font-display font-bold text-foreground mb-2">Contagem Enviada!</h1>
          <p className="text-muted-foreground">A contagem foi registrada com sucesso. Obrigado, {countedBy}!</p>
        </div>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold gold-text mb-1">RONDELLO</h1>
            <p className="text-xs text-muted-foreground tracking-widest uppercase">Inventário</p>
          </div>
          <ClipboardCheck className="w-16 h-16 text-primary/40 mx-auto mb-4" />
          <h2 className="text-lg font-display font-semibold text-foreground mb-2">
            Contagem de Estoque{kitchenName ? ` — ${kitchenName}` : ''}
          </h2>
          <p className="text-muted-foreground mb-6">{items.length} itens para contar</p>
          <Button size="lg" onClick={startCounting} className="w-full">
            <ClipboardCheck className="w-5 h-5 mr-2" />Iniciar Contagem
          </Button>
        </div>
      </div>
    );
  }

  // Counting mode
  return (
    <div className="min-h-screen bg-background p-4 pb-32">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-4">
          <h1 className="font-display text-lg font-bold gold-text">RONDELLO</h1>
          {kitchenName && <p className="text-xs text-muted-foreground">{kitchenName}</p>}
        </div>

        <div className="bg-accent rounded-xl p-3 mb-6 flex items-center justify-between sticky top-2 z-10">
          <div>
            <p className="font-medium text-sm text-foreground">Contagem</p>
            <p className="text-xs text-muted-foreground">{countedCount}/{countItems.length} itens</p>
          </div>
          <Badge variant="outline" className="text-primary border-primary/30">
            {Math.round((countedCount / countItems.length) * 100)}%
          </Badge>
        </div>

        {Object.entries(groupedCountItems).map(([cat, catItems]) => (
          <div key={cat} className="mb-6">
            <h3 className="text-xs font-display font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{cat}</h3>
            <div className="space-y-2">
              {catItems.map(ci => {
                const diff = ci.counted ? parseFloat(ci.counted) - ci.item.current_stock : null;
                return (
                  <div key={ci.item.id} className="bg-card rounded-xl p-3 flex items-center gap-3 border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{ci.item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Sistema: {ci.item.current_stock} {ci.item.unit}
                        {diff !== null && diff !== 0 && (
                          <span className={diff > 0 ? ' text-green-500' : ' text-red-500'}>
                            {' '}({diff > 0 ? '+' : ''}{diff})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="h-10 text-center font-semibold"
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

        {/* Finish */}
        <Card className="border-primary/20 mt-6">
          <CardContent className="p-4 space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Seu nome *</label>
              <Input
                value={countedBy}
                onChange={e => setCountedBy(e.target.value)}
                placeholder="Quem fez a contagem"
                className="h-12 text-base"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Observações</label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
            </div>
            <Button
              className="w-full h-12 text-base"
              onClick={handleFinish}
              disabled={submitting || !countedBy.trim()}
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Enviar Contagem
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
