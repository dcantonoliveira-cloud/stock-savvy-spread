import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Eye, X } from 'lucide-react';
import { toast } from 'sonner';

type Item = { id: string; name: string; unit: string };
type SheetItem = { item_id: string; item_name: string; quantity: number; unit: string };
type Sheet = { id: string; name: string; servings: number; items: SheetItem[] };

export default function SupervisorSheetsPage() {
  const [stockItems, setStockItems] = useState<Item[]>([]);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingSheet, setViewingSheet] = useState<Sheet | null>(null);

  const [name, setName] = useState('');
  const [servings, setServings] = useState('100');
  const [formItems, setFormItems] = useState<SheetItem[]>([]);

  const load = async () => {
    const [itemsRes, sheetsRes] = await Promise.all([
      supabase.from('stock_items').select('id, name, unit').order('name'),
      supabase.from('technical_sheets').select('*').order('name'),
    ]);
    if (itemsRes.data) setStockItems(itemsRes.data);
    if (sheetsRes.data) {
      const sheetsWithItems = await Promise.all(
        sheetsRes.data.map(async s => {
          const { data: si } = await supabase.from('technical_sheet_items').select('item_id, quantity').eq('sheet_id', s.id);
          const sheetItems: SheetItem[] = (si || []).map(i => {
            const item = itemsRes.data?.find(x => x.id === i.item_id);
            return { item_id: i.item_id, item_name: item?.name || '?', quantity: i.quantity, unit: item?.unit || '' };
          });
          return { ...s, items: sheetItems };
        })
      );
      setSheets(sheetsWithItems);
    }
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => { setName(''); setServings('100'); setFormItems([]); };

  const addItem = () => setFormItems([...formItems, { item_id: '', item_name: '', quantity: 0, unit: '' }]);

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...formItems];
    if (field === 'item_id') {
      const si = stockItems.find(s => s.id === value);
      updated[idx] = { ...updated[idx], item_id: value, item_name: si?.name || '', unit: si?.unit || '' };
    } else {
      (updated[idx] as any)[field] = value;
    }
    setFormItems(updated);
  };

  const removeItem = (idx: number) => setFormItems(formItems.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    const validItems = formItems.filter(i => i.item_id);
    if (validItems.length === 0) { toast.error('Adicione pelo menos um item'); return; }

    const { data: sheet, error } = await supabase.from('technical_sheets').insert({
      name: name.trim(),
      servings: parseInt(servings) || 100,
    }).select().single();

    if (error || !sheet) { toast.error('Erro ao criar ficha'); return; }

    await supabase.from('technical_sheet_items').insert(
      validItems.map(i => ({ sheet_id: sheet.id, item_id: i.item_id, quantity: i.quantity }))
    );

    toast.success('Ficha técnica criada!');
    resetForm();
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('technical_sheets').delete().eq('id', id);
    toast.success('Ficha removida!');
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Fichas Técnicas</h1>
          <p className="text-muted-foreground mt-1">Defina o consumo esperado por evento</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Ficha</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Ficha Técnica</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Nome da Ficha</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Cardápio Casamento Premium" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Quantidade de Pessoas</label>
                <Input type="number" value={servings} onChange={e => setServings(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-muted-foreground">Itens</label>
                  <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
                </div>
                {formItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center mb-2">
                    <Select value={item.item_id} onValueChange={v => updateItem(idx, 'item_id', v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Item" /></SelectTrigger>
                      <SelectContent>
                        {stockItems.map(si => <SelectItem key={si.id} value={si.id}>{si.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" className="w-24" placeholder="Qtd" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                    <span className="text-xs text-muted-foreground w-10">{item.unit}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><X className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {viewingSheet && (
        <div className="glass-card rounded-xl p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">{viewingSheet.name}</h3>
            <Button variant="ghost" size="icon" onClick={() => setViewingSheet(null)}><X className="w-4 h-4" /></Button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Para {viewingSheet.servings} pessoas</p>
          <div className="space-y-2">
            {viewingSheet.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm p-2 rounded bg-secondary/50">
                <span className="text-foreground">{item.item_name}</span>
                <span className="text-muted-foreground">{item.quantity} {item.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sheets.map(sheet => (
          <div key={sheet.id} className="glass-card rounded-xl p-4 flex items-center justify-between animate-fade-in">
            <div>
              <p className="font-medium text-foreground">{sheet.name}</p>
              <p className="text-xs text-muted-foreground">{sheet.servings} pessoas · {sheet.items.length} itens</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setViewingSheet(sheet)}><Eye className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(sheet.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {sheets.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">Nenhuma ficha técnica cadastrada.</div>
        )}
      </div>
    </div>
  );
}
