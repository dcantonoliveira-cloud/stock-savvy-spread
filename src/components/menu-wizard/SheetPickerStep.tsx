import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search, Pencil, Copy, Plus, ArrowUpDown, X, Loader2, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import SheetFormModal from '@/components/SheetFormModal';

type Sheet = { id: string; name: string; category: string | null };

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default function SheetPickerStep({ menuId, onContinue }: { menuId: string; onContinue: () => void }) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [selected, setSelected] = useState<Map<string, string>>(new Map()); // sheet_id -> event_menu_dishes.id
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedPopupOpen, setSelectedPopupOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [formSheetId, setFormSheetId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [sheetsRes, dishesRes] = await Promise.all([
      supabase.from('technical_sheets').select('id, name, category').order('name'),
      (supabase.from('event_menu_dishes') as any).select('id, sheet_id').eq('menu_id', menuId),
    ]);
    if (sheetsRes.data) setSheets(sheetsRes.data as Sheet[]);
    if (dishesRes.data) {
      setSelected(new Map((dishesRes.data as any[]).map(d => [d.sheet_id, d.id])));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [menuId]);

  const toggle = async (sheet: Sheet) => {
    const existingRowId = selected.get(sheet.id);
    if (existingRowId) {
      await supabase.from('event_menu_dishes').delete().eq('id', existingRowId);
      setSelected(prev => { const next = new Map(prev); next.delete(sheet.id); return next; });
    } else {
      const { data, error } = await (supabase.from('event_menu_dishes') as any)
        .insert({ menu_id: menuId, sheet_id: sheet.id, planned_quantity: 0, planned_unit: 'un' })
        .select('id').single();
      if (error) { toast.error('Erro ao selecionar prato'); return; }
      setSelected(prev => new Map(prev).set(sheet.id, data.id));
    }
  };

  const removeFromPopup = async (sheetId: string) => {
    const rowId = selected.get(sheetId);
    if (!rowId) return;
    await supabase.from('event_menu_dishes').delete().eq('id', rowId);
    setSelected(prev => { const next = new Map(prev); next.delete(sheetId); return next; });
  };

  const filtered = sheets
    .filter(s => !search.trim() || normalize(s.name).includes(normalize(search)))
    .sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name, 'pt-BR') : b.name.localeCompare(a.name, 'pt-BR'));

  const selectedSheets = sheets.filter(s => selected.has(s.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const openEdit = (sheetId: string) => { setFormMode('edit'); setFormSheetId(sheetId); setFormOpen(true); };
  const openDuplicate = (sheetId: string) => { setFormMode('duplicate'); setFormSheetId(sheetId); setFormOpen(true); };
  const openCreate = () => { setFormMode('create'); setFormSheetId(null); setFormOpen(true); };

  const onSheetSaved = (sheet: { id: string; name: string; category: string | null }) => {
    setSheets(prev => {
      const exists = prev.some(s => s.id === sheet.id);
      const next = exists ? prev.map(s => s.id === sheet.id ? sheet : s) : [...prev, sheet];
      return next;
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar prato..." className="pl-9" />
        </div>
        <Button variant="outline" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          <ArrowUpDown className="w-4 h-4 mr-2" />{sortDir === 'asc' ? 'A → Z' : 'Z → A'}
        </Button>
        <Button variant="outline" onClick={() => setSelectedPopupOpen(true)}>
          <ListChecks className="w-4 h-4 mr-2" />Ver selecionados ({selected.size})
        </Button>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nova ficha técnica</Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-white">
        <div className="divide-y divide-border/50 max-h-[55vh] overflow-y-auto">
          {filtered.map(sheet => {
            const isSelected = selected.has(sheet.id);
            return (
              <div key={sheet.id} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(sheet)}
                  className="w-4 h-4 rounded flex-shrink-0 cursor-pointer"
                />
                <span className="flex-1 text-sm font-medium text-foreground truncate cursor-pointer" onClick={() => toggle(sheet)}>{sheet.name}</span>
                {sheet.category && <Badge variant="outline" className="text-[10px] flex-shrink-0">{sheet.category}</Badge>}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="w-7 h-7" title="Ver/editar receita" onClick={() => openEdit(sheet.id)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7" title="Duplicar" onClick={() => openDuplicate(sheet.id)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma ficha técnica encontrada.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button size="lg" disabled={selected.size === 0} onClick={onContinue}>
          Continuar ({selected.size} {selected.size === 1 ? 'prato' : 'pratos'})
        </Button>
      </div>

      {/* Popup: selecionados em ordem alfabética */}
      <Dialog open={selectedPopupOpen} onOpenChange={setSelectedPopupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pratos selecionados</DialogTitle>
            <DialogDescription>{selectedSheets.length} prato{selectedSheets.length !== 1 ? 's' : ''}, em ordem alfabética</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-border/50">
            {selectedSheets.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-foreground">{s.name}</span>
                <button onClick={() => removeFromPopup(s.id)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {selectedSheets.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nada selecionado ainda.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <SheetFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={onSheetSaved}
        sheetId={formSheetId}
        mode={formMode}
      />
    </div>
  );
}
