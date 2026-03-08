import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpCircle, ArrowDownCircle, History, X } from 'lucide-react';

type MovementEntry = {
  id: string;
  type: 'entry' | 'output';
  quantity: number;
  date: string;
  created_at: string;
  notes: string | null;
  employee_name?: string;
  event_name?: string;
};

interface ItemHistoryDialogProps {
  itemId: string | null;
  itemName: string;
  itemUnit: string;
  open: boolean;
  onClose: () => void;
}

export default function ItemHistoryDialog({ itemId, itemName, itemUnit, open, onClose }: ItemHistoryDialogProps) {
  const [movements, setMovements] = useState<MovementEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId || !open) return;
    setLoading(true);

    const loadHistory = async () => {
      const [entriesRes, outputsRes] = await Promise.all([
        supabase.from('stock_entries').select('id, quantity, date, created_at, notes').eq('item_id', itemId).order('created_at', { ascending: false }).limit(50),
        supabase.from('stock_outputs').select('id, quantity, date, created_at, notes, employee_name, event_name').eq('item_id', itemId).order('created_at', { ascending: false }).limit(50),
      ]);

      const entries: MovementEntry[] = (entriesRes.data || []).map(e => ({ ...e, type: 'entry' as const }));
      const outputs: MovementEntry[] = (outputsRes.data || []).map(o => ({ ...o, type: 'output' as const }));

      const all = [...entries, ...outputs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setMovements(all);
      setLoading(false);
    };

    loadHistory();
  }, [itemId, open]);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico: {itemName}
          </DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>}

        {!loading && movements.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação registrada.</p>
        )}

        <div className="space-y-2">
          {movements.map(m => (
            <div key={`${m.type}-${m.id}`} className="flex items-start gap-3 p-3 rounded-lg bg-accent">
              <div className={`mt-0.5 p-1 rounded ${m.type === 'entry' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                {m.type === 'entry' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {m.type === 'entry' ? '+' : '-'}{m.quantity} {itemUnit}
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {m.type === 'entry' ? 'Entrada' : 'Saída'}
                  </Badge>
                </div>
                {m.employee_name && <p className="text-xs text-muted-foreground">Por: {m.employee_name}</p>}
                {m.event_name && <p className="text-xs text-muted-foreground">Evento: {m.event_name}</p>}
                {m.notes && <p className="text-xs text-muted-foreground">Obs: {m.notes}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(m.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
