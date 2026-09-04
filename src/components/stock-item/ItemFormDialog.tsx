import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UNITS } from '@/types/inventory';
import { fmtNum } from '@/lib/format';
import { ItemImage } from '@/components/ItemImage';
import ResponsibleEditor from '@/components/stock-item/ResponsibleEditor';
import AliasEditor from '@/components/stock-item/AliasEditor';
import TagEditor from '@/components/stock-item/TagEditor';

export type StockItemFull = {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
  purchase_qty: number | null; barcode: string | null; image_url: string | null;
  subcategory_id: string | null;
};

type Subcategory = { id: string; name: string; category_id: string };

/**
 * Modal completo de criar/editar insumo — mesmo formulário usado na tela de Estoque Geral
 * (nome, subcategoria, unidade, estoque, mínimo, preço, embalagem, código de barras,
 * responsáveis, apelidos e tags). Reutilizável em qualquer tela que precise cadastrar
 * ou editar um insumo sem levar o usuário até o Estoque Geral.
 */
export default function ItemFormDialog({ open, onClose, item, onSaved }: {
  open: boolean;
  onClose: () => void;
  item?: StockItemFull;
  onSaved: (item: StockItemFull) => void;
}) {
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);
  const [allCategoryRecords, setAllCategoryRecords] = useState<{ id: string; name: string }[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ user_id: string; display_name: string }[]>([]);
  const [allGroups, setAllGroups] = useState<{ id: string; name: string }[]>([]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [unit, setUnit] = useState(UNITS[0]);
  const [currentStock, setCurrentStock] = useState('0');
  const [minStock, setMinStock] = useState('0');
  const [unitCost, setUnitCost] = useState('0');
  const [purchaseQty, setPurchaseQty] = useState('1');
  const [barcode, setBarcode] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name || '');
    setCategory(item?.category || '');
    setSubcategoryId(item?.subcategory_id || '');
    setUnit(item?.unit || UNITS[0]);
    setCurrentStock(item?.current_stock?.toString() || '0');
    setMinStock(item?.min_stock?.toString() || '0');
    setUnitCost(item?.unit_cost?.toString() || '0');
    setPurchaseQty(item?.purchase_qty?.toString() || '1');
    setBarcode(item?.barcode || '');
    setImageUrl(item?.image_url || null);

    setLoadingMeta(true);
    Promise.all([
      supabase.from('subcategories').select('id, name, category_id').order('name'),
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('profiles').select('user_id, display_name').order('display_name'),
      (supabase.from('inventory_groups') as any).select('id, name').order('name'),
      supabase.from('user_roles').select('user_id, role').eq('role', 'employee'),
    ]).then(([subsRes, catsRes, profsRes, grpsRes, rolesRes]) => {
      setAllSubcategories((subsRes.data || []) as Subcategory[]);
      setAllCategoryRecords((catsRes.data || []) as { id: string; name: string }[]);
      const employeeIds = new Set(((rolesRes.data || []) as { user_id: string }[]).map(r => r.user_id));
      setAllProfiles(((profsRes.data || []) as { user_id: string; display_name: string }[]).filter(p => employeeIds.has(p.user_id)));
      setAllGroups((grpsRes.data || []) as { id: string; name: string }[]);
      setLoadingMeta(false);
    });
  }, [open, item]);

  const catRec = allCategoryRecords.find(c => c.name === category);
  const availableSubcats = catRec ? allSubcategories.filter(s => s.category_id === catRec.id) : allSubcategories;

  const handleSubcatChange = (subcatId: string) => {
    setSubcategoryId(subcatId);
    const sub = allSubcategories.find(s => s.id === subcatId);
    if (sub) {
      const parentCat = allCategoryRecords.find(c => c.id === sub.category_id);
      if (parentCat) setCategory(parentCat.name);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!subcategoryId) { toast.error('Subcategoria é obrigatória'); return; }
    setSaving(true);
    const payload = {
      name: name.trim(), category, unit,
      current_stock: parseFloat(currentStock) || 0,
      min_stock: parseFloat(minStock) || 0,
      unit_cost: parseFloat(unitCost) || 0,
      purchase_qty: parseFloat(purchaseQty) || 1,
      barcode: barcode.trim() || null,
      image_url: imageUrl,
      subcategory_id: subcategoryId || null,
    };

    if (item?.id) {
      const { data, error } = await supabase.from('stock_items').update(payload as any).eq('id', item.id).select().single();
      setSaving(false);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
      toast.success('Item atualizado!');
      onSaved(data as unknown as StockItemFull);
      onClose();
      return;
    }

    const { data: created, error } = await supabase.from('stock_items').insert(payload as any).select().single();
    if (error || !created) {
      // Fallback: tenta só com campos essenciais, caso alguma coluna opcional não exista
      const { purchase_qty: _pq, subcategory_id: _sc, barcode: _bc, image_url: _iu, ...coreData } = payload;
      const { data: created2, error: e2 } = await supabase.from('stock_items').insert(coreData as any).select().single();
      setSaving(false);
      if (e2 || !created2) { toast.error('Erro ao cadastrar: ' + (e2?.message || error?.message || 'Item não foi salvo')); return; }
      toast.success('Item cadastrado!');
      onSaved(created2 as unknown as StockItemFull);
      onClose();
      return;
    }
    setSaving(false);
    toast.success('Item cadastrado!');
    onSaved(created as unknown as StockItemFull);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item?.id ? 'Editar Item' : 'Novo Item'}</DialogTitle>
          <DialogDescription>{item?.id ? 'Atualize os dados do item' : 'Preencha os dados do novo item'}</DialogDescription>
        </DialogHeader>
        {loadingMeta ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-4">
            {item?.id && (
              <div className="flex flex-col items-center py-2">
                <ItemImage
                  itemId={item.id}
                  itemName={name || item.name}
                  imageUrl={imageUrl}
                  size="lg"
                  editMode={true}
                  onImageUpdate={setImageUrl}
                />
              </div>
            )}

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nome *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Filé Mignon" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Subcategoria *</label>
                <Select value={subcategoryId || ''} onValueChange={handleSubcatChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione a subcategoria" /></SelectTrigger>
                  <SelectContent>
                    {allSubcategories.map(s => {
                      const cat = allCategoryRecords.find(c => c.id === s.category_id);
                      return <SelectItem key={s.id} value={s.id}>{s.name}{cat ? ` (${cat.name})` : ''}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Unidade</label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {category && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Categoria (definida pela subcategoria)</label>
                <div className="px-3 py-2 rounded-md border border-border bg-muted/30 text-sm text-muted-foreground">{category}</div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Estoque Atual</label>
                <Input type="number" value={currentStock} onChange={e => setCurrentStock(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Mínimo</label>
                <Input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Preço da embalagem (R$)</label>
                <Input type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                Qtde por embalagem de compra
                <span className="ml-1 text-xs text-muted-foreground/70">(ex: 5 para "pacote de 5{unit})"</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" step="any" value={purchaseQty}
                  onChange={e => setPurchaseQty(e.target.value)}
                  className="w-32"
                  min="0.001"
                />
                <span className="text-sm text-muted-foreground">{unit} / embalagem</span>
              </div>
              {parseFloat(purchaseQty) > 1 && parseFloat(unitCost) > 0 && (
                <p className="text-xs text-primary mt-1">
                  Custo por {unit} ≈ R$ {fmtNum(parseFloat(unitCost) / parseFloat(purchaseQty))}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Código de Barras</label>
              <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="EAN" />
            </div>
            {item?.id && (
              <>
                <ResponsibleEditor itemId={item.id} allProfiles={allProfiles} allGroups={allGroups} />
                <AliasEditor itemId={item.id} />
                <TagEditor itemId={item.id} />
              </>
            )}
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSubmit} disabled={saving} className="flex-1">{saving ? 'Salvando...' : 'Salvar'}</Button>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
