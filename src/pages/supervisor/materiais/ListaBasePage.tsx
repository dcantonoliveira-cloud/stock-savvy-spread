import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Package, BookMarked, Save } from 'lucide-react';
import { toast } from 'sonner';

type MaterialItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  total_qty: number;
  image_url: string | null;
};

export default function ListaBasePage() {
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
  const [baseQty, setBaseQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [itemsRes, baseRes] = await Promise.all([
      supabase.from('material_items' as any)
        .select('id, name, category, unit, total_qty, image_url')
        .order('category').order('name'),
      supabase.from('material_base_list' as any).select('material_item_id, qty'),
    ]);
    if (itemsRes.data) setMaterialItems(itemsRes.data as MaterialItem[]);
    const qty: Record<string, number> = {};
    for (const b of (baseRes.data || []) as any[]) {
      qty[b.material_item_id] = b.qty;
    }
    setBaseQty(qty);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all and re-insert
      await supabase.from('material_base_list' as any).delete().not('id', 'is', null);

      const toInsert = Object.entries(baseQty)
        .filter(([, q]) => q > 0)
        .map(([material_item_id, qty]) => ({ material_item_id, qty }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('material_base_list' as any).insert(toInsert);
        if (error) throw error;
      }

      toast.success('Lista base salva! Novos eventos começarão com esses materiais pré-preenchidos.');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'Tente novamente'));
    }
    setSaving(false);
  };

  const categories = Array.from(new Set(materialItems.map(i => i.category))).sort();
  const totalSelected = Object.values(baseQty).filter(q => q > 0).length;

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
            <BookMarked className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold gold-text">Lista Base</h1>
            <p className="text-muted-foreground mt-0.5">Materiais mínimos que acompanham todos os eventos</p>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <p className="font-semibold mb-1">💡 Como funciona</p>
        <p>Defina aqui a quantidade mínima de cada material que precisa ir a <strong>todos</strong> os eventos. Ao criar uma nova lista de materiais para um evento, esses itens já estarão pré-preenchidos como ponto de partida — o responsável pode ajustar conforme necessário.</p>
      </div>

      {/* Summary + Save bar */}
      <div className="bg-white rounded-xl border border-border p-4 mb-6 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookMarked className="w-4 h-4 text-primary" />
          <span>
            {totalSelected === 0
              ? 'Nenhum item na lista base ainda'
              : `${totalSelected} tipo${totalSelected !== 1 ? 's' : ''} de material na lista base`}
          </span>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gold-button">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Lista Base
        </Button>
      </div>

      {/* Materials by category */}
      {materialItems.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum material cadastrado</p>
          <p className="text-sm mt-1">Cadastre itens em Materiais → Inventário primeiro</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map(cat => {
            const catItems = materialItems.filter(i => i.category === cat);
            const catSelected = catItems.filter(i => (baseQty[i.id] || 0) > 0).length;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    📦 {cat}
                  </h3>
                  {catSelected > 0 && (
                    <span className="text-xs text-primary font-medium">
                      {catSelected} selecionado{catSelected !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-full">Material</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Total</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap w-32">Qtde Base</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {catItems.map(item => {
                        const qty = baseQty[item.id] || 0;
                        const isSelected = qty > 0;
                        return (
                          <tr key={item.id} className={`transition-colors ${isSelected ? 'bg-amber-50/40' : 'hover:bg-muted/10'}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.name}
                                    className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                                    <Package className="w-4 h-4 text-muted-foreground/40" />
                                  </div>
                                )}
                                <span className={`font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {item.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap text-muted-foreground">
                              {item.total_qty} <span className="text-xs">{item.unit}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <Input
                                type="number"
                                min={0}
                                value={qty === 0 ? '' : qty}
                                placeholder="0"
                                className={`w-20 text-center h-8 text-sm mx-auto ${isSelected ? 'border-primary/50 bg-white' : ''}`}
                                onChange={e => {
                                  const v = Math.max(0, Number(e.target.value) || 0);
                                  setBaseQty(prev => {
                                    const next = { ...prev };
                                    if (v === 0) delete next[item.id];
                                    else next[item.id] = v;
                                    return next;
                                  });
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <div className="flex justify-end pt-2 pb-6">
            <Button onClick={handleSave} disabled={saving} className="gold-button">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Lista Base
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
