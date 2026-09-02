import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ShoppingCart, Save, Package } from 'lucide-react';
import { toast } from 'sonner';
import ShoppingListView from '@/components/menu-wizard/ShoppingListView';

export type SavedShoppingList = {
  id: string;
  name: string;
  menuIds: string[];
  eventNames: string[];
  createdAt: string;
};

export function getSavedShoppingLists(): SavedShoppingList[] {
  try { return JSON.parse(localStorage.getItem('savedShoppingLists') || '[]'); } catch { return []; }
}

export function deleteSavedShoppingList(id: string) {
  const lists = getSavedShoppingLists().filter(l => l.id !== id);
  localStorage.setItem('savedShoppingLists', JSON.stringify(lists));
}

type EventSummary = { id: string; name: string; event_date: string | null; guest_count: number };

type Props = {
  open: boolean;
  onClose: () => void;
  menuIds: string[];
  onSaved?: () => void;
};

export default function ConsolidatedShoppingListDialog({ open, onClose, menuIds, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [hasDishes, setHasDishes] = useState(true);

  useEffect(() => {
    if (open && menuIds.length > 0) load();
    else { setEvents([]); }
  }, [open, JSON.stringify(menuIds)]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: menusData } = await (supabase.from('event_menus') as any)
        .select('id, name, event_date, guest_count, events:event_id(event_name, event_date, guest_count)').in('id', menuIds);
      setEvents(((menusData || []) as any[]).map(m => ({
        id: m.id,
        name: m.events?.event_name || m.name,
        event_date: m.events?.event_date || m.event_date,
        guest_count: m.events?.guest_count ?? m.guest_count,
      })));

      const { count } = await (supabase.from('event_menu_dishes') as any)
        .select('id', { count: 'exact', head: true }).in('menu_id', menuIds);
      setHasDishes((count || 0) > 0);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar cardápios');
    }
    setLoading(false);
  };

  const title = events.map(e => e.name).join(' + ') || 'Lista Consolidada';

  const handleSave = () => {
    const existing = getSavedShoppingLists();
    const already = existing.find(l => JSON.stringify([...l.menuIds].sort()) === JSON.stringify([...menuIds].sort()));
    if (already) { toast.info('Esta lista já está salva.'); return; }
    const newList: SavedShoppingList = {
      id: crypto.randomUUID(), name: events.map(e => e.name).join(' + '),
      menuIds: [...menuIds], eventNames: events.map(e => e.name), createdAt: new Date().toISOString(),
    };
    localStorage.setItem('savedShoppingLists', JSON.stringify([...existing, newList]));
    toast.success('Lista salva!');
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            {menuIds.length === 1 ? (events[0]?.name || 'Lista de Compras') : 'Lista Consolidada'}
          </DialogTitle>
          {events.length > 0 && (
            <DialogDescription>{events.map(e => e.name).join(' + ')}</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Carregando lista de compras...</p>
            </div>
          ) : !hasDishes ? (
            <div className="py-16 text-center">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">Nenhum prato encontrado para estes cardápios.</p>
            </div>
          ) : (
            <ShoppingListView menuIds={menuIds} title={title} />
          )}
        </div>

        <div className="border-t border-border pt-3 flex items-center justify-end">
          <div className="flex gap-2">
            {hasDishes && menuIds.length > 1 && (
              <Button variant="outline" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />Salvar Lista
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
