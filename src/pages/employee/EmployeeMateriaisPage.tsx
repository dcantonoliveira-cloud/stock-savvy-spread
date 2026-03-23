import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaterialImageUpload } from '@/components/MaterialImageUpload';
import {
  Plus, Search, Package, Loader2, ChevronRight, ArrowLeft,
  ClipboardList, Calendar, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

type MaterialItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  total_qty: number;
  available_qty: number;
  damaged_qty: number;
  unit: string;
  image_url: string | null;
};

type EventLoan = {
  id: string;
  event_name: string;
  date_out: string;
  status: string;
  items: { material_item_id: string; qty_out: number; item_name: string; item_unit: string }[];
};

const UNITS = ['unid', 'peça', 'conjunto', 'par', 'kit', 'jogo', 'metro'];

const CATEGORY_EMOJIS: Record<string, string> = {
  'Louças': '🍽️', 'Cutelaria': '🍴', 'Taças e Copos': '🥂', 'Rechauds': '🔥',
  'Equipamentos': '⚙️', 'Decoração': '🌸', 'Toalhas e Tecidos': '🧶',
  'Mesas e Cadeiras': '🪑', 'Iluminação': '💡', 'Outros': '📦',
};

function ItemCard({ item, compact = false }: { item: MaterialItem; compact?: boolean }) {
  const inUse = item.total_qty - item.available_qty;
  const imgSize = compact ? 'w-10 h-10' : 'w-12 h-12';
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className={`${imgSize} rounded-lg object-cover border border-border flex-shrink-0`} />
      ) : (
        <div className={`${imgSize} rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0`}>
          <Package className={`${iconSize} text-muted-foreground/40`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
        {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
      </div>
      {/* Totais */}
      <div className="flex items-center gap-3 flex-shrink-0 text-right">
        <div>
          <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Total</p>
          <p className="text-sm font-semibold text-foreground">{item.total_qty} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span></p>
        </div>
        {inUse > 0 && (
          <div>
            <p className="text-[10px] text-amber-600 leading-none mb-0.5">Em uso</p>
            <p className="text-sm font-semibold text-amber-600">{inUse} <span className="text-xs font-normal">{item.unit}</span></p>
          </div>
        )}
        <div>
          <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Disponível</p>
          <p className={`text-sm font-semibold ${item.available_qty === 0 ? 'text-destructive' : 'text-foreground'}`}>
            {item.available_qty} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeMateriaisPage() {
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [events, setEvents] = useState<EventLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventario' | 'eventos'>('inventario');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventLoan | null>(null);
  const [search, setSearch] = useState('');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // New item dialog
  const [dialog, setDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCatDialog, setNewCatDialog] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [form, setForm] = useState({
    name: '', category: '', description: '',
    total_qty: 0, available_qty: 0, unit: 'unid', image_url: null as string | null,
  });

  const load = async () => {
    setLoading(true);
    const [itemsRes, catsRes, loansRes] = await Promise.all([
      supabase.from('material_items' as any)
        .select('id, name, category, description, total_qty, available_qty, damaged_qty, unit, image_url')
        .order('category').order('name'),
      supabase.from('material_categories' as any).select('name').order('sort_order').order('name'),
      supabase.from('material_loans' as any)
        .select('id, event_name, date_out, status')
        .in('status', ['active', 'planning'])
        .order('date_out'),
    ]);

    if (itemsRes.data) setItems(itemsRes.data as MaterialItem[]);
    if (catsRes.data) setDbCategories((catsRes.data as any[]).map(c => c.name));

    // Load loan items for each active loan
    const rawLoans = (loansRes.data || []) as any[];
    if (rawLoans.length > 0) {
      const loanIds = rawLoans.map(l => l.id);
      const { data: loanItemsData } = await supabase
        .from('material_loan_items' as any)
        .select('loan_id, material_item_id, qty_out, material_items(name, unit)')
        .in('loan_id', loanIds);

      const loanItemsMap: Record<string, EventLoan['items']> = {};
      for (const li of (loanItemsData || []) as any[]) {
        if (!loanItemsMap[li.loan_id]) loanItemsMap[li.loan_id] = [];
        loanItemsMap[li.loan_id].push({
          material_item_id: li.material_item_id,
          qty_out: li.qty_out,
          item_name: li.material_items?.name || '?',
          item_unit: li.material_items?.unit || '',
        });
      }

      setEvents(rawLoans.map(l => ({ ...l, items: loanItemsMap[l.id] || [] })));
    } else {
      setEvents([]);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const { error } = await supabase.from('material_categories' as any).insert({ name: newCatName.trim(), sort_order: dbCategories.length });
    if (error) { toast.error('Erro ao criar categoria'); return; }
    toast.success('Categoria criada!');
    setDbCategories(prev => [...prev, newCatName.trim()]);
    setForm(f => ({ ...f, category: newCatName.trim() }));
    setNewCatName('');
    setNewCatDialog(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.category) { toast.error('Categoria é obrigatória'); return; }
    setSaving(true);
    const { error } = await supabase.from('material_items' as any).insert({
      name: form.name.trim(), category: form.category,
      description: form.description.trim() || null,
      total_qty: Number(form.total_qty) || 0,
      available_qty: Number(form.available_qty) || 0,
      unit: form.unit, image_url: form.image_url,
    });
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
    toast.success('Material cadastrado!');
    setSaving(false);
    setDialog(false);
    setForm({ name: '', category: '', description: '', total_qty: 0, available_qty: 0, unit: 'unid', image_url: null });
    load();
  };

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const categories = Array.from(new Set(items.map(i => i.category))).sort();
  const allCategories = Array.from(new Set([...dbCategories, ...categories])).sort();
  const filtered = items.filter(item =>
    (!selectedCategory || item.category === selectedCategory) &&
    (!search || item.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  // ── EVENT SEPARATION VIEW ─────────────────────────────────────────────────
  if (selectedEvent) {
    const allChecked = selectedEvent.items.length > 0 && selectedEvent.items.every(i => checkedItems.has(i.material_item_id));
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => { setSelectedEvent(null); setCheckedItems(new Set()); }}
            className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{selectedEvent.event_name}</h2>
            <p className="text-xs text-muted-foreground">
              📅 {new Date(selectedEvent.date_out + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {checkedItems.size}/{selectedEvent.items.length} separados
          </span>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl border border-border p-3 mb-4 flex items-center gap-3">
          <div className="flex-1 bg-muted/30 rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all"
              style={{ width: selectedEvent.items.length > 0 ? `${(checkedItems.size / selectedEvent.items.length) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
            {selectedEvent.items.length > 0
              ? `${Math.round((checkedItems.size / selectedEvent.items.length) * 100)}%`
              : '0%'}
          </span>
          {allChecked && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600 flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />Completo!
            </span>
          )}
        </div>

        {selectedEvent.items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum material na lista deste evento</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedEvent.items.map(li => {
              const matItem = items.find(i => i.id === li.material_item_id);
              const checked = checkedItems.has(li.material_item_id);
              return (
                <button
                  key={li.material_item_id}
                  onClick={() => toggleCheck(li.material_item_id)}
                  className={`w-full bg-white rounded-xl border p-3 flex items-center gap-3 transition-all active:scale-[0.99] text-left ${
                    checked ? 'border-green-300 bg-green-50/50' : 'border-border'
                  }`}
                >
                  {/* Checkbox visual */}
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    checked ? 'border-green-500 bg-green-500' : 'border-muted-foreground/30'
                  }`}>
                    {checked && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>

                  {/* Foto */}
                  {matItem?.image_url ? (
                    <img src={matItem.image_url} alt={li.item_name}
                      className={`w-10 h-10 rounded-lg object-cover border border-border flex-shrink-0 ${checked ? 'opacity-60' : ''}`} />
                  ) : (
                    <div className={`w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0 ${checked ? 'opacity-40' : ''}`}>
                      <Package className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {li.item_name}
                    </p>
                    {matItem && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Disponível: {matItem.available_qty} {matItem.unit}
                      </p>
                    )}
                  </div>

                  {/* Qtde necessária */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-base font-bold ${checked ? 'text-green-600' : 'text-foreground'}`}>
                      {li.qty_out}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{li.item_unit}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── CATEGORY DETAIL ───────────────────────────────────────────────────────
  if (selectedCategory && !search && activeTab === 'inventario') {
    const catItems = items.filter(i => i.category === selectedCategory);
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setSelectedCategory(null)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-foreground">
            {CATEGORY_EMOJIS[selectedCategory] || '📦'} {selectedCategory}
          </h2>
          <span className="text-sm text-muted-foreground ml-auto">{catItems.length} {catItems.length === 1 ? 'item' : 'itens'}</span>
        </div>
        <div className="space-y-2">
          {catItems.map(item => <ItemCard key={item.id} item={item} />)}
          {catItems.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">Nenhum item nesta categoria</div>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN VIEW ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground">Materiais</h1>
        {activeTab === 'inventario' && (
          <Button size="sm" onClick={() => setDialog(true)} className="gold-button">
            <Plus className="w-4 h-4 mr-1" />Novo
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1 mb-5">
        <button
          onClick={() => setActiveTab('inventario')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'inventario' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
        >
          Inventário
        </button>
        <button
          onClick={() => setActiveTab('eventos')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${activeTab === 'eventos' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Eventos
          {events.length > 0 && (
            <span className={`text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold ${activeTab === 'eventos' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {events.length}
            </span>
          )}
        </button>
      </div>

      {/* ── INVENTÁRIO ── */}
      {activeTab === 'inventario' && (
        <>
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {search ? (
            <div className="space-y-2">
              {filtered.map(item => <ItemCard key={item.id} item={item} compact />)}
              {filtered.length === 0 && <p className="text-center py-10 text-muted-foreground text-sm">Nenhum resultado</p>}
            </div>
          ) : (
            <>
              {/* Category cards */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {categories.map(cat => {
                  const catItems = items.filter(i => i.category === cat);
                  const available = catItems.reduce((s, i) => s + i.available_qty, 0);
                  const total = catItems.reduce((s, i) => s + i.total_qty, 0);
                  return (
                    <button key={cat} onClick={() => setSelectedCategory(cat)}
                      className="bg-white rounded-xl border border-border p-4 text-left hover:border-primary/40 hover:bg-amber-50/30 transition-all active:scale-95">
                      <div className="text-2xl mb-2">{CATEGORY_EMOJIS[cat] || '📦'}</div>
                      <p className="font-semibold text-sm text-foreground leading-tight">{cat}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {catItems.length} iten{catItems.length !== 1 ? 's' : ''} · {available}/{total} disponíveis
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Items list */}
              {categories.length > 0 && (
                <div className="space-y-4">
                  {categories.map(cat => {
                    const catItems = items.filter(i => i.category === cat);
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {CATEGORY_EMOJIS[cat] || '📦'} {cat}
                          </p>
                          <button onClick={() => setSelectedCategory(cat)} className="text-xs text-primary flex items-center gap-0.5">
                            Ver todos <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {catItems.slice(0, 4).map(item => <ItemCard key={item.id} item={item} compact />)}
                          {catItems.length > 4 && (
                            <button onClick={() => setSelectedCategory(cat)} className="w-full text-center text-xs text-primary py-2">
                              + {catItems.length - 4} mais
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {categories.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Nenhum material cadastrado</p>
                  <p className="text-sm mt-1">Clique em "Novo" para adicionar</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── EVENTOS ── */}
      {activeTab === 'eventos' && (
        <div>
          {events.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhum evento ativo</p>
              <p className="text-sm mt-1">Os eventos com lista de materiais aparecem aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(ev => {
                const hasItems = ev.items.length > 0;
                return (
                  <button
                    key={ev.id}
                    onClick={() => { setSelectedEvent(ev); setCheckedItems(new Set()); }}
                    disabled={!hasItems}
                    className={`w-full bg-white rounded-xl border border-border p-4 text-left transition-all active:scale-[0.99] ${hasItems ? 'hover:border-primary/40 hover:bg-amber-50/20' : 'opacity-50 cursor-not-allowed'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <ClipboardList className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{ev.event_name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(ev.date_out + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className={`text-xs font-medium ${hasItems ? 'text-primary' : 'text-muted-foreground'}`}>
                            {hasItems ? `${ev.items.length} material${ev.items.length !== 1 ? 'is' : ''}` : 'Sem lista'}
                          </span>
                        </div>
                      </div>
                      {hasItems && <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* New Material Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Material</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="mb-2 block">Foto</Label>
              <MaterialImageUpload value={form.image_url} onChange={url => setForm(f => ({ ...f, image_url: url }))} />
            </div>
            <div>
              <Label>Nome *</Label>
              <Input className="mt-1" placeholder="Ex: Taça de vinho" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Categoria *</Label>
              <div className="flex gap-2 mt-1">
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="flex-shrink-0" onClick={() => setNewCatDialog(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input className="mt-1" placeholder="Detalhes opcionais..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Qtde Total</Label>
                <Input className="mt-1" type="number" min={0} value={form.total_qty} onChange={e => setForm(f => ({ ...f, total_qty: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Disponível</Label>
                <Input className="mt-1" type="number" min={0} value={form.available_qty} onChange={e => setForm(f => ({ ...f, available_qty: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gold-button">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Cadastrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Category Dialog */}
      <Dialog open={newCatDialog} onOpenChange={setNewCatDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Ex: Louças, Rechauds..." value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateCategory()} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setNewCatDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleCreateCategory} className="gold-button">Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
