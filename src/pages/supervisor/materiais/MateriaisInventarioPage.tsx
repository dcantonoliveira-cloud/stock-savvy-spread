import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Warehouse, Plus, Pencil, Trash2, Loader2, Search, AlertTriangle, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { MaterialImageUpload } from '@/components/MaterialImageUpload';

type MaterialItem = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  total_qty: number;
  available_qty: number;
  damaged_qty: number;
  min_qty: number;
  unit: string;
  unit_price: number | null;
  image_url: string | null;
  notes: string | null;
};

const UNITS = ['unid', 'peça', 'conjunto', 'par', 'kit', 'jogo', 'metro'];

const defaultForm = {
  name: '', category: '', description: '', total_qty: 0,
  available_qty: 0, damaged_qty: 0, min_qty: 0, unit: 'unid',
  unit_price: '', image_url: '', notes: ''
};

export default function MateriaisInventarioPage() {
  const { role } = useAuth();
  const isSupervisor = role === 'supervisor';

  const [items, setItems] = useState<MaterialItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<MaterialItem | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [itemsRes, catsRes] = await Promise.all([
      supabase.from('material_items' as any).select('*').order('category').order('name'),
      supabase.from('material_categories' as any).select('name').order('sort_order').order('name'),
    ]);
    if (itemsRes.data) setItems(itemsRes.data as MaterialItem[]);
    if (catsRes.data) setCategories((catsRes.data as any[]).map(c => c.name));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(defaultForm); setDialog(true); };
  const openEdit = (item: MaterialItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      category: item.category,
      description: item.description || '',
      total_qty: item.total_qty,
      available_qty: item.available_qty,
      damaged_qty: item.damaged_qty,
      min_qty: item.min_qty,
      unit: item.unit,
      unit_price: item.unit_price != null ? String(item.unit_price) : '',
      image_url: item.image_url || '',
      notes: item.notes || '',
    });
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.category.trim()) { toast.error('Categoria é obrigatória'); return; }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim() || null,
      total_qty: Number(form.total_qty) || 0,
      available_qty: Number(form.available_qty) || 0,
      damaged_qty: Number(form.damaged_qty) || 0,
      min_qty: Number(form.min_qty) || 0,
      unit: form.unit,
      image_url: form.image_url.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (isSupervisor) {
      payload.unit_price = form.unit_price ? parseFloat(String(form.unit_price).replace(',', '.')) || 0 : null;
    }
    if (editing) {
      const { error } = await supabase.from('material_items' as any).update(payload).eq('id', editing.id);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); setSaving(false); return; }
      toast.success('Item atualizado!');
    } else {
      const { error } = await supabase.from('material_items' as any).insert(payload);
      if (error) { toast.error('Erro ao criar: ' + error.message); setSaving(false); return; }
      toast.success('Item criado!');
    }
    setSaving(false);
    setDialog(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este item permanentemente?')) return;
    const { error } = await supabase.from('material_items' as any).delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    toast.success('Item removido');
    load();
  };

  // Merge DB categories with any categories already in use
  const allCategories = Array.from(new Set([
    ...categories,
    ...items.map(i => i.category),
  ])).sort();

  const filtered = items.filter(item => {
    const matchSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === 'all' || item.category === filterCategory;
    return matchSearch && matchCat;
  });

  const totalItems = items.length;
  const lowItems = items.filter(i => i.available_qty <= i.min_qty && i.min_qty > 0).length;
  const damagedItems = items.filter(i => i.damaged_qty > 0).length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Warehouse className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold gold-text">Materiais</h1>
            <p className="text-muted-foreground mt-0.5">
              {totalItems} iten{totalItems !== 1 ? 's' : ''} cadastrado{totalItems !== 1 ? 's' : ''}
              {lowItems > 0 && <span className="text-destructive ml-2">· {lowItems} com estoque baixo</span>}
              {damagedItems > 0 && <span className="text-amber-600 ml-2">· {damagedItems} com danificados</span>}
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gold-button">
          <Plus className="w-4 h-4 mr-2" />Novo Item
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar item ou categoria..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum item encontrado</p>
          <p className="text-sm mt-1">Adicione materiais ao depósito clicando em "Novo Item"</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs w-12"></th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs w-full min-w-[200px]">ITEM</th>
                  <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs whitespace-nowrap">CATEGORIA</th>
                  <th className="text-right px-3 py-3 font-semibold text-muted-foreground text-xs whitespace-nowrap">DISPONÍVEL</th>
                  <th className="text-right px-3 py-3 font-semibold text-muted-foreground text-xs whitespace-nowrap">TOTAL</th>
                  <th className="text-right px-3 py-3 font-semibold text-muted-foreground text-xs whitespace-nowrap">DANIF.</th>
                  {isSupervisor && <th className="text-right px-3 py-3 font-semibold text-muted-foreground text-xs whitespace-nowrap">PREÇO</th>}
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">UN.</th>
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs w-20">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(item => {
                  const isLow = item.available_qty <= item.min_qty && item.min_qty > 0;
                  const hasDamaged = item.damaged_qty > 0;
                  return (
                    <tr key={item.id} className={`hover:bg-amber-50/40 transition-colors ${isLow ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-2">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-8 h-8 rounded-lg object-cover border border-border" onError={e => (e.currentTarget.style.display = 'none')} />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                            <Package className="w-4 h-4 text-muted-foreground/40" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {isLow && <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" title="Disponível abaixo do mínimo" />}
                          <div>
                            <p className="font-medium text-foreground">{item.name}</p>
                            {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] font-normal">{item.category}</Badge>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`font-semibold ${isLow ? 'text-destructive' : 'text-foreground'}`}>{item.available_qty}</span>
                        {item.min_qty > 0 && <span className="text-xs text-muted-foreground ml-1">/ mín {item.min_qty}</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground">{item.total_qty}</td>
                      <td className="px-3 py-3 text-right">
                        {hasDamaged ? <span className="font-medium text-amber-600">{item.damaged_qty}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      {isSupervisor && (
                        <td className="px-3 py-3 text-right text-muted-foreground">
                          {item.unit_price != null && item.unit_price > 0
                            ? `R$ ${item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '—'}
                        </td>
                      )}
                      <td className="px-3 py-3 text-center text-muted-foreground text-xs">{item.unit}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(item)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Item' : 'Novo Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome *</Label>
              <Input className="mt-1" placeholder="Ex: Taça de vinho" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {allCategories.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Crie categorias em <strong>Materiais → Categorias</strong></p>
              )}
            </div>
            <div>
              <Label>Descrição</Label>
              <Input className="mt-1" placeholder="Detalhes opcionais..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {/* Image Upload */}
            <div>
              <Label className="mb-2 block">Foto</Label>
              <MaterialImageUpload
                value={form.image_url || null}
                onChange={url => setForm(f => ({ ...f, image_url: url || '' }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Qtde Total</Label>
                <Input className="mt-1" type="number" min={0} value={form.total_qty} onChange={e => setForm(f => ({ ...f, total_qty: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Qtde Disponível</Label>
                <Input className="mt-1" type="number" min={0} value={form.available_qty} onChange={e => setForm(f => ({ ...f, available_qty: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Qtde Danificados</Label>
                <Input className="mt-1" type="number" min={0} value={form.damaged_qty} onChange={e => setForm(f => ({ ...f, damaged_qty: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Qtde Mínima</Label>
                <Input className="mt-1" type="number" min={0} value={form.min_qty} onChange={e => setForm(f => ({ ...f, min_qty: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidade</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {isSupervisor && (
                <div>
                  <Label>Preço (R$)</Label>
                  <Input className="mt-1" type="text" inputMode="decimal" placeholder="0,00" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
                </div>
              )}
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea className="mt-1" placeholder="Notas internas..." rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gold-button">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editing ? 'Salvar' : 'Criar Item'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
