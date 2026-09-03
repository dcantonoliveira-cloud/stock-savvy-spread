import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, ShoppingCart, Printer, FileDown, Camera, Sheet as SheetIcon, ChevronDown } from 'lucide-react';
import { convertToItemUnit } from '@/lib/units';
import { fmtNum, fmtCur } from '@/lib/format';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

type Tag = { id: string; name: string; color: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Filtro multi-seleção (dropdown com checkboxes) ───
function MultiSelectFilter({ label, options, selected, onChange }: {
  label: string; options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);

  const displayLabel = selected.length === 0
    ? label
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label ?? label)
      : `${selected.length} selecionados`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`h-9 px-3 text-sm border rounded-lg bg-white flex items-center gap-1.5 whitespace-nowrap ${selected.length > 0 ? 'border-primary/50 text-primary font-medium' : 'border-border text-foreground'}`}
      >
        {displayLabel} <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-h-64 overflow-y-auto">
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-muted/60 border-b border-border mb-1">
              Limpar seleção
            </button>
          )}
          {options.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma opção</p>}
          {options.map(o => (
            <label key={o.value} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/60 cursor-pointer">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

type Row = {
  itemId: string; name: string; unit: string; needed: number; inStock: number; toBuy: number; unitCost: number;
  category: string; subcategoryId: string | null; subcategoryName: string;
  responsibleNames: string[]; supplierNames: string[]; tags: Tag[];
};

export default function ShoppingListView({ menuIds, title, onBack }: { menuIds: string[]; title: string; onBack?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number | string>>({});

  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [subcategoryFilters, setSubcategoryFilters] = useState<string[]>([]);
  const [responsibleFilters, setResponsibleFilters] = useState<string[]>([]);
  const [supplierFilters, setSupplierFilters] = useState<string[]>([]);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [onlyToBuy, setOnlyToBuy] = useState(false);

  const [exporting, setExporting] = useState<'pdf' | 'image' | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuIds.length === 0) { setRows([]); setLoading(false); return; }
    const build = async () => {
      setLoading(true);

      const { data: dishData } = await (supabase.from('event_menu_dishes') as any)
        .select('id, sheet_id, planned_quantity')
        .in('menu_id', menuIds);
      const dishes = (dishData || []) as { id: string; sheet_id: string; planned_quantity: number }[];

      if (dishes.length === 0) { setRows([]); setLoading(false); return; }

      const sheetIds = [...new Set(dishes.map(d => d.sheet_id))];
      const dishIds = dishes.map(d => d.id);
      const [sheetsRes, itemsRes, overridesRes] = await Promise.all([
        supabase.from('technical_sheets').select('id, yield_quantity').in('id', sheetIds),
        (supabase.from('technical_sheet_items') as any).select('sheet_id, item_id, quantity, unit').in('sheet_id', sheetIds),
        (supabase.from('event_menu_dish_items') as any).select('menu_dish_id, item_id, override_quantity').in('menu_dish_id', dishIds),
      ]);
      const yieldBySheet: Record<string, number> = {};
      for (const s of (sheetsRes.data || []) as any[]) yieldBySheet[s.id] = s.yield_quantity || 1;

      const overrideByDishItem: Record<string, number> = {};
      for (const o of (overridesRes.data || []) as any[]) {
        if (o.override_quantity != null) overrideByDishItem[`${o.menu_dish_id}:${o.item_id}`] = o.override_quantity;
      }

      const sheetItems = (itemsRes.data || []) as { sheet_id: string; item_id: string; quantity: number; unit: string }[];
      const itemIds = [...new Set(sheetItems.map(i => i.item_id))];

      const [stockRes, subcatsRes, respRes, suppliersRes, profilesRes, groupsRes, itemTagsRes] = await Promise.all([
        itemIds.length ? (supabase.from('stock_items') as any).select('id, name, unit, current_stock, category, subcategory_id, unit_cost, purchase_qty').in('id', itemIds) : Promise.resolve({ data: [] }),
        supabase.from('subcategories').select('id, name'),
        itemIds.length ? (supabase.from('stock_item_responsibles') as any).select('item_id, user_id, group_id').in('item_id', itemIds) : Promise.resolve({ data: [] }),
        itemIds.length ? (supabase.from('item_suppliers') as any).select('item_id, supplier_name').in('item_id', itemIds) : Promise.resolve({ data: [] }),
        supabase.from('profiles').select('user_id, display_name'),
        (supabase.from('inventory_groups') as any).select('id, name'),
        itemIds.length ? (supabase.from('stock_item_tags') as any).select('item_id, tags:tag_id(id, name, color)').in('item_id', itemIds) : Promise.resolve({ data: [] }),
      ]);

      const stockById: Record<string, { name: string; unit: string; current_stock: number; category: string; subcategory_id: string | null; unit_cost: number; purchase_qty: number | null }> = {};
      for (const s of (stockRes.data || []) as any[]) stockById[s.id] = s;

      const subcatNameById: Record<string, string> = {};
      for (const s of (subcatsRes.data || []) as any[]) subcatNameById[s.id] = s.name;

      const profileNameById: Record<string, string> = {};
      for (const p of (profilesRes.data || []) as any[]) profileNameById[p.user_id] = p.display_name;
      const groupNameById: Record<string, string> = {};
      for (const g of (groupsRes.data || []) as any[]) groupNameById[g.id] = g.name;

      const responsiblesByItem: Record<string, string[]> = {};
      for (const r of (respRes.data || []) as any[]) {
        const name = r.user_id ? profileNameById[r.user_id] : (r.group_id ? `👥 ${groupNameById[r.group_id]}` : null);
        if (!name) continue;
        if (!responsiblesByItem[r.item_id]) responsiblesByItem[r.item_id] = [];
        responsiblesByItem[r.item_id].push(name);
      }

      const suppliersByItem: Record<string, string[]> = {};
      for (const s of (suppliersRes.data || []) as any[]) {
        if (!suppliersByItem[s.item_id]) suppliersByItem[s.item_id] = [];
        suppliersByItem[s.item_id].push(s.supplier_name);
      }

      const tagsByItem: Record<string, Tag[]> = {};
      for (const t of (itemTagsRes.data || []) as any[]) {
        if (!t.tags) continue;
        if (!tagsByItem[t.item_id]) tagsByItem[t.item_id] = [];
        tagsByItem[t.item_id].push(t.tags);
      }

      const neededByItem: Record<string, number> = {};
      for (const dish of dishes) {
        const yieldQty = yieldBySheet[dish.sheet_id] || 1;
        const factor = (dish.planned_quantity || 0) / yieldQty;
        for (const si of sheetItems.filter(i => i.sheet_id === dish.sheet_id)) {
          const stock = stockById[si.item_id];
          if (!stock) continue;
          const overrideKey = `${dish.id}:${si.item_id}`;
          const recipeQty = overrideKey in overrideByDishItem ? overrideByDishItem[overrideKey] : si.quantity * factor;
          if (recipeQty === 0) continue;
          const neededInItemUnit = convertToItemUnit(recipeQty, si.unit || stock.unit, stock.unit);
          neededByItem[si.item_id] = (neededByItem[si.item_id] || 0) + neededInItemUnit;
        }
      }

      const built: Row[] = Object.entries(neededByItem).map(([itemId, needed]) => {
        const stock = stockById[itemId];
        const inStock = stock?.current_stock || 0;
        const effUnitCost = (stock?.unit_cost || 0) / Math.max(1, stock?.purchase_qty || 1);
        return {
          itemId, name: stock?.name || '?', unit: stock?.unit || '',
          needed, inStock, toBuy: Math.max(0, needed - inStock), unitCost: effUnitCost,
          category: stock?.category || 'Sem categoria',
          subcategoryId: stock?.subcategory_id || null,
          subcategoryName: stock?.subcategory_id ? (subcatNameById[stock.subcategory_id] || '') : '',
          responsibleNames: responsiblesByItem[itemId] || [],
          supplierNames: suppliersByItem[itemId] || [],
          tags: tagsByItem[itemId] || [],
        };
      }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      setRows(built);
      setQtyOverrides({});
      setLoading(false);
    };
    build();
  }, [JSON.stringify(menuIds)]);

  const getEffectiveQty = (r: Row) => {
    const ov = qtyOverrides[r.itemId];
    if (ov !== undefined && ov !== '') return parseFloat(String(ov)) || 0;
    return r.toBuy;
  };

  const categories = Array.from(new Set(rows.map(r => r.category))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const subcategories = Array.from(new Set(
    rows.filter(r => categoryFilters.length === 0 || categoryFilters.includes(r.category)).map(r => r.subcategoryName).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const responsibles = Array.from(new Set(rows.flatMap(r => r.responsibleNames))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const suppliers = Array.from(new Set(rows.flatMap(r => r.supplierNames))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const tagsById: Record<string, Tag> = {};
  for (const r of rows) for (const t of r.tags) tagsById[t.id] = t;
  const allTags = Object.values(tagsById).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const filteredRows = rows.filter(r => {
    if (categoryFilters.length > 0 && !categoryFilters.includes(r.category)) return false;
    if (subcategoryFilters.length > 0 && !subcategoryFilters.includes(r.subcategoryName)) return false;
    if (responsibleFilters.length > 0 && !r.responsibleNames.some(n => responsibleFilters.includes(n))) return false;
    if (supplierFilters.length > 0 && !r.supplierNames.some(n => supplierFilters.includes(n))) return false;
    if (tagFilters.length > 0 && !r.tags.some(t => tagFilters.includes(t.id))) return false;
    if (onlyToBuy && getEffectiveQty(r) <= 0) return false;
    return true;
  });

  const totalCost = filteredRows.reduce((s, r) => s + getEffectiveQty(r) * r.unitCost, 0);
  const itemsInStockCount = filteredRows.filter(r => getEffectiveQty(r) <= 0).length;
  const itemsToBuyCount = filteredRows.filter(r => getEffectiveQty(r) > 0).length;
  const totalListValue = filteredRows.reduce((s, r) => s + r.needed * r.unitCost, 0);
  const stockDeductionValue = filteredRows.reduce((s, r) => s + Math.min(r.needed, r.inStock) * r.unitCost, 0);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const rowsHtml = filteredRows.map(r => {
      const eff = getEffectiveQty(r);
      return `<tr>
      <td>${r.name}</td><td>${r.category}${r.subcategoryName ? ' / ' + r.subcategoryName : ''}</td>
      <td class="right">${fmtNum(r.needed)} ${r.unit}</td>
      <td class="right">${fmtNum(r.inStock)} ${r.unit}</td>
      <td class="right ${eff > 0 ? 'buy' : ''}">${eff > 0 ? fmtNum(eff) + ' ' + r.unit : 'OK'}</td>
    </tr>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#222}
        h2{margin:0 0 4px}p{margin:0 0 16px;color:#666;font-size:11px}
        table{width:100%;border-collapse:collapse}
        th{background:#f5f5f5;text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase}
        td{padding:5px 8px;border-bottom:1px solid #eee}
        .right{text-align:right}.buy{font-weight:bold;color:#b45309}
        @media print{body{margin:10px}}
      </style></head><body>
      <h2>Lista de Compras</h2><p>${title} · ${filteredRows.length} itens</p>
      <table><thead><tr><th>Insumo</th><th>Categoria</th><th class="right">Necessário</th><th class="right">Em estoque</th><th class="right">A comprar</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      </body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const handleGeneratePdf = () => {
    setExporting('pdf');
    try {
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const marginX = 40;
      let y = 50;
      pdf.setFontSize(16);
      pdf.text('Lista de Compras', marginX, y);
      y += 18;
      pdf.setFontSize(10);
      pdf.setTextColor(120);
      pdf.text(`${title} · ${filteredRows.length} itens`, marginX, y);
      pdf.setTextColor(0);
      y += 24;

      const colX = [marginX, marginX + 210, marginX + 320, marginX + 400, marginX + 470];
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text('INSUMO', colX[0], y);
      pdf.text('CATEGORIA', colX[1], y);
      pdf.text('NECESSÁRIO', colX[2], y);
      pdf.text('ESTOQUE', colX[3], y);
      pdf.text('A COMPRAR', colX[4], y);
      y += 6;
      pdf.setLineWidth(0.5);
      pdf.line(marginX, y, 555, y);
      y += 12;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);

      filteredRows.forEach(r => {
        if (y > 780) { pdf.addPage(); y = 50; }
        const eff = getEffectiveQty(r);
        pdf.text(r.name.slice(0, 32), colX[0], y);
        pdf.text((r.category + (r.subcategoryName ? '/' + r.subcategoryName : '')).slice(0, 20), colX[1], y);
        pdf.text(`${fmtNum(r.needed)} ${r.unit}`, colX[2], y);
        pdf.text(`${fmtNum(r.inStock)} ${r.unit}`, colX[3], y);
        if (eff > 0) {
          pdf.setTextColor(180, 83, 9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${fmtNum(eff)} ${r.unit}`, colX[4], y);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0);
        } else {
          pdf.text('OK', colX[4], y);
        }
        y += 15;
      });

      pdf.save(`Lista de Compras - ${title}.pdf`);
    } finally {
      setExporting(null);
    }
  };

  const handleGenerateImage = async () => {
    if (!tableRef.current) return;
    setExporting('image');
    try {
      const canvas = await html2canvas(tableRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('falha ao gerar imagem');
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast.success('Imagem copiada! Já pode colar no WhatsApp.');
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Lista de Compras - ${title}.png`; a.click();
        URL.revokeObjectURL(url);
        toast.success('Imagem baixada!');
      }
    } catch {
      toast.error('Erro ao gerar imagem');
    } finally {
      setExporting(null);
    }
  };

  const handleGenerateExcel = () => {
    const rows = filteredRows.map(r => {
      const eff = getEffectiveQty(r);
      return {
        Insumo: r.name,
        Categoria: r.category,
        Subcategoria: r.subcategoryName || '',
        Necessário: round2(r.needed),
        'Em Estoque': round2(r.inStock),
        Unidade: r.unit,
        'A Comprar': round2(eff),
        'Custo Unit.': round2(r.unitCost),
        'Custo Total': round2(eff * r.unitCost),
        Responsáveis: r.responsibleNames.join(', '),
        Fornecedores: r.supplierNames.join(', '),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista de Compras');
    XLSX.writeFile(wb, `Lista de Compras - ${title}.xlsx`);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <p className="text-sm text-muted-foreground">Insumos consolidados{menuIds.length > 1 ? ` de ${menuIds.length} cardápios` : ''}, cruzados com o estoque atual.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5 mr-1.5" />Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={handleGeneratePdf} disabled={exporting !== null}>
            {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />}Gerar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateImage} disabled={exporting !== null}>
            {exporting === 'image' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 mr-1.5" />}Gerar print
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateExcel}>
            <SheetIcon className="w-3.5 h-3.5 mr-1.5" />Gerar Excel
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex-1 min-w-[140px] rounded-xl border border-border bg-white px-4 py-3">
          <p className="text-[11px] text-muted-foreground uppercase font-semibold">Em estoque</p>
          <p className="text-lg font-bold text-success">{itemsInStockCount}</p>
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl border border-border bg-white px-4 py-3">
          <p className="text-[11px] text-muted-foreground uppercase font-semibold">A comprar</p>
          <p className="text-lg font-bold text-amber-700">{itemsToBuyCount}</p>
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl border border-border bg-white px-4 py-3">
          <p className="text-[11px] text-muted-foreground uppercase font-semibold">Valor da compra</p>
          <p className="text-lg font-bold text-amber-700">R$ {fmtCur(totalCost)}</p>
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl border border-border bg-white px-4 py-3">
          <p className="text-[11px] text-muted-foreground uppercase font-semibold">Valor total da lista</p>
          <p className="text-lg font-bold text-foreground">R$ {fmtCur(totalListValue)}</p>
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl border border-border bg-white px-4 py-3">
          <p className="text-[11px] text-muted-foreground uppercase font-semibold">A deduzir do estoque</p>
          <p className="text-lg font-bold text-sky-700">R$ {fmtCur(stockDeductionValue)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <MultiSelectFilter
          label="Todas categorias"
          options={categories.map(c => ({ value: c, label: c }))}
          selected={categoryFilters}
          onChange={v => { setCategoryFilters(v); setSubcategoryFilters([]); }}
        />
        <MultiSelectFilter
          label="Todas subcategorias"
          options={subcategories.map(s => ({ value: s, label: s }))}
          selected={subcategoryFilters}
          onChange={setSubcategoryFilters}
        />
        <MultiSelectFilter
          label="Todos responsáveis"
          options={responsibles.map(r => ({ value: r, label: r }))}
          selected={responsibleFilters}
          onChange={setResponsibleFilters}
        />
        <MultiSelectFilter
          label="Todos fornecedores"
          options={suppliers.map(s => ({ value: s, label: s }))}
          selected={supplierFilters}
          onChange={setSupplierFilters}
        />
        <MultiSelectFilter
          label="Todas tags"
          options={allTags.map(t => ({ value: t.id, label: t.name }))}
          selected={tagFilters}
          onChange={setTagFilters}
        />
        <label className="flex items-center gap-2 h-9 px-3 text-sm border border-border rounded-lg bg-white cursor-pointer">
          <input type="checkbox" checked={onlyToBuy} onChange={e => setOnlyToBuy(e.target.checked)} />
          Só o que precisa comprar
        </label>
      </div>

      <div ref={tableRef} className="rounded-xl border border-border overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground bg-muted/20">
              <th className="text-left px-4 py-2.5">INSUMO</th>
              <th className="text-right px-4 py-2.5">NECESSÁRIO</th>
              <th className="text-right px-4 py-2.5">EM ESTOQUE</th>
              <th className="text-right px-4 py-2.5">A COMPRAR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredRows.map(r => {
              const eff = getEffectiveQty(r);
              return (
                <tr key={r.itemId} className={eff > 0 ? 'bg-amber-50/40' : ''}>
                  <td className="px-4 py-2 font-medium text-foreground">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.name}
                      {r.tags.map(t => (
                        <span key={t.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: t.color + '20', color: t.color }}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmtNum(r.needed)} {r.unit}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{fmtNum(r.inStock)} {r.unit}</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number" step="any" min="0"
                        className={`w-20 text-right bg-transparent border border-transparent hover:border-border focus:border-primary focus:outline-none rounded px-1.5 py-0.5 text-sm transition-colors ${eff > 0 ? 'text-amber-700' : 'text-success'}`}
                        value={qtyOverrides[r.itemId] !== undefined ? qtyOverrides[r.itemId] : round2(r.toBuy)}
                        onChange={e => setQtyOverrides(prev => ({ ...prev, [r.itemId]: e.target.value }))}
                        onBlur={e => {
                          const v = parseFloat(e.target.value);
                          if (isNaN(v) || v < 0) setQtyOverrides(prev => ({ ...prev, [r.itemId]: round2(r.toBuy) }));
                          else setQtyOverrides(prev => ({ ...prev, [r.itemId]: round2(v) }));
                        }}
                      />
                      <span className="text-xs text-muted-foreground">{r.unit}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Nenhum insumo nesse filtro.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/20">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold text-foreground">Custo estimado da compra:</td>
              <td className="px-4 py-3 text-right font-bold gold-text">R$ {fmtCur(totalCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {onBack && (
        <div className="flex justify-start mt-6">
          <Button variant="outline" onClick={onBack}>Voltar</Button>
        </div>
      )}
    </div>
  );
}
