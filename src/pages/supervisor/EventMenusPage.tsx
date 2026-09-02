import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, Package, X, ShoppingCart, Search, Loader2 } from 'lucide-react';
import ConsolidatedShoppingListDialog from '@/components/ConsolidatedShoppingListDialog';
import { toast } from 'sonner';

type EventOption = { id: string; event_name: string; event_date: string; location_text: string | null; guest_count: number | null };
type MenuRow = {
  id: string; event_id: string | null; status: string;
  name: string | null; location: string | null; event_date: string | null; guest_count: number | null;
  created_at: string; dishCount: number;
  events: { event_name: string; event_date: string; location_text: string | null; guest_count: number | null } | null;
};

export default function EventMenusPage() {
  const navigate = useNavigate();
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [consolidatedOpen, setConsolidatedOpen] = useState(false);

  // create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'event' | 'manual'>('event');
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [manualGuests, setManualGuests] = useState('100');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from('event_menus') as any)
      .select('id, event_id, status, name, location, event_date, guest_count, created_at, events:event_id(event_name, event_date, location_text, guest_count)')
      .order('created_at', { ascending: false });
    const menusData = (data || []) as any[];
    const ids = menusData.map(m => m.id);
    const dishCounts: Record<string, number> = {};
    if (ids.length) {
      const { data: dishRows } = await (supabase.from('event_menu_dishes') as any).select('menu_id').in('menu_id', ids);
      for (const d of (dishRows || []) as any[]) dishCounts[d.menu_id] = (dishCounts[d.menu_id] || 0) + 1;
    }
    setMenus(menusData.map(m => ({ ...m, dishCount: dishCounts[m.id] || 0 })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!createOpen || createMode !== 'event') return;
    const today = new Date().toISOString().slice(0, 10);
    supabase.from('events').select('id, event_name, event_date, location_text, guest_count')
      .gte('event_date', today).eq('status', 'confirmed').not('event_name', 'is', null).neq('event_name', '')
      .order('event_date', { ascending: true }).limit(200)
      .then(({ data }) => { if (data) setEvents(data as unknown as EventOption[]); });
  }, [createOpen, createMode]);

  const resetCreate = () => {
    setCreateMode('event'); setSelectedEventId(''); setEventSearch('');
    setManualName(''); setManualDate(''); setManualLocation(''); setManualGuests('100');
  };

  const handleCreate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const createdBy = user?.email || null;

    if (createMode === 'event') {
      if (!selectedEventId) { toast.error('Selecione um evento'); return; }
      const selectedEvent = events.find(e => e.id === selectedEventId);
      setCreating(true);
      const { data, error } = await (supabase.from('event_menus') as any)
        .insert({
          event_id: selectedEventId, status: 'draft', wizard_step: 1, created_by: createdBy,
          // Preenche só pra satisfazer a coluna obrigatória — a exibição sempre lê
          // o nome/data/local/convidados ao vivo do evento vinculado, não daqui.
          name: selectedEvent?.event_name || 'Cardápio', event_date: selectedEvent?.event_date || null,
          location: selectedEvent?.location_text || null, guest_count: selectedEvent?.guest_count || 100,
        })
        .select('id').single();
      setCreating(false);
      if (error || !data) { toast.error('Erro ao criar cardápio: ' + (error?.message || '')); console.error(error); return; }
      setCreateOpen(false); resetCreate();
      navigate(`/event-menus/${data.id}`);
    } else {
      if (!manualName.trim()) { toast.error('Nome é obrigatório'); return; }
      if (!manualDate) { toast.error('Data é obrigatória'); return; }
      setCreating(true);
      const { data, error } = await (supabase.from('event_menus') as any)
        .insert({
          name: manualName.trim(), event_date: manualDate, location: manualLocation.trim() || null,
          guest_count: parseInt(manualGuests) || 0, status: 'draft', wizard_step: 1, created_by: createdBy,
        })
        .select('id').single();
      setCreating(false);
      if (error || !data) { toast.error('Erro ao criar cardápio: ' + (error?.message || '')); console.error(error); return; }
      setCreateOpen(false); resetCreate();
      navigate(`/event-menus/${data.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este cardápio?')) return;
    await supabase.from('event_menu_dishes').delete().eq('menu_id', id);
    await supabase.from('event_menus').delete().eq('id', id);
    toast.success('Cardápio removido!');
    load();
  };

  const filteredEvents = events.filter(e => !eventSearch.trim() || e.event_name.toLowerCase().includes(eventSearch.toLowerCase()));

  const displayName = (m: MenuRow) => m.events?.event_name || m.name || 'Sem nome';
  const displayDate = (m: MenuRow) => m.events?.event_date || m.event_date;
  const displayLocation = (m: MenuRow) => m.events?.location_text || m.location;
  const displayGuests = (m: MenuRow) => m.events?.guest_count ?? m.guest_count;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Cardápios de Eventos</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monte o cardápio, defina quantidades e gere a lista de compras</p>
        </div>
        <Button onClick={() => { resetCreate(); setCreateOpen(true); }}><Plus className="w-4 h-4 mr-2" />Novo Cardápio</Button>
      </div>

      <Dialog open={createOpen} onOpenChange={o => { setCreateOpen(o); if (!o) resetCreate(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cardápio</DialogTitle>
            <DialogDescription>Escolha um evento já cadastrado ou preencha manualmente</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setCreateMode('event')} className={`flex-1 h-9 rounded-lg text-sm font-medium border transition-colors ${createMode === 'event' ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>Evento existente</button>
            <button onClick={() => setCreateMode('manual')} className={`flex-1 h-9 rounded-lg text-sm font-medium border transition-colors ${createMode === 'manual' ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>Preencher manualmente</button>
          </div>

          {createMode === 'event' ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={eventSearch} onChange={e => setEventSearch(e.target.value)} placeholder="Buscar evento..." className="pl-9" />
              </div>
              <div className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border/50">
                {filteredEvents.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${selectedEventId === ev.id ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                  >
                    <p className="font-medium text-foreground">{ev.event_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {ev.location_text && ` · ${ev.location_text}`}
                      {ev.guest_count ? ` · ${ev.guest_count} convidados` : ''}
                    </p>
                  </button>
                ))}
                {filteredEvents.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento futuro encontrado.</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div><label className="text-sm text-muted-foreground mb-1 block">Nome do Evento *</label><Input value={manualName} onChange={e => setManualName(e.target.value)} autoFocus /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm text-muted-foreground mb-1 block">Data *</label><Input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} /></div>
                <div><label className="text-sm text-muted-foreground mb-1 block">Convidados</label><Input type="number" value={manualGuests} onChange={e => setManualGuests(e.target.value)} /></div>
              </div>
              <div><label className="text-sm text-muted-foreground mb-1 block">Local</label><Input value={manualLocation} onChange={e => setManualLocation(e.target.value)} /></div>
            </div>
          )}

          <Button className="w-full mt-2" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Criar Cardápio
          </Button>
        </DialogContent>
      </Dialog>

      {selectedIds.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background px-5 py-3 rounded-full shadow-xl">
          <span className="text-sm font-medium">{selectedIds.size} cardápios selecionados</span>
          <Button size="sm" className="rounded-full gap-2 bg-primary text-white hover:bg-primary/90" onClick={() => setConsolidatedOpen(true)}>
            <ShoppingCart className="w-4 h-4" />Lista Consolidada
          </Button>
          <button className="text-background/60 hover:text-background ml-1" onClick={() => setSelectedIds(new Set())}><X className="w-4 h-4" /></button>
        </div>
      )}
      <ConsolidatedShoppingListDialog open={consolidatedOpen} onClose={() => setConsolidatedOpen(false)} menuIds={Array.from(selectedIds)} />

      <div className="rounded-xl border border-border overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
              <th className="text-left px-3 py-2.5 w-8">
                <input type="checkbox" className="rounded" checked={menus.length > 0 && selectedIds.size === menus.length}
                  onChange={e => setSelectedIds(e.target.checked ? new Set(menus.map(m => m.id)) : new Set())} />
              </th>
              <th className="text-left px-3 py-2.5">CARDÁPIO</th>
              <th className="text-center px-3 py-2.5">STATUS</th>
              <th className="text-center px-3 py-2.5">DATA</th>
              <th className="text-left px-3 py-2.5">LOCAL</th>
              <th className="text-center px-3 py-2.5">CONVIDADOS</th>
              <th className="text-center px-3 py-2.5">PRATOS</th>
              <th className="text-center px-3 py-2.5 w-20">AÇÕES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="px-3 py-3"><div className="w-4 h-4 bg-muted rounded" /></td>
                <td className="px-3 py-3"><div className="h-4 bg-muted rounded w-40" /></td>
                <td className="px-3 py-3 text-center"><div className="h-4 bg-muted rounded w-16 mx-auto" /></td>
                <td className="px-3 py-3 text-center"><div className="h-4 bg-muted rounded w-20 mx-auto" /></td>
                <td className="px-3 py-3"><div className="h-4 bg-muted rounded w-24" /></td>
                <td className="px-3 py-3 text-center"><div className="h-4 bg-muted rounded w-8 mx-auto" /></td>
                <td className="px-3 py-3 text-center"><div className="h-4 bg-muted rounded w-8 mx-auto" /></td>
                <td className="px-3 py-3"><div className="h-4 bg-muted rounded w-16 mx-auto" /></td>
              </tr>
            ))}
            {!loading && menus.map(m => (
              <tr key={m.id} className="hover:bg-amber-50 transition-colors cursor-pointer" onClick={() => navigate(`/event-menus/${m.id}`)}>
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="rounded" checked={selectedIds.has(m.id)}
                    onChange={e => setSelectedIds(prev => { const next = new Set(prev); e.target.checked ? next.add(m.id) : next.delete(m.id); return next; })} />
                </td>
                <td className="px-3 py-3 font-medium text-foreground">{displayName(m)}</td>
                <td className="px-3 py-3 text-center">
                  <Badge variant={m.status === 'draft' ? 'secondary' : 'default'} className="text-[10px]">
                    {m.status === 'draft' ? 'Rascunho' : 'Pronto'}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-center text-xs text-muted-foreground">
                  {displayDate(m) ? new Date(displayDate(m) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{displayLocation(m) || '—'}</td>
                <td className="px-3 py-3 text-center text-sm font-medium text-foreground">{displayGuests(m) ?? '—'}</td>
                <td className="px-3 py-3 text-center text-sm font-medium text-foreground">{m.dishCount}</td>
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-0.5">
                    <Button variant="ghost" size="icon" className="w-7 h-7" title="Abrir" onClick={() => navigate(`/event-menus/${m.id}`)}><Eye className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7" title="Excluir" onClick={() => handleDelete(m.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && menus.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-16 text-center text-muted-foreground"><Package className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Nenhum cardápio criado ainda.</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
