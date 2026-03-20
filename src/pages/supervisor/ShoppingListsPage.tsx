import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Merge, Trash2, Calendar, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getSavedShoppingLists, deleteSavedShoppingList, SavedShoppingList,
} from '@/components/ConsolidatedShoppingListDialog';

type EventMenu = { id: string; name: string; event_date: string | null; guest_count: number; status: string };

const CONSOLIDATED_KEY = 'consolidatedEventIds';

function getConsolidatedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(CONSOLIDATED_KEY) || '[]'); } catch { return []; }
}

export default function ShoppingListsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventMenu[]>([]);
  const [savedLists, setSavedLists] = useState<SavedShoppingList[]>([]);
  const [consolidatedIds, setConsolidatedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadEvents();
    refresh();
  }, []);

  const loadEvents = async () => {
    const { data } = await supabase
      .from('event_menus').select('id, name, event_date, guest_count, status')
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    setEvents((data || []) as EventMenu[]);
  };

  const refresh = () => {
    setSavedLists(getSavedShoppingLists());
    setConsolidatedIds(getConsolidatedIds());
  };

  const handleDeleteSaved = (list: SavedShoppingList) => {
    deleteSavedShoppingList(list.id);
    const remaining = getSavedShoppingLists();
    const stillConsolidated = new Set(remaining.flatMap(l => l.menuIds));
    localStorage.setItem(CONSOLIDATED_KEY, JSON.stringify([...stillConsolidated]));
    refresh();
    toast.success('Lista removida. Os eventos voltaram para a lista individual.');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleMerge = () => {
    const ids = Array.from(selectedIds).join(',');
    navigate(`/shopping-lists/view?ids=${ids}`);
  };

  // Events not yet consolidated
  const individualEvents = events.filter(e => !consolidatedIds.includes(e.id));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold gold-text">Listas de Compras</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Selecione eventos para unificar ou clique em uma lista para visualizar
        </p>
      </div>

      {/* Consolidated lists */}
      {savedLists.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Listas Unificadas
          </h2>
          <div className="space-y-2">
            {savedLists.map(list => (
              <div key={list.id}
                className="flex items-center justify-between p-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer"
                onClick={() => navigate(`/shopping-lists/saved/${list.id}`)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Merge className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{list.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {list.eventNames.length} eventos unificados ·{' '}
                      Criada em {new Date(list.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <button
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={e => { e.stopPropagation(); handleDeleteSaved(list); }}
                  title="Remover lista unificada">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual event lists */}
      {individualEvents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Listas Individuais
          </h2>
          <div className="space-y-2">
            {individualEvents.map(event => (
              <div key={event.id}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                  selectedIds.has(event.id)
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-white hover:border-primary/30 hover:bg-amber-50/50'
                }`}
                onClick={() => {
                  if (selectedIds.size > 0) {
                    toggleSelect(event.id);
                  } else {
                    navigate(`/shopping-lists/view?ids=${event.id}`);
                  }
                }}>
                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedIds.has(event.id) ? 'bg-primary border-primary' : 'border-border'
                  }`}
                  onClick={e => { e.stopPropagation(); toggleSelect(event.id); }}>
                  {selectedIds.has(event.id) && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{event.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {event.event_date && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(event.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" />{event.guest_count} convidados
                    </span>
                  </div>
                </div>

                <Badge variant={event.status === 'draft' ? 'secondary' : 'default'} className="text-[10px] flex-shrink-0">
                  {event.status === 'draft' ? 'Rascunho' : event.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {individualEvents.length === 0 && savedLists.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum cardápio criado ainda.</p>
        </div>
      )}

      {/* Floating action bar */}
      {selectedIds.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background px-5 py-3 rounded-full shadow-xl">
          <span className="text-sm font-medium">{selectedIds.size} listas selecionadas</span>
          <Button size="sm" className="rounded-full gap-2 bg-primary text-white hover:bg-primary/90"
            onClick={handleMerge}>
            <Merge className="w-4 h-4" />
            Unificar Listas
          </Button>
          <button className="text-background/60 hover:text-background ml-1" onClick={() => setSelectedIds(new Set())}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
