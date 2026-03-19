import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, ChevronDown, ChevronRight, Package, Star, ExternalLink, ChevronsUpDown, Check, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type SupplierItem = {
  record_id: string;
  item_id: string;
  item_name: string;
  item_unit: string;
  unit_price: number;
  is_preferred: boolean;
  notes: string | null;
};

type Supplier = {
  name: string;
  items: SupplierItem[];
  preferredCount: number;
};

type StockItemOption = {
  id: string;
  name: string;
  unit: string;
};

type DialogFormState = {
  supplierName: string;
  selectedItemId: string | null;
  unitPrice: string;
  isPreferred: boolean;
  notes: string;
};

const EMPTY_FORM: DialogFormState = {
  supplierName: '',
  selectedItemId: null,
  unitPrice: '',
  isPreferred: false,
  notes: '',
};

export default function FornecedoresPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<DialogFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [stockItems, setStockItems] = useState<StockItemOption[]>([]);
  const [itemComboOpen, setItemComboOpen] = useState(false);

  useEffect(() => { load(); loadStockItems(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('item_suppliers')
      .select('id, item_id, supplier_name, unit_price, is_preferred, notes, stock_items(name, unit)')
      .order('supplier_name');

    if (error || !data) { setLoading(false); return; }

    const map: Record<string, SupplierItem[]> = {};
    for (const row of data as any[]) {
      const si = row.stock_items as { name?: string; unit?: string } | null;
      const supplier = row.supplier_name as string;
      if (!map[supplier]) map[supplier] = [];
      map[supplier].push({
        record_id: row.id,
        item_id: row.item_id,
        item_name: si?.name || '?',
        item_unit: si?.unit || '',
        unit_price: row.unit_price || 0,
        is_preferred: row.is_preferred || false,
        notes: row.notes || null,
      });
    }

    const list: Supplier[] = Object.entries(map)
      .map(([name, items]) => ({
        name,
        items: items.sort((a, b) => a.item_name.localeCompare(b.item_name)),
        preferredCount: items.filter(i => i.is_preferred).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setSuppliers(list);
    setLoading(false);
  };

  const loadStockItems = async () => {
    const { data } = await supabase
      .from('stock_items')
      .select('id, name, unit')
      .order('name');
    setStockItems((data || []) as StockItemOption[]);
  };

  const toggle = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const openAddDialog = () => {
    setEditingRecordId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (item: SupplierItem, supplierName: string) => {
    setEditingRecordId(item.record_id);
    setForm({
      supplierName,
      selectedItemId: item.item_id,
      unitPrice: String(item.unit_price),
      isPreferred: item.is_preferred,
      notes: item.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.supplierName.trim()) { toast.error('Nome do fornecedor é obrigatório'); return; }
    if (!form.selectedItemId) { toast.error('Selecione um insumo'); return; }
    setSaving(true);
    if (editingRecordId) {
      const { error } = await supabase
        .from('item_suppliers')
        .update({
          item_id: form.selectedItemId,
          supplier_name: form.supplierName.trim(),
          unit_price: parseFloat(form.unitPrice) || 0,
          is_preferred: form.isPreferred,
          notes: form.notes.trim() || null,
        } as any)
        .eq('id', editingRecordId);
      if (error) { toast.error('Erro ao salvar'); setSaving(false); return; }
      toast.success('Fornecedor atualizado!');
    } else {
      const { error } = await supabase
        .from('item_suppliers')
        .insert({
          item_id: form.selectedItemId,
          supplier_name: form.supplierName.trim(),
          unit_price: parseFloat(form.unitPrice) || 0,
          is_preferred: form.isPreferred,
          notes: form.notes.trim() || null,
        } as any);
      if (error) { toast.error('Erro ao salvar'); setSaving(false); return; }
      toast.success('Fornecedor cadastrado!');
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm('Remover este registro de fornecedor?')) return;
    const { error } = await supabase.from('item_suppliers').delete().eq('id', recordId);
    if (error) { toast.error('Erro ao remover'); return; }
    toast.success('Fornecedor removido');
    load();
  };

  const selectedItemLabel = form.selectedItemId
    ? stockItems.find(s => s.id === form.selectedItemId)?.name || 'Selecionar insumo...'
    : 'Selecionar insumo...';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Fornecedores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fornecedores cadastrados nos insumos do estoque. Para editar, acesse o insumo em{' '}
            <button className="text-primary underline" onClick={() => navigate('/items')}>Estoque Geral</button>.
          </p>
        </div>
        <Button size="sm" onClick={openAddDialog} className="flex-shrink-0">
          <Plus className="w-3.5 h-3.5 mr-1" />Novo Fornecedor
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-10 text-center">
          <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum fornecedor cadastrado.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique em <button className="text-primary underline" onClick={openAddDialog}>Novo Fornecedor</button> para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map(supplier => {
            const isOpen = expanded.has(supplier.name);
            return (
              <div key={supplier.name} className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left"
                  onClick={() => toggle(supplier.name)}
                >
                  <div className="flex items-center gap-3">
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    }
                    <div>
                      <p className="font-semibold text-foreground">{supplier.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {supplier.items.length} insumo{supplier.items.length !== 1 ? 's' : ''}
                        {supplier.preferredCount > 0 && ` · ${supplier.preferredCount} preferido${supplier.preferredCount !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {supplier.preferredCount > 0 && (
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 gap-1">
                        <Star className="w-2.5 h-2.5" />
                        {supplier.preferredCount} preferido{supplier.preferredCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border text-xs text-muted-foreground">
                          <th className="text-left px-5 py-2 font-semibold">INSUMO</th>
                          <th className="text-right px-4 py-2 font-semibold">PREÇO UNIT.</th>
                          <th className="text-left px-4 py-2 font-semibold">OBSERVAÇÕES</th>
                          <th className="text-center px-4 py-2 font-semibold">PREFERIDO</th>
                          <th className="w-10 px-3 py-2"></th>
                          <th className="text-right px-3 py-2 w-24"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {supplier.items.map(item => (
                          <tr key={item.record_id} className="hover:bg-muted/10">
                            <td className="px-5 py-2.5">
                              <span className="font-medium text-foreground">{item.item_name}</span>
                              <span className="text-muted-foreground text-xs ml-1.5">({item.item_unit})</span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">
                              {item.unit_price > 0 ? `R$ ${item.unit_price.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">
                              {item.notes || <span className="opacity-30">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {item.is_preferred && (
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 mx-auto" />
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7"
                                title="Ver insumo"
                                onClick={() => navigate(`/items/${item.item_id}`)}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-7 h-7"
                                  title="Editar"
                                  onClick={() => openEditDialog(item, supplier.name)}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-7 h-7 text-destructive/60 hover:text-destructive"
                                  title="Remover"
                                  onClick={() => handleDelete(item.record_id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRecordId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nome do fornecedor *</label>
              <Input
                value={form.supplierName}
                onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))}
                placeholder="Ex: Atacadão"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Insumo *</label>
              <Popover open={itemComboOpen} onOpenChange={setItemComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={itemComboOpen}
                    className="w-full justify-between font-normal text-sm"
                  >
                    <span className={cn('truncate', !form.selectedItemId && 'text-muted-foreground')}>
                      {selectedItemLabel}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar insumo..." />
                    <CommandList>
                      <CommandEmpty>Nenhum insumo encontrado.</CommandEmpty>
                      <CommandGroup>
                        {stockItems.map(si => (
                          <CommandItem
                            key={si.id}
                            value={si.name}
                            onSelect={() => {
                              setForm(f => ({ ...f, selectedItemId: si.id }));
                              setItemComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn('mr-2 h-4 w-4', form.selectedItemId === si.id ? 'opacity-100' : 'opacity-0')}
                            />
                            <span className="flex-1">{si.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{si.unit}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Preço unitário (R$)</label>
              <Input
                type="number"
                step="0.01"
                value={form.unitPrice}
                onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Observações</label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Opcional"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="fornecedor-preferred"
                checked={form.isPreferred}
                onChange={e => setForm(f => ({ ...f, isPreferred: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="fornecedor-preferred" className="text-sm text-foreground cursor-pointer">
                Fornecedor preferido
              </label>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingRecordId ? 'Salvar alterações' : 'Cadastrar fornecedor'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
