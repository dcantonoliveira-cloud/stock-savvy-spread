import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertOctagon, Bell, CheckCircle, Loader2 } from 'lucide-react';

type StockItem = {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number;
};

type Alert = {
  item: StockItem;
  type: 'zero' | 'low';
};

export default function NotificationsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('stock_items').select('id, name, category, unit, current_stock, min_stock').order('current_stock', { ascending: true });
      if (data) {
        const alertItems: Alert[] = [];
        data.forEach(item => {
          if (item.current_stock <= 0) alertItems.push({ item, type: 'zero' });
          else if (item.current_stock <= item.min_stock) alertItems.push({ item, type: 'low' });
        });
        setAlerts(alertItems);
      }
      setLoading(false);
    };
    load();

    // Realtime subscription for stock changes
    const channel = supabase
      .channel('stock-alerts')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stock_items' }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const zeroAlerts = alerts.filter(a => a.type === 'zero');
  const lowAlerts = alerts.filter(a => a.type === 'low');

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Notificações</h1>
          <p className="text-muted-foreground mt-1">Alertas de estoque em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          {alerts.length > 0 ? (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <Bell className="w-3 h-3 mr-1" /> {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-sm px-3 py-1 text-success border-success/30">
              <CheckCircle className="w-3 h-3 mr-1" /> Tudo OK
            </Badge>
          )}
        </div>
      </div>

      {/* Zero stock */}
      {zeroAlerts.length > 0 && (
        <Card className="mb-6 border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2 text-destructive">
              <AlertOctagon className="w-5 h-5" />
              Estoque Zerado ({zeroAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {zeroAlerts.map(({ item }) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category} · Mín: {item.min_stock} {item.unit}</p>
                </div>
                <Badge variant="destructive">0 {item.unit}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Low stock */}
      {lowAlerts.length > 0 && (
        <Card className="mb-6 border-warning/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
              Estoque Baixo ({lowAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowAlerts.map(({ item }) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/10">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category} · Mín: {item.min_stock} {item.unit}</p>
                </div>
                <Badge className="bg-warning text-warning-foreground">{item.current_stock} {item.unit}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {alerts.length === 0 && (
        <div className="text-center py-16">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h3 className="text-xl font-display font-semibold text-foreground mb-2">Tudo em ordem! ✅</h3>
          <p className="text-muted-foreground">Nenhum item com estoque abaixo do mínimo.</p>
        </div>
      )}
    </div>
  );
}
