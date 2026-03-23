import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaterialImageUpload } from '@/components/MaterialImageUpload';
import { Plus, Search, Package, Loader2, ChevronRight, ArrowLeft } from 'lucide-react';
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

const UNITS = ['unid', 'peça', 'conjunto', 'par', 'kit', 'jogo', 'metro'];

const CATEGORY_EMOJIS: Record<string, string> = {
  'Louças': '🍽️', 'Cutelaria': '🍴', 'Taças e Copos': '🥂', 'Rechauds': '🔥',
  'Equipamentos': '⚙️', 'Decoração': '🌸', 'Toalhas e Tecidos': '🧶',
  'Mesas e Cadeiras': '🪑', 'Iluminação': '💡', 'Outros': '📦',
};

export default function EmployeeMateriaisPage() {
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
    const [itemsRes, catsRes] = await Promise.all([
      supabase.from('material_items' as any).select('id, name, category, description, total_qty, available_qty, damaged_qty, unit, image_url').order('category').order('name'),
      supabase.from('material_categories' as any).select('name').order('sort_order').order('name'),
    ]);
    if (itemsRes.data) setItems(itemsRes.data as MaterialItem[]);
    if (catsRes.data) setDbCategories((catsRes.data as any[]).map(c => c.name));
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
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      total_qty: Number(form.total_qty) || 0,
      available_qty: Number(form.available_qty) || 0,
      unit: form.unit,
      image_url: form.image_url,
    });
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
    toast.success('Material cadastrado!');
    setSaving(false);
    setDialog(false);
    setForm({ name: '', category: '', description: '', total_qty: 0, available_qty: 0, unit: 'unid', image_url: null });
    load();
  };

  // Group items by category
  const categories = Array.from(new Set(items.map(i => i.category))).sort();

  const filtered = items.filter(item => {
    const matchCat = !selectedCategory || item.category === selectedCategory;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const allCategories = Array.from(new Set([...dbCategories, ...categories])).sort();

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  // Category detail view
  if (selectedCategory && !search) {
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
          {catItems.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover border border-border flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{item.name}</p>
                {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`font-semibold text-sm ${item.available_qty === 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {item.available_qty} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">disponível</p>
              </div>
            </div>
          ))}
          {catItems.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">Nenhum item nesta categoria</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-foreground">Materiais</h1>
        <Button size="sm" onClick={() => setDialog(true)} className="gold-button">
          <Plus className="w-4 h-4 mr-1" />Novo
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Search results */}
      {search ? (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-11 h-11 rounded-lg object-cover border border-border flex-shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category}</p>
              </div>
              <span className={`text-sm font-semibold ${item.available_qty === 0 ? 'text-destructive' : 'text-foreground'}`}>
                {item.available_qty} {item.unit}
              </span>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center py-10 text-muted-foreground text-sm">Nenhum resultado</p>}
        </div>
      ) : (
        <>
          {/* Category cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {categories.map(cat => {
              const catItems = items.filter(i => i.category === cat);
              const available = catItems.reduce((s, i) => s + i.available_qty, 0);
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="bg-white rounded-xl border border-border p-4 text-left hover:border-primary/40 hover:bg-amber-50/30 transition-all active:scale-95"
                >
                  <div className="text-2xl mb-2">{CATEGORY_EMOJIS[cat] || '📦'}</div>
                  <p className="font-semibold text-sm text-foreground leading-tight">{cat}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {catItems.length} iten{catItems.length !== 1 ? 's' : ''} · {available} disponíveis
                  </p>
                </button>
              );
            })}
          </div>

          {/* All items list */}
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
                      {catItems.slice(0, 4).map(item => (
                        <div key={item.id} className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-border flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
                            {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
                          </div>
                          <span className={`text-sm font-semibold flex-shrink-0 ${item.available_qty === 0 ? 'text-destructive' : 'text-foreground'}`}>
                            {item.available_qty} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
                          </span>
                        </div>
                      ))}
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

      {/* New Material Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Material</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Photo */}
            <div>
              <Label className="mb-2 block">Foto</Label>
              <MaterialImageUpload
                value={form.image_url}
                onChange={url => setForm(f => ({ ...f, image_url: url }))}
              />
            </div>
            <div>
              <Label>Nome *</Label>
              <Input className="mt-1" placeholder="Ex: Taça de vinho" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Categoria *</Label>
              <div className="flex gap-2 mt-1">
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="flex-shrink-0" onClick={() => setNewCatDialog(true)} title="Nova categoria">
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
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gold-button">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Cadastrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Category Dialog */}
      <Dialog open={newCatDialog} onOpenChange={setNewCatDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Ex: Louças, Rechauds..."
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
            />
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
