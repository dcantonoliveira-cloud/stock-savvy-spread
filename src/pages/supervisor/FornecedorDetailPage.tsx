import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  ArrowLeft, Truck, Star, ExternalLink, Pencil, Trash2,
  Plus, Loader2, ChevronsUpDown, Check, Phone, Mail, MapPin, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const fmtCur = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Supplier profile stored in localStorage
type SupplierProfile = { phone: string; email: string; address: string; notes: string };
const PROFILES_KEY = 'supplierProfiles';
function getProfiles(): Record<string, SupplierProfile> {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}'); } catch { return {}; }
}
function saveProfile(name: string, p: SupplierProfile) {
  const all = getProfiles();
  all[name] = p;
  localStorage.setItem(PROFILES_KEY, JSON.stringify(all));
}

type SupplierItem = {
  record_id: string;
  item_id: string;
  item_name: string;
  item_unit: string;
  unit_price: number;
  is_preferred: boolean;
  notes: string | null;
};
type StockItemOption = { id: string; name: string; unit: string };
type ItemFormState = { selectedItemId: string | null; unitPrice: string; isPreferred: boolean; notes: string };
const EMPTY_ITEM_FORM: ItemFormState = { selectedItemId: null, unitPrice: '', isPreferred: false, notes: '' };

export default function FornecedorDetailPage() {
  const { supplierName: encodedName } = useParams<{ supplierName: string }>();
  const navigate = useNavigate();
  const supplierName = decodeURIComponent(encodedName || '');
  const isNew = encodedName === 'novo';

  // Profile
  const [profile, setProfile] = useState<SupplierProfile>({ phone: '', email: '', address: '', notes: '' });
  const [editingProfile, setEditingProfile] = useState(isNew);
  const [profileDraft, setProfileDraft] = useState<SupplierProfile & { name: string }>({ name: supplierName, phone: '', email: '', address: '', notes: '' });

  // Items
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(!isNew);
  const [stockItems, setStockItems] = useState<StockItemOption[]>([]);

  // Item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);
  const [savingItem, setSavingItem] = useState(false);
  const [itemComboOpen, setItemComboOpen] = useState(false);

  useEffect(() => {
    if (!isNew) {
      const saved = getProfiles()[supplierName];
      if (saved) { setProfile(saved); setProfileDraft({ name: supplierName, ...saved }); }
      else { setProfileDraft(d => ({ ...d, name: supplierName })); }
      loadItems();
    }
    loadStockItems();
  }, [supplierName]);

  const loadItems = async () => {
    setLoadingItems(true);
    const { data } = await supabase
      .from('item_suppliers')
      .select('id, item_id, supplier_name, unit_price, is_preferred, notes, stock_items(name, unit)')
      .eq('supplier_name', supplierName)
      .order('item_id');
    setItems(((data || []) as any[]).map(r => ({
      record_id: r.id,
      item_id: r.item_id,
      item_name: r.stock_items?.name || '?',
      item_unit: r.stock_items?.unit || '',
      unit_price: r.unit_price || 0,
      is_preferred: r.is_preferred || false,
      notes: r.notes || null,
    })));
    setLoadingItems(false);
  };

  const loadStockItems = async () => {
    const { data } = await supabase.from('stock_items').select('id, name, unit').order('name');
    setStockItems((data || []) as StockItemOption[]);
  };

  const saveProfileChanges = async () => {
    if (!profileDraft.name.trim()) { toast.error('Nome do fornecedor é obrigatório'); return; }
    const p: SupplierProfile = { phone: profileDraft.phone, email: profileDraft.email, address: profileDraft.address, notes: profileDraft.notes };
    // If name changed, update all item_suppliers records
    if (!isNew && profileDraft.name.trim() !== supplierName) {
      const { error } = await supabase
        .from('item_suppliers')
        .update({ supplier_name: profileDraft.name.trim() } as any)
        .eq('supplier_name', supplierName);
      if (error) { toast.error('Erro ao atualizar nome'); return; }
      saveProfile(profileDraft.name.trim(), p);
      // Remove old profile key
      const all = getProfiles();
      delete all[supplierName];
      localStorage.setItem(PROFILES_KEY, JSON.stringify(all));
      navigate(`/fornecedores/${encodeURIComponent(profileDraft.name.trim())}`, { replace: true });
    } else {
      saveProfile(profileDraft.name.trim(), p);
    }
    setProfile(p);
    setEditingProfile(false);
    toast.success(isNew ? 'Fornecedor criado!' : 'Dados atualizados!');
    if (isNew) navigate(`/fornecedores/${encodeURIComponent(profileDraft.name.trim())}`, { replace: true });
  };

  const openAddItem = () => { setEditingRecordId(null); setItemForm(EMPTY_ITEM_FORM); setItemDialogOpen(true); };
  const openEditItem = (item: SupplierItem) => {
    setEditingRecordId(item.record_id);
    setItemForm({ selectedItemId: item.item_id, unitPrice: String(item.unit_price), isPreferred: item.is_preferred, notes: item.notes || '' });
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.selectedItemId) { toast.error('Selecione um insumo'); return; }
    setSavingItem(true);
    const payload = {
      item_id: itemForm.selectedItemId,
      supplier_name: supplierName,
      unit_price: parseFloat(itemForm.unitPrice) || 0,
      is_preferred: itemForm.isPreferred,
      notes: itemForm.notes.trim() || null,
    };
    const { error } = editingRecordId
      ? await supabase.from('item_suppliers').update(payload as any).eq('id', editingRecordId)
      : await supabase.from('item_suppliers').insert(payload as any);
    if (error) { toast.error('Erro ao salvar'); setSavingItem(false); return; }
    toast.success(editingRecordId ? 'Item atualizado!' : 'Item adicionado!');
    setSavingItem(false);
    setItemDialogOpen(false);
    loadItems();
  };

  const handleDeleteItem = async (recordId: string) => {
    if (!confirm('Remover este item do fornecedor?')) return;
    await supabase.from('item_suppliers').delete().eq('id', recordId);
    toast.success('Item removido');
    loadItems();
  };

  const handleInlinePrice = async (recordId: string, price: number) => {
    await supabase.from('item_suppliers').update({ unit_price: price } as any).eq('id', recordId);
    setItems(prev => prev.map(i => i.record_id === recordId ? { ...i, unit_price: price } : i));
    toast.success('Preço atualizado!');
  };

  const selectedItemLabel = itemForm.selectedItemId
    ? stockItems.find(s => s.id === itemForm.selectedItemId)?.name || 'Selecionar insumo...'
    : 'Selecionar insumo...';

  const displayName = isNew ? (profileDraft.name || 'Novo Fornecedor') : supplierName;

  return (
    <div>
      {/* Back */}
      <button onClick={() => navigate('/fornecedores')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Voltar para Fornecedores
      </button>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Truck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold gold-text">{displayName}</h1>
            {!isNew && (
              <p className="text-muted-foreground text-sm mt-0.5">
                {items.length} item{items.length !== 1 ? 's' : ''} · {items.filter(i => i.is_preferred).length} preferido{items.filter(i => i.is_preferred).length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        {!editingProfile && (
          <Button variant="outline" size="sm" onClick={() => { setProfileDraft({ name: supplierName, ...profile }); setEditingProfile(true); }} className="gap-2 flex-shrink-0">
            <Pencil className="w-3.5 h-3.5" />Editar dados
          </Button>
        )}
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-border p-5 mb-6">
        {editingProfile ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nome *</label>
              <Input value={profileDraft.name} onChange={e => setProfileDraft(d => ({ ...d, name: e.target.value }))} placeholder="Nome do fornecedor" autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Telefone / WhatsApp</label>
              <Input value={profileDraft.phone} onChange={e => setProfileDraft(d => ({ ...d, phone: e.target.value }))} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">E-mail</label>
              <Input value={profileDraft.email} onChange={e => setProfileDraft(d => ({ ...d, email: e.target.value }))} placeholder="contato@fornecedor.com" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Endereço</label>
              <Input value={profileDraft.address} onChange={e => setProfileDraft(d => ({ ...d, address: e.target.value }))} placeholder="Endereço completo" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Observações</label>
              <Input value={profileDraft.notes} onChange={e => setProfileDraft(d => ({ ...d, notes: e.target.value }))} placeholder="Condições de pagamento, prazo de entrega..." />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button onClick={saveProfileChanges} className="gap-2">Salvar dados</Button>
              {!isNew && <Button variant="outline" onClick={() => setEditingProfile(false)}>Cancelar</Button>}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{profile.phone}</span>
              </div>
            )}
            {profile.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{profile.email}</span>
              </div>
            )}
            {profile.address && (
              <div className="flex items-center gap-2.5 text-sm sm:col-span-2">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{profile.address}</span>
              </div>
            )}
            {profile.notes && (
              <div className="flex items-start gap-2.5 text-sm sm:col-span-2">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{profile.notes}</span>
              </div>
            )}
            {!profile.phone && !profile.email && !profile.address && !profile.notes && (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Nenhum dado de contato cadastrado.{' '}
                <button className="text-primary underline" onClick={() => { setProfileDraft({ name: supplierName, ...profile }); setEditingProfile(true); }}>
                  Adicionar agora
                </button>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Items section */}
      {!isNew && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Produtos</h2>
            <Button size="sm" variant="outline" onClick={openAddItem} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />Adicionar produto
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">INSUMO</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">PREÇO UNIT.</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">PREFERIDO</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">OBSERVAÇÕES</th>
                  <th className="w-28 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loadingItems ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {[50, 20, 10, 30, 15].map((w, j) => (
                        <td key={j} className="px-5 py-3">
                          <div className="h-4 bg-muted/40 rounded animate-pulse" style={{ width: `${w}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      Nenhum produto cadastrado para este fornecedor.
                    </td>
                  </tr>
                ) : items.map(item => (
                  <tr key={item.record_id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-medium text-foreground">{item.item_name}</span>
                      <span className="text-muted-foreground text-xs ml-1.5">({item.item_unit})</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={item.unit_price}
                          onBlur={e => {
                            const v = parseFloat(e.target.value) || 0;
                            if (v !== item.unit_price) handleInlinePrice(item.record_id, v);
                          }}
                          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                          className="w-24 text-right text-sm font-medium border border-transparent rounded px-1.5 py-0.5 hover:border-border focus:border-primary focus:outline-none bg-transparent focus:bg-white transition-all"
                          title="Clique para editar o preço"
                        />
                        <span className="text-xs text-muted-foreground">/{item.item_unit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.is_preferred
                        ? <Star className="w-4 h-4 text-amber-500 fill-amber-400 mx-auto" />
                        : <span className="text-muted-foreground/30 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {item.notes || <span className="opacity-30">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="w-7 h-7" title="Ver insumo"
                          onClick={() => navigate(`/items/${item.item_id}`)}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7" title="Editar"
                          onClick={() => openEditItem(item)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive/60 hover:text-destructive"
                          title="Remover" onClick={() => handleDeleteItem(item.record_id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={o => { if (!o) setItemDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRecordId ? 'Editar produto' : 'Adicionar produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Insumo *</label>
              <Popover open={itemComboOpen} onOpenChange={setItemComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-sm">
                    <span className={cn('truncate', !itemForm.selectedItemId && 'text-muted-foreground')}>
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
                          <CommandItem key={si.id} value={si.name}
                            onSelect={() => { setItemForm(f => ({ ...f, selectedItemId: si.id })); setItemComboOpen(false); }}>
                            <Check className={cn('mr-2 h-4 w-4', itemForm.selectedItemId === si.id ? 'opacity-100' : 'opacity-0')} />
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
              <Input type="number" step="0.01" value={itemForm.unitPrice}
                onChange={e => setItemForm(f => ({ ...f, unitPrice: e.target.value }))} placeholder="0,00" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Observações</label>
              <Input value={itemForm.notes}
                onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="item-preferred" checked={itemForm.isPreferred}
                onChange={e => setItemForm(f => ({ ...f, isPreferred: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="item-preferred" className="text-sm text-foreground cursor-pointer">
                Fornecedor preferido para este insumo
              </label>
            </div>
            <Button className="w-full" onClick={handleSaveItem} disabled={savingItem}>
              {savingItem && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingRecordId ? 'Salvar alterações' : 'Adicionar produto'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
