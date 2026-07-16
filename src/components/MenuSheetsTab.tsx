import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Pencil, Copy, StickyNote, ChevronRight, AlertCircle, HelpCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import SheetFormModal from '@/components/SheetFormModal';

interface Sheet { id: string; name: string; category: string | null }
interface MenuSheet { id: string; sheet_id: string; notes: string; sort_order: number; sheet: Sheet }

interface UncertainItem { menu_item: string; suggestions: { id: string; name: string; category: string | null }[] }
interface AIResult { matched_ids: string[]; uncertain: UncertainItem[]; unmatched: string[] }
interface AIReport { matched: number; uncertain: number; unmatched: string[] }

export default function MenuSheetsTab({ eventId, menuText = '' }: { eventId: string; menuText?: string }) {
  const [allSheets, setAllSheets]     = useState<Sheet[]>([]);
  const [menuSheets, setMenuSheets]   = useState<MenuSheet[]>([]);
  const [search, setSearch]           = useState('');
  const [pickerOpen, setPickerOpen]   = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const aiKey = `ai_result_${eventId}`;
  const readSession = (): { result?: AIResult; report?: AIReport; sel?: Record<string, string> } => {
    try { const v = sessionStorage.getItem(aiKey); return v ? JSON.parse(v) : {}; } catch { return {}; }
  };
  const [aiResult, setAiResult]       = useState<AIResult | null>(() => readSession().result ?? null);
  const [aiReport, setAiReport]       = useState<AIReport | null>(() => readSession().report ?? null);
  const [uncertainSel, setUncertainSel] = useState<Record<string, string>>(() => readSession().sel ?? {});

  // Persist all AI state to sessionStorage whenever any of it changes
  useEffect(() => {
    const s = readSession();
    if (aiResult) s.result = aiResult; else delete s.result;
    if (aiReport) s.report = aiReport; else delete s.report;
    s.sel = uncertainSel;
    sessionStorage.setItem(aiKey, JSON.stringify(s));
  }, [aiResult, aiReport, uncertainSel]);
  // modal state
  const [modalOpen, setModalOpen]     = useState(false);
  const [modalSheetId, setModalSheetId] = useState<string | null>(null);
  const [modalMode, setModalMode]     = useState<'create' | 'edit' | 'duplicate'>('create');
  const [modalInitialName, setModalInitialName] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  const loadAll = async () => {
    const [sheetsRes, menuRes] = await Promise.all([
      supabase.from('technical_sheets' as any).select('id, name, category').order('category').order('name'),
      supabase.from('event_menu_sheets' as any)
        .select('id, sheet_id, notes, sort_order, sheet:sheet_id(id, name, category)')
        .eq('event_id', eventId).order('sort_order'),
    ]);
    setAllSheets((sheetsRes.data ?? []) as Sheet[]);
    setMenuSheets((menuRes.data ?? []) as MenuSheet[]);
  };

  useEffect(() => { loadAll(); }, [eventId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const addSheet = async (sheet: Sheet) => {
    if (menuSheets.some(m => m.sheet_id === sheet.id)) { toast.info('Já adicionado'); return; }
    const { error } = await supabase.from('event_menu_sheets' as any)
      .insert({ event_id: eventId, sheet_id: sheet.id, sort_order: menuSheets.length, notes: '' });
    if (error) { toast.error('Erro: ' + error.message); return; }
    setPickerOpen(false); setSearch(''); await loadAll();
  };

  const removeSheet = async (id: string) => {
    await supabase.from('event_menu_sheets' as any).delete().eq('id', id);
    setMenuSheets(p => p.filter(m => m.id !== id));
    setExpandedNotes(p => { const n = new Set(p); n.delete(id); return n; });
  };

  const updateNotes = async (id: string, notes: string) => {
    setMenuSheets(p => p.map(m => m.id === id ? { ...m, notes } : m));
    await supabase.from('event_menu_sheets' as any).update({ notes }).eq('id', id);
  };

  const move = async (index: number, dir: -1 | 1) => {
    const newList = [...menuSheets];
    const target = index + dir;
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setMenuSheets(newList);
    await Promise.all(newList.map((m, i) =>
      supabase.from('event_menu_sheets' as any).update({ sort_order: i }).eq('id', m.id)
    ));
  };

  const toggleNotes = (id: string) => setExpandedNotes(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  // ── Modal helpers ────────────────────────────────────────────────────────────
  const openEdit = (sheetId: string) => { setModalSheetId(sheetId); setModalMode('edit'); setModalInitialName(''); setModalOpen(true); };
  const openDuplicate = (sheetId: string) => { setModalSheetId(sheetId); setModalMode('duplicate'); setModalInitialName(''); setModalOpen(true); };
  const openCreate = (initialName = '') => { setModalSheetId(null); setModalMode('create'); setModalInitialName(initialName); setModalOpen(true); };

  const handleModalSaved = async (saved: { id: string; name: string; category: string | null }) => {
    await loadAll();
    // If creating new from unmatched, auto-add to event
    if (modalMode === 'create' || modalMode === 'duplicate') {
      const already = menuSheets.some(m => m.sheet_id === saved.id);
      if (!already) {
        await supabase.from('event_menu_sheets' as any)
          .insert({ event_id: eventId, sheet_id: saved.id, sort_order: menuSheets.length, notes: '' });
        await loadAll();
      }
    }
  };

  // ── AI ───────────────────────────────────────────────────────────────────────
  const suggestWithAI = async () => {
    const stripped = menuText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!stripped) { toast.error('Preencha o cardápio em "Texto livre" primeiro'); return; }
    if (allSheets.length === 0) { toast.error('Nenhuma ficha técnica cadastrada no sistema'); return; }
    setAiLoading(true);
    const toastId = toast.loading('IA analisando o cardápio...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clever-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ menu_text: stripped, sheets: allSheets }),
        }
      );
      const text = await res.text();
      let json: any = {};
      try { json = JSON.parse(text); } catch { throw new Error(`Resposta inválida (${res.status}): ${text.slice(0, 200)}`); }
      if (!res.ok) throw new Error(`[${res.status}] ${json.error ?? text.slice(0, 200)}`);

      const result: AIResult = json;

      // Auto-add matched sheets that aren't already in the event
      const addedIds = new Set(menuSheets.map(m => m.sheet_id));
      const toAdd = allSheets.filter(s => result.matched_ids.includes(s.id) && !addedIds.has(s.id));
      if (toAdd.length) {
        await Promise.all(toAdd.map((sheet, i) =>
          supabase.from('event_menu_sheets' as any).insert({
            event_id: eventId, sheet_id: sheet.id, sort_order: menuSheets.length + i, notes: '',
          })
        ));
        await loadAll();
      }

      // Merge with existing pending uncertain/unmatched (keep items not yet resolved)
      const prevResult = aiResult;
      const prevUncertainItems = new Set(prevResult?.uncertain.map(u => u.menu_item) ?? []);
      const prevUnmatched = new Set(prevResult?.unmatched ?? []);

      // New uncertain: from AI + keep previous ones not yet resolved
      const newUncertain = [
        ...result.uncertain.filter(u => !prevUncertainItems.has(u.menu_item)),
        ...(prevResult?.uncertain ?? []),
      ];
      // New unmatched: from AI + keep previous ones not yet resolved
      const newUnmatched = [
        ...result.unmatched.filter(u => !prevUnmatched.has(u)),
        ...(prevResult?.unmatched ?? []),
      ];

      const merged: AIResult = { matched_ids: result.matched_ids, uncertain: newUncertain, unmatched: newUnmatched };
      setAiResult(merged);
      setAiReport({ matched: toAdd.length, uncertain: newUncertain.length, unmatched: newUnmatched });

      // Init selections for new uncertain items only
      setUncertainSel(prev => {
        const sel = { ...prev };
        result.uncertain.forEach(u => { if (!sel[u.menu_item]) sel[u.menu_item] = u.suggestions[0]?.id ?? ''; });
        return sel;
      });

      toast.dismiss(toastId);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message ?? 'Erro ao consultar IA');
    } finally {
      setAiLoading(false);
    }
  };

  const saveMapping = async (menuItem: string, sheetId: string, sheetName: string) => {
    const key = menuItem.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
    await supabase.from('menu_ai_mappings' as any).upsert(
      { menu_text: key, sheet_id: sheetId, sheet_name: sheetName, updated_at: new Date().toISOString() },
      { onConflict: 'menu_text,sheet_id', ignoreDuplicates: false }
    ).then(() => supabase.rpc('increment_mapping_count' as any, { p_menu_text: key, p_sheet_id: sheetId }).catch(() => {}));
  };

  const confirmOneUncertain = async (menuItem: string) => {
    const sheetId = uncertainSel[menuItem] ?? '';
    const addedIds = new Set(menuSheets.map(m => m.sheet_id));
    if (sheetId && !addedIds.has(sheetId)) {
      await supabase.from('event_menu_sheets' as any).insert({ event_id: eventId, sheet_id: sheetId, sort_order: menuSheets.length, notes: '' });
      await loadAll();
      const sheet = allSheets.find(s => s.id === sheetId);
      if (sheet) saveMapping(menuItem, sheetId, sheet.name);
      toast.success('Ficha adicionada!');
    }
    setAiResult(p => p ? { ...p, uncertain: p.uncertain.filter(u => u.menu_item !== menuItem) } : p);
  };

  const dismissUncertain = (menuItem: string) => {
    setAiResult(p => p ? { ...p, uncertain: p.uncertain.filter(u => u.menu_item !== menuItem) } : p);
  };

  const confirmAllUncertain = async () => {
    const addedIds = new Set(menuSheets.map(m => m.sheet_id));
    const toAdd = Object.entries(uncertainSel).filter(([, id]) => id && !addedIds.has(id));
    if (toAdd.length === 0) { setAiResult(p => p ? { ...p, uncertain: [] } : p); return; }
    await Promise.all(toAdd.map(([, sheetId], i) =>
      supabase.from('event_menu_sheets' as any).insert({ event_id: eventId, sheet_id: sheetId, sort_order: menuSheets.length + i, notes: '' })
    ));
    await loadAll();
    toAdd.forEach(([menuItem, sheetId]) => {
      const sheet = allSheets.find(s => s.id === sheetId);
      if (sheet) saveMapping(menuItem, sheetId, sheet.name);
    });
    setAiResult(p => p ? { ...p, uncertain: [] } : p);
    toast.success(`${toAdd.length} ficha${toAdd.length > 1 ? 's' : ''} adicionada${toAdd.length > 1 ? 's' : ''}!`);
  };

  // ── Picker filter ─────────────────────────────────────────────────────────────
  const addedIds = new Set(menuSheets.map(m => m.sheet_id));
  const filtered = allSheets.filter(s =>
    !addedIds.has(s.id) &&
    (search === '' || s.name.toLowerCase().includes(search.toLowerCase()) || (s.category ?? '').toLowerCase().includes(search.toLowerCase()))
  );
  const grouped = filtered.reduce<Record<string, Sheet[]>>((acc, s) => {
    const cat = s.category ?? 'Sem categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const hasMenuText = menuText.replace(/<[^>]*>/g, '').trim().length > 0;

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {menuSheets.length === 0 ? 'Nenhuma receita adicionada.' : `${menuSheets.length} receita${menuSheets.length > 1 ? 's' : ''} no cardápio`}
        </p>
        <div className="flex items-center gap-2">
          {hasMenuText && (
            <button onClick={suggestWithAI} disabled={aiLoading}
              className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              <Sparkles className="w-4 h-4" />
              {aiLoading ? 'Analisando...' : 'Sugerir com IA'}
            </button>
          )}
          <div className="relative" ref={pickerRef}>
            <button onClick={() => setPickerOpen(v => !v)}
              className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Adicionar receita
            </button>
            {pickerOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-white border border-border rounded-xl shadow-xl overflow-hidden">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar receita..."
                      className="w-full h-8 pl-8 pr-3 text-sm border border-border rounded-lg focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {/* Create new */}
                  <button onClick={() => { setPickerOpen(false); openCreate(search); }}
                    className="w-full text-left px-3 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors flex items-center gap-2 border-b border-border">
                    <Plus className="w-3.5 h-3.5 shrink-0" /> Criar nova ficha técnica...
                  </button>
                  {Object.keys(grouped).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {search ? 'Nenhuma receita encontrada.' : 'Todas as receitas já foram adicionadas.'}
                    </p>
                  ) : (
                    Object.entries(grouped).map(([cat, sheets]) => (
                      <div key={cat}>
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 bg-muted/30 sticky top-0">{cat}</div>
                        {sheets.map(sheet => (
                          <button key={sheet.id} onClick={() => addSheet(sheet)}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-primary/5 transition-colors flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> {sheet.name}
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI: Mini relatório ── */}
      {aiReport && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
              <span className="text-sm font-semibold text-foreground">Resultado da IA</span>
            </div>
            <button onClick={() => setAiReport(null)} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="px-4 py-3 text-center">
              <p className="text-2xl font-bold text-green-600">{aiReport.matched}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Adicionados</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-2xl font-bold text-amber-500">{aiReport.uncertain}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Com dúvida</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-2xl font-bold text-red-500">{aiReport.unmatched.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Não encontrados</p>
            </div>
          </div>
          {aiReport.unmatched.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Itens não encontrados no sistema:</p>
              <div className="flex flex-wrap gap-1.5">
                {aiReport.unmatched.map(item => (
                  <span key={item} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full">
                    <AlertCircle className="w-3 h-3 shrink-0" />{item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AI: Uncertain panel ── */}
      {aiResult && aiResult.uncertain.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-amber-100/60 border-b border-amber-200 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">Com dúvida — selecione a ficha correspondente</p>
          </div>
          <div className="divide-y divide-amber-100">
            {aiResult.uncertain.map(u => (
              <div key={u.menu_item} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-foreground min-w-[140px]">{u.menu_item}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <UncertainCombobox
                    value={uncertainSel[u.menu_item] ?? u.suggestions[0]?.id ?? ''}
                    suggestions={u.suggestions}
                    allSheets={allSheets}
                    onChange={id => setUncertainSel(p => ({ ...p, [u.menu_item]: id }))}
                  />
                  <button onClick={() => confirmOneUncertain(u.menu_item)}
                    disabled={!uncertainSel[u.menu_item] && !u.suggestions[0]?.id}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 transition-colors whitespace-nowrap font-medium">
                    ✓ Confirmar
                  </button>
                  <button onClick={() => { openCreate(u.menu_item); }}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white hover:bg-muted text-muted-foreground transition-colors whitespace-nowrap">
                    + Criar nova
                  </button>
                  <button onClick={() => dismissUncertain(u.menu_item)} title="Ignorar"
                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-amber-200 flex items-center justify-between">
            <span className="text-xs text-amber-700/60">{aiResult.uncertain.length} item{aiResult.uncertain.length > 1 ? 's' : ''} restante{aiResult.uncertain.length > 1 ? 's' : ''}</span>
            <button onClick={confirmAllUncertain}
              className="text-sm font-medium px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
              Confirmar todos
            </button>
          </div>
        </div>
      )}

      {/* ── AI: Unmatched panel ── */}
      {aiResult && aiResult.unmatched.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-red-100/60 border-b border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <p className="text-sm font-semibold text-red-800">Não encontrados — nenhuma ficha corresponde</p>
            </div>
            <button onClick={() => setAiResult(p => p ? { ...p, unmatched: [] } : p)}
              className="p-1 rounded hover:bg-red-200 text-red-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-red-100">
            {aiResult.unmatched.map(item => (
              <div key={item} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">{item}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Quick search picker */}
                  <UnmatchedPicker
                    item={item}
                    allSheets={allSheets}
                    addedIds={addedIds}
                    onSelect={s => { addSheet(s); setAiResult(p => p ? { ...p, unmatched: p.unmatched.filter(u => u !== item) } : p); }}
                  />
                  <button onClick={() => { openCreate(item); setAiResult(p => p ? { ...p, unmatched: p.unmatched.filter(u => u !== item) } : p); }}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 transition-colors whitespace-nowrap">
                    + Criar ficha
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {menuSheets.length === 0 && !aiResult ? (
        <div className="border-2 border-dashed border-border rounded-xl py-14 flex flex-col items-center gap-3 text-center">
          <BookOpenIcon />
          {hasMenuText ? (
            <p className="text-sm text-muted-foreground">
              Clique em <strong className="text-violet-600">Sugerir com IA</strong> para preencher automaticamente<br />
              ou <strong>Adicionar receita</strong> para selecionar manualmente
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Clique em <strong>Adicionar receita</strong> para montar o cardápio</p>
          )}
        </div>
      ) : menuSheets.length > 0 ? (
        <div className="border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[32px_24px_1fr_110px_100px_88px] bg-muted/30 border-b border-border text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <div className="px-2 py-2.5 text-center">#</div>
            <div />
            <div className="px-3 py-2.5">Nome</div>
            <div className="px-3 py-2.5">Categoria</div>
            <div className="px-3 py-2.5 text-center">Obs</div>
            <div className="px-3 py-2.5 text-center">Ações</div>
          </div>

          {/* Rows */}
          {menuSheets.map((m, i) => {
            const hasNotes = m.notes.trim().length > 0;
            const expanded = expandedNotes.has(m.id);
            return (
              <div key={m.id} className="border-b border-border/50 last:border-0">
                <div className="grid grid-cols-[32px_24px_1fr_110px_100px_88px] items-center hover:bg-muted/20 transition-colors group">
                  {/* Order */}
                  <div className="flex flex-col items-center gap-0 py-1 px-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] text-muted-foreground leading-none">{i + 1}</span>
                    <button onClick={() => move(i, 1)} disabled={i === menuSheets.length - 1}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Notes indicator */}
                  <div className="flex items-center justify-center">
                    {hasNotes && <StickyNote className="w-3 h-3 text-amber-500" />}
                  </div>

                  {/* Name */}
                  <div className="px-3 py-2.5">
                    <span className="text-sm font-medium text-foreground">{m.sheet?.name ?? '—'}</span>
                  </div>

                  {/* Category */}
                  <div className="px-3 py-2.5">
                    {m.sheet?.category ? (
                      <span className="text-xs text-muted-foreground">{m.sheet.category}</span>
                    ) : <span className="text-xs text-muted-foreground/40">—</span>}
                  </div>

                  {/* Notes toggle */}
                  <div className="px-3 py-2.5 flex justify-center">
                    <button onClick={() => toggleNotes(m.id)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${expanded ? 'bg-primary/10 border-primary/20 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                      <StickyNote className="w-3 h-3" />
                      {expanded ? 'Fechar' : 'Obs.'}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="px-3 py-2.5 flex items-center justify-center gap-0.5">
                    <button onClick={() => openEdit(m.sheet_id)} title="Editar ficha"
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openDuplicate(m.sheet_id)} title="Duplicar ficha"
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeSheet(m.id)} title="Remover do cardápio"
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Notes row */}
                {expanded && (
                  <div className="px-4 pb-3 pt-1 bg-muted/10 border-t border-dashed border-border/40">
                    <textarea
                      value={m.notes}
                      onChange={e => updateNotes(m.id, e.target.value)}
                      placeholder="Observações para este prato (ex: sem pimenta, porção extra)..."
                      rows={2}
                      className="w-full text-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary resize-none text-foreground placeholder:text-muted-foreground/50 bg-white"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── SheetFormModal ── */}
      <SheetFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleModalSaved}
        sheetId={modalSheetId}
        mode={modalMode}
        initialName={modalInitialName}
      />
    </div>
  );
}

// ── Uncertain combobox — suggestions + full search ────────────────────────────
function UncertainCombobox({ value, suggestions, allSheets, onChange }: {
  value: string; suggestions: Sheet[]; allSheets: Sheet[]; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = allSheets.find(s => s.id === value);
  const suggestionIds = new Set(suggestions.map(s => s.id));

  const results = q.trim()
    ? allSheets.filter(s => s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10)
    : [...suggestions, ...allSheets.filter(s => !suggestionIds.has(s.id)).slice(0, 6)];

  return (
    <div className="relative flex-1 min-w-[200px]" ref={ref}>
      <button onClick={() => { setOpen(v => !v); setQ(''); }}
        className="w-full text-left text-xs px-2.5 py-1.5 border border-border rounded-lg bg-white flex items-center justify-between gap-2 hover:border-primary/40 transition-colors">
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? `${selected.name}${selected.category ? ` (${selected.category})` : ''}` : '— Não adicionar —'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full min-w-[260px] bg-white border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar ficha..."
              className="w-full h-7 px-2.5 text-xs border border-border rounded-lg focus:outline-none focus:border-primary" />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {!q && <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 bg-muted/20">Sugestões da IA</div>}
            {results.map((s, i) => (
              <div key={s.id}>
                {!q && i === suggestions.length && suggestions.length > 0 && (
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 bg-muted/20 border-t border-border">Outras fichas</div>
                )}
                <button onClick={() => { onChange(s.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${value === s.id ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5'}`}>
                  {value === s.id && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  <span className="font-medium">{s.name}</span>
                  {s.category && <span className="text-muted-foreground">({s.category})</span>}
                  {!q && suggestionIds.has(s.id) && <span className="ml-auto text-[10px] text-violet-500 font-medium">IA</span>}
                </button>
              </div>
            ))}
            <button onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs border-t border-border transition-colors ${!value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
              — Não adicionar —
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Unmatched picker — search existing sheets ──────────────────────────────────
function UnmatchedPicker({ item, allSheets, addedIds, onSelect }: {
  item: string; allSheets: Sheet[]; addedIds: Set<string>; onSelect: (s: Sheet) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(item);
  const results = allSheets.filter(s => !addedIds.has(s.id) && s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white hover:bg-muted text-muted-foreground transition-colors">
        Selecionar ficha
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-50 w-64 bg-white border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              className="w-full h-7 px-2.5 text-xs border border-border rounded-lg focus:outline-none focus:border-primary" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma ficha encontrada</p>
            ) : results.map(s => (
              <button key={s.id} onClick={() => { onSelect(s); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-primary/5 transition-colors">
                <span className="font-medium">{s.name}</span>
                {s.category && <span className="text-muted-foreground ml-1">({s.category})</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BookOpenIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  );
}
