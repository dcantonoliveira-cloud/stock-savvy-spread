import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Plus, Search, Upload, X, Trash2, ArrowLeft, Loader2, AlertTriangle,
  CheckCircle2, ListChecks, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { fmtNum } from '@/lib/format';

const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

type SepStatus = 'draft' | 'in_progress' | 'done';

interface SepList {
  id: string;
  name: string;
  event_id: string | null;
  event_name?: string | null;
  status: SepStatus;
  created_at: string;
}

interface SepItemRow {
  id: string;
  list_id: string;
  raw_name: string;
  raw_unit: string | null;
  item_id: string | null;
  requested_qty: number | null;
  separated_qty: number | null;
  note: string | null;
  sort_order: number;
}

interface StockItemLite { id: string; name: string; unit: string; current_stock: number }
interface EventOption { id: string; event_name: string; event_date: string }

const STATUS_CFG: Record<SepStatus, { label: string; cls: string }> = {
  draft:       { label: 'Rascunho',      cls: 'bg-muted text-muted-foreground border-border' },
  in_progress: { label: 'Em separação',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  done:        { label: 'Concluída',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

function matchItemByName(raw: string, items: StockItemLite[], aliases: { item_id: string; alias: string }[]): StockItemLite | null {
  const norm = normalize(raw);
  if (!norm) return null;
  const exact = items.find(i => normalize(i.name) === norm);
  if (exact) return exact;
  const aliasHit = aliases.find(a => normalize(a.alias) === norm);
  return aliasHit ? items.find(i => i.id === aliasHit.item_id) ?? null : null;
}

/** Sugestão fraca (só pra ajudar a busca manual) — nunca casa sozinho. */
function suggestItem(raw: string, items: StockItemLite[]): StockItemLite | null {
  const norm = normalize(raw);
  if (norm.length < 3) return null;
  const firstWord = norm.split(' ')[0];
  if (firstWord.length < 3) return null;
  return items.find(i => normalize(i.name).startsWith(firstWord)) ?? null;
}

function readSheetRows(file: File): Promise<any[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result);
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]);
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/** Planilhas de separação normalmente não têm cabeçalho: Quantidade | Unidade | Nome, nessa ordem.
 * Se a 1ª linha parecer um cabeçalho de verdade, ela é ignorada. */
function parseSeparationSheet(rows: any[][]): { raw_name: string; raw_unit: string; requested_qty: number | null }[] {
  if (!rows.length) return [];
  const first = rows[0].map(c => (c ?? '').toString().toLowerCase());
  const looksLikeHeader = first.some(c => c.includes('nome') || c.includes('quantidade') || c.includes('qtd') || c.includes('item'));
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;

  return dataRows
    .map(cols => {
      const rawQty = cols[0];
      const rawUnit = (cols[1] ?? '').toString().trim();
      const rawName = (cols[2] ?? '').toString().trim();
      const qtyNum = typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty ?? '').replace(',', '.'));
      return { raw_name: rawName, raw_unit: rawUnit, requested_qty: Number.isFinite(qtyNum) ? qtyNum : null };
    })
    .filter(r => r.raw_name);
}

// ── Busca inline de item (pra corrigir não-casados ou adicionar manualmente) ──
function ItemPickerInline({ items, onPick, placeholder = 'Buscar insumo...' }: {
  items: StockItemLite[]; onPick: (item: StockItemLite) => void; placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = q.trim().length < 1 ? [] : items.filter(i => i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
  return (
    <div className="relative">
      <input
        className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
        value={q}
        placeholder={placeholder}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(i => (
            <button key={i.id} type="button" onMouseDown={() => { onPick(i); setQ(''); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary text-left text-xs">
              <span className="font-medium text-foreground">{i.name}</span>
              <span className="text-muted-foreground">{fmtNum(i.current_stock)} {i.unit}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SeparationListsPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<SepList[]>([]);
  const [listCounts, setListCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [loading, setLoading] = useState(true);
  const [stockItems, setStockItems] = useState<StockItemLite[]>([]);
  const [aliases, setAliases] = useState<{ item_id: string; alias: string }[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<SepItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [eventSearch, setEventSearch] = useState('');
  const [eventId, setEventId] = useState('');
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [showEventDrop, setShowEventDrop] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadLists = async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)('separation_lists')
      .select('id, name, event_id, status, created_at, events(event_name)')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false });
    const listRows: SepList[] = (data ?? []).map((l: any) => ({ ...l, event_name: l.events?.event_name ?? null }));
    setLists(listRows);
    if (listRows.length > 0) {
      const { data: rows } = await (supabase.from as any)('separation_list_items')
        .select('list_id, separated_qty').in('list_id', listRows.map(l => l.id));
      const counts: Record<string, { total: number; done: number }> = {};
      for (const r of (rows ?? []) as any[]) {
        counts[r.list_id] ??= { total: 0, done: 0 };
        counts[r.list_id].total++;
        if (r.separated_qty != null) counts[r.list_id].done++;
      }
      setListCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLists();
    Promise.all([
      supabase.from('stock_items').select('id, name, unit, current_stock').neq('category', '_sistema_').order('name').range(0, 9999),
      (supabase.from('stock_item_aliases') as any).select('item_id, alias'),
    ]).then(([itemsRes, aliasesRes]) => {
      if (itemsRes.data) setStockItems(itemsRes.data as StockItemLite[]);
      if (aliasesRes.data) setAliases(aliasesRes.data as { item_id: string; alias: string }[]);
    });
  }, []);

  useEffect(() => {
    if (eventSearch.length < 2) { setEventOptions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await (supabase.from as any)('events')
        .select('id, event_name, event_date')
        .ilike('event_name', `%${eventSearch}%`)
        .eq('company_id', COMPANY_ID)
        .order('event_date').limit(8);
      setEventOptions(data ?? []);
      setShowEventDrop(true);
    }, 300);
    return () => clearTimeout(t);
  }, [eventSearch]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setItemsLoading(true);
    const { data } = await (supabase.from as any)('separation_list_items').select('*').eq('list_id', id).order('sort_order');
    setItems((data ?? []) as SepItemRow[]);
    setItemsLoading(false);
  };

  const handleCreateList = async () => {
    if (!newName.trim() || !newFile || !user) { toast.error('Preencha o nome e escolha a planilha'); return; }
    setCreating(true);
    const { data: listRow, error } = await (supabase.from as any)('separation_lists')
      .insert({ company_id: COMPANY_ID, name: newName.trim(), event_id: eventId || null, status: 'draft', created_by: user.id })
      .select('id').single();
    if (error || !listRow) { toast.error('Erro ao criar lista'); setCreating(false); return; }

    try {
      const rows = await readSheetRows(newFile);
      const parsed = parseSeparationSheet(rows);
      const payload = parsed.map((p, idx) => {
        const match = matchItemByName(p.raw_name, stockItems, aliases);
        return {
          list_id: listRow.id,
          raw_name: p.raw_name,
          raw_unit: p.raw_unit || null,
          item_id: match?.id ?? null,
          requested_qty: p.requested_qty,
          sort_order: idx,
        };
      });
      if (payload.length > 0) {
        const { error: itemsErr } = await (supabase.from as any)('separation_list_items').insert(payload);
        if (itemsErr) toast.error('Lista criada, mas houve erro ao importar os itens da planilha');
      }
      const matchedCount = payload.filter(p => p.item_id).length;
      toast.success(`Lista criada: ${matchedCount}/${payload.length} itens reconhecidos automaticamente.`);
    } catch {
      toast.error('Não consegui ler essa planilha. Confira o arquivo.');
    }

    setCreating(false);
    setCreateOpen(false);
    setNewName(''); setNewFile(null); setEventId(''); setEventSearch('');
    if (fileRef.current) fileRef.current.value = '';
    await loadLists();
    openDetail(listRow.id);
  };

  const updateItem = async (id: string, patch: Partial<SepItemRow>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    await (supabase.from as any)('separation_list_items').update(patch).eq('id', id);
  };

  const deleteItemRow = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await (supabase.from as any)('separation_list_items').delete().eq('id', id);
  };

  const addManualItem = async (item: StockItemLite) => {
    if (!selectedId) return;
    const { data, error } = await (supabase.from as any)('separation_list_items')
      .insert({ list_id: selectedId, raw_name: item.name, raw_unit: item.unit, item_id: item.id, requested_qty: null, sort_order: items.length })
      .select('*').single();
    if (error || !data) { toast.error('Erro ao adicionar item'); return; }
    setItems(prev => [...prev, data as SepItemRow]);
  };

  const selectedList = lists.find(l => l.id === selectedId) ?? null;
  const unmatchedCount = items.filter(i => !i.item_id).length;
  const noQtyCount = items.filter(i => i.item_id && i.requested_qty == null).length;

  const sendToSeparation = async () => {
    if (!selectedId) return;
    if (unmatchedCount > 0) { toast.error(`Resolva os ${unmatchedCount} item(ns) não reconhecido(s) antes de enviar.`); return; }
    await (supabase.from as any)('separation_lists').update({ status: 'in_progress' }).eq('id', selectedId);
    setLists(prev => prev.map(l => l.id === selectedId ? { ...l, status: 'in_progress' } : l));
    toast.success('Lista enviada para separação! Já aparece no app do funcionário.');
  };

  const deleteList = async (id: string) => {
    if (!confirm('Excluir esta lista de separação?')) return;
    await (supabase.from as any)('separation_lists').delete().eq('id', id);
    setLists(prev => prev.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  // ─── Detail / review screen ────────────────────────────────────────────────
  if (selectedId) {
    return (
      <div className="p-6 space-y-5 max-w-4xl mx-auto">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{selectedList?.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedList?.event_name ? `Evento: ${selectedList.event_name} · ` : ''}
              {selectedList && fmtDate(selectedList.created_at)}
            </p>
          </div>
          {selectedList && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_CFG[selectedList.status].cls}`}>
              {STATUS_CFG[selectedList.status].label}
            </span>
          )}
        </div>

        {unmatchedCount > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {unmatchedCount} item(ns) não reconhecido(s) — busque o insumo certo na caixa em amarelo antes de enviar.
          </div>
        )}
        {noQtyCount > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {noQtyCount} item(ns) sem quantidade definida na planilha — dá pra enviar mesmo assim e definir depois.
          </div>
        )}

        <div>
          <ItemPickerInline items={stockItems} onPick={addManualItem} placeholder="Adicionar item que faltou na planilha..." />
        </div>

        {itemsLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  <th className="text-left px-4 py-2.5">Item (da planilha)</th>
                  <th className="text-left px-4 py-2.5 w-56">Insumo cadastrado</th>
                  <th className="text-right px-4 py-2.5 w-28">Qtd. pedida</th>
                  <th className="text-right px-4 py-2.5 w-28">Separado</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map(row => {
                  const matched = stockItems.find(i => i.id === row.item_id);
                  const suggestion = !matched ? suggestItem(row.raw_name, stockItems) : null;
                  return (
                    <tr key={row.id} className="hover:bg-muted/10">
                      <td className="px-4 py-2.5">
                        <p className="text-foreground">{row.raw_name}</p>
                        {row.raw_unit && <p className="text-[11px] text-muted-foreground">{row.raw_unit}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        {matched ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-medium text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{matched.name}
                          </span>
                        ) : (
                          <div>
                            <ItemPickerInline items={stockItems} onPick={i => updateItem(row.id, { item_id: i.id })} />
                            {suggestion && (
                              <button onClick={() => updateItem(row.id, { item_id: suggestion.id })}
                                className="mt-1 text-[11px] text-primary hover:underline">
                                Você quis dizer: {suggestion.name}?
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <input type="number" step="0.01" min="0"
                          className="w-20 text-right px-2 py-1 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={row.requested_qty ?? ''}
                          placeholder="definir"
                          onChange={e => updateItem(row.id, { requested_qty: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold">
                        {row.separated_qty != null
                          ? <span className={row.requested_qty != null && row.separated_qty < row.requested_qty ? 'text-amber-600' : 'text-emerald-600'}>{fmtNum(row.separated_qty)}</span>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-2 py-2.5">
                        <button onClick={() => deleteItemRow(row.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">Nenhum item nessa lista.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button onClick={() => deleteList(selectedId)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Excluir lista
          </button>
          {selectedList?.status === 'draft' && (
            <button onClick={sendToSeparation}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Send className="w-4 h-4" /> Enviar para separação
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── List screen ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Separação</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Suba a planilha de separação de um evento e acompanhe a conferência.</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Nova lista
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : lists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhuma lista de separação ainda.</div>
      ) : (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                <th className="text-left px-5 py-3">Lista</th>
                <th className="text-left px-4 py-3">Evento</th>
                <th className="text-center px-4 py-3">Progresso</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Criada em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {lists.map(l => {
                const c = listCounts[l.id];
                return (
                  <tr key={l.id} onClick={() => openDetail(l.id)} className="hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="px-5 py-3 font-medium text-foreground flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-muted-foreground shrink-0" />{l.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{l.event_name ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                      {c ? `${c.done}/${c.total}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CFG[l.status].cls}`}>{STATUS_CFG[l.status].label}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(l.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCreateOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <p className="font-semibold text-sm">Nova lista de separação</p>
              <button onClick={() => setCreateOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Nome *</label>
                <input className={inputCls} value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Ex: Casamento Maria e João" autoFocus />
              </div>
              <div className="relative">
                <label className={labelCls}>Evento (opcional)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input className={inputCls + ' pl-8'} value={eventSearch}
                    onChange={e => { setEventSearch(e.target.value); if (!e.target.value) setEventId(''); }}
                    onFocus={() => eventOptions.length > 0 && setShowEventDrop(true)}
                    onBlur={() => setTimeout(() => setShowEventDrop(false), 150)}
                    placeholder="Buscar evento..." />
                </div>
                {eventId && <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Evento vinculado</p>}
                {showEventDrop && eventOptions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                    {eventOptions.map(ev => (
                      <button key={ev.id} type="button"
                        onMouseDown={() => { setEventId(ev.id); setEventSearch(ev.event_name); setShowEventDrop(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0">
                        <p className="text-sm font-medium">{ev.event_name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>Planilha (.xlsx / .csv)</label>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 transition-colors">
                  <Upload className="w-4 h-4" />
                  {newFile ? newFile.name : 'Escolher arquivo...'}
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => setNewFile(e.target.files?.[0] ?? null)} />
              </div>
              <button onClick={handleCreateList} disabled={creating}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {creating ? 'Importando...' : 'Criar e importar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
