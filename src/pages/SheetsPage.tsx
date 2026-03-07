import { useEffect, useState } from 'react';
import { getItems, getSheets, saveSheet, deleteSheet } from '@/lib/storage';
import { StockItem, TechnicalSheet, TechnicalSheetItem, UNITS } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Eye, X } from 'lucide-react';
import { toast } from 'sonner';

function SheetForm({ stockItems, sheet, onSave, onCancel }: { stockItems: StockItem[]; sheet?: TechnicalSheet; onSave: (s: TechnicalSheet) => void; onCancel: () => void }) {
  const [name, setName] = useState(sheet?.name || '');
  const [servings, setServings] = useState(sheet?.servings?.toString() || '100');
  const [items, setItems] = useState<TechnicalSheetItem[]>(sheet?.items || []);

  const addItem = () => {
    setItems([...items, { itemId: '', itemName: '', quantity: 0, unit: '' }]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    if (field === 'itemId') {
      const si = stockItems.find(s => s.id === value);
      updated[idx] = { ...updated[idx], itemId: value, itemName: si?.name || '', unit: si?.unit || '' };
    } else {
      (updated[idx] as any)[field] = value;
    }
    setItems(updated);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (items.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    onSave({
      id: sheet?.id || crypto.randomUUID(),
      name: name.trim(),
      servings: parseInt(servings) || 100,
      items: items.filter(i => i.itemId),
      createdAt: sheet?.createdAt || new Date().toISOString(),
    });
  };

  return (
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
          <label className="text-sm text-muted-foreground">Itens da Ficha</label>
          <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Select value={item.itemId} onValueChange={v => updateItem(idx, 'itemId', v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Item" /></SelectTrigger>
                <SelectContent>
                  {stockItems.map(si => <SelectItem key={si.id} value={si.id}>{si.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="w-24"
                placeholder="Qtd"
                value={item.quantity || ''}
                onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
              />
              <span className="text-xs text-muted-foreground w-10">{item.unit}</span>
              <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={handleSubmit} className="flex-1">Salvar</Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

export default function SheetsPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [sheets, setSheets] = useState<TechnicalSheet[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<TechnicalSheet | undefined>();
  const [viewingSheet, setViewingSheet] = useState<TechnicalSheet | undefined>();

  const reload = () => {
    setStockItems(getItems());
    setSheets(getSheets());
  };
  useEffect(reload, []);

  const handleSave = (sheet: TechnicalSheet) => {
    saveSheet(sheet);
    reload();
    setDialogOpen(false);
    setEditingSheet(undefined);
    toast.success('Ficha técnica salva!');
  };

  const handleDelete = (id: string) => {
    deleteSheet(id);
    reload();
    toast.success('Ficha removida!');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Fichas Técnicas</h1>
          <p className="text-muted-foreground mt-1">Defina o consumo esperado por evento</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditingSheet(undefined); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nova Ficha</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingSheet ? 'Editar Ficha' : 'Nova Ficha Técnica'}</DialogTitle>
            </DialogHeader>
            <SheetForm stockItems={stockItems} sheet={editingSheet} onSave={handleSave} onCancel={() => { setDialogOpen(false); setEditingSheet(undefined); }} />
          </DialogContent>
        </Dialog>
      </div>

      {viewingSheet && (
        <div className="glass-card rounded-xl p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">{viewingSheet.name}</h3>
            <Button variant="ghost" size="icon" onClick={() => setViewingSheet(undefined)}><X className="w-4 h-4" /></Button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Para {viewingSheet.servings} pessoas</p>
          <div className="space-y-2">
            {viewingSheet.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm p-2 rounded bg-secondary/50">
                <span className="text-foreground">{item.itemName}</span>
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
              <Button variant="ghost" size="icon" onClick={() => setViewingSheet(sheet)}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setEditingSheet(sheet); setDialogOpen(true); }}>
                <Plus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(sheet.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
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
