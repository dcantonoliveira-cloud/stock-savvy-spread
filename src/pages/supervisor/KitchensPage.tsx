import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Plus, Pencil, Trash2, Lock, Loader2, ChevronRight, Package } from 'lucide-react';
import { toast } from 'sonner';

type Kitchen = { id: string; name: string; is_default: boolean };
type Location = { id: string; item_id: string; kitchen_id: string; current_stock: number };

export default function KitchensPage() {
  const navigate = useNavigate();
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Kitchen | null>(null);
  const [kitchenName, setKitchenName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [k, l] = await Promise.all([
      supabase.from('kitchens').select('id, name, is_default').order('name'),
      supabase.from('stock_item_locations').select('id, item_id, kitchen_id, current_stock'),
    ]);
    if (k.data) setKitchens(k.data as Kitchen[]);
    if (l.data) setLocations(l.data as Location[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const name = kitchenName.trim();
    if (!name) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('kitchens').update({ name } as any).eq('id', editing.id);
      if (error) { toast.error('Erro ao atualizar'); setSaving(false); return; }
      toast.success('Centro atualizado!');
    } else {
      const { error } = await supabase.from('kitchens').insert({ name } as any);
      if (error) { toast.error('Erro ao criar'); setSaving(false); return; }
      toast.success('Centro criado!');
    }
    setSaving(false);
    setDialog(false);
    setEditing(null);
    setKitchenName('');
    load();
  };

  const handleDelete = async (kitchen: Kitchen) => {
    if (kitchen.is_default) { toast.error('O Estoque Geral não pode ser removido'); return; }
    const hasStock = locations.some(l => l.kitchen_id === kitchen.id && l.current_stock > 0);
    if (hasStock) { toast.error('Transfira todo o estoque antes de remover'); return; }
    const { error } = await supabase.from('kitchens').delete().eq('id', kitchen.id);
    if (error) { toast.error('Erro ao remover'); return; }
    toast.success('Centro removido!');
    load();
  };

  const getStats = (kitchenId: string) => {
    const locs = locations.filter(l => l.kitchen_id === kitchenId && l.current_stock > 0);
    return { itemCount: locs.length, totalUnits: locs.reduce((s, l) => s + l.current_stock, 0) };
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Centros de Custo</h1>
          <p className="text-muted-foreground mt-1">{kitchens.length} centros cadastrados</p>
        </div>
        <Button onClick={() => { setEditing(null); setKitchenName(''); setDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" />Novo Centro
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
              <th className="text-left px-5 py-3">Centro de Custo</th>
              <th className="text-right px-4 py-3">Itens em estoque</th>
              <th className="text-right px-4 py-3">Total de unidades</th>
              <th className="w-24 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
              </td></tr>
            ) : kitchens.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">
                <Building2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
                Nenhum centro cadastrado
              </td></tr>
            ) : kitchens.map(kitchen => {
              const { itemCount, totalUnits } = getStats(kitchen.id);
              return (
                <tr
                  key={kitchen.id}
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/kitchens/${kitchen.id}`)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${kitchen.is_default ? 'bg-primary/20' : 'bg-primary/10'}`}>
                        {kitchen.is_default ? <Package className="w-4 h-4 text-primary" /> : <Building2 className="w-4 h-4 text-primary" />}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{kitchen.name}</p>
                        {kitchen.is_default && <p className="text-xs text-muted-foreground">Estoque principal</p>}
                      </div>
                      {kitchen.is_default && <Lock className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-medium">{itemCount}</td>
                  <td className="px-4 py-4 text-right text-muted-foreground">
                    {totalUnits.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {!kitchen.is_default && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(kitchen); setKitchenName(kitchen.name); setDialog(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(kitchen)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={o => { setDialog(o); if (!o) { setEditing(null); setKitchenName(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={kitchenName}
              onChange={e => setKitchenName(e.target.value)}
              placeholder="Ex: Cozinha 1, Bar, Confeitaria..."
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            />
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editing ? 'Salvar' : 'Criar'}
              </Button>
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
