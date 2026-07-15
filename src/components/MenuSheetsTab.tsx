import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, Trash2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Sheet { id: string; name: string; category: string | null }
interface MenuSheet { id: string; sheet_id: string; notes: string; sort_order: number; sheet: Sheet }

export default function MenuSheetsTab({ eventId, menuText = '' }: { eventId: string; menuText?: string }) {
  const [allSheets, setAllSheets] = useState<Sheet[]>([]);
  const [menuSheets, setMenuSheets] = useState<MenuSheet[]>([]);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const loadAll = async () => {
    const [sheetsRes, menuRes] = await Promise.all([
      supabase.from('technical_sheets' as any).select('id, name, category').order('category').order('name'),
      supabase.from('event_menu_sheets' as any)
        .select('id, sheet_id, notes, sort_order, sheet:sheet_id(id, name, category)')
        .eq('event_id', eventId)
        .order('sort_order'),
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

  const addSheet = async (sheet: Sheet) => {
    const already = menuSheets.some(m => m.sheet_id === sheet.id);
    if (already) { toast.info('Já adicionado'); return; }
    const nextOrder = menuSheets.length;
    const { error } = await supabase.from('event_menu_sheets' as any)
      .insert({ event_id: eventId, sheet_id: sheet.id, sort_order: nextOrder, notes: '' });
    if (error) { toast.error('Erro: ' + error.message); return; }
    setPickerOpen(false);
    setSearch('');
    await loadAll();
  };

  const removeSheet = async (id: string) => {
    await supabase.from('event_menu_sheets' as any).delete().eq('id', id);
    setMenuSheets(prev => prev.filter(m => m.id !== id));
  };

  const updateNotes = async (id: string, notes: string) => {
    setMenuSheets(prev => prev.map(m => m.id === id ? { ...m, notes } : m));
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

  const suggestWithAI = async () => {
    const stripped = menuText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!stripped) {
      toast.error('Preencha o cardápio em "Texto livre" primeiro');
      return;
    }
    if (allSheets.length === 0) {
      toast.error('Nenhuma ficha técnica cadastrada no sistema');
      return;
    }

    setAiLoading(true);
    const toastId = toast.loading('IA analisando o cardápio...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-menu-sheets`,
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

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Erro na IA');

      const matchedIds: string[] = json.matched_ids ?? [];
      if (matchedIds.length === 0) {
        toast.dismiss(toastId);
        toast.info('A IA não encontrou correspondências com as fichas cadastradas');
        return;
      }

      // Add matched sheets that aren't already added
      const addedIds = new Set(menuSheets.map(m => m.sheet_id));
      const toAdd = allSheets.filter(s => matchedIds.includes(s.id) && !addedIds.has(s.id));

      if (toAdd.length === 0) {
        toast.dismiss(toastId);
        toast.info('Todas as fichas encontradas já estão adicionadas');
        return;
      }

      await Promise.all(toAdd.map((sheet, i) =>
        supabase.from('event_menu_sheets' as any).insert({
          event_id: eventId,
          sheet_id: sheet.id,
          sort_order: menuSheets.length + i,
          notes: '',
        })
      ));

      await loadAll();
      toast.dismiss(toastId);
      toast.success(`IA adicionou ${toAdd.length} ficha${toAdd.length > 1 ? 's' : ''} automaticamente`);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message ?? 'Erro ao consultar IA');
    } finally {
      setAiLoading(false);
    }
  };

  // Group available sheets by category (excluding already added)
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
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {menuSheets.length === 0 ? 'Nenhuma receita adicionada.' : `${menuSheets.length} receita${menuSheets.length > 1 ? 's' : ''} no cardápio`}
        </p>
        <div className="flex items-center gap-2">
          {/* AI button — only shown when menu_text exists */}
          {hasMenuText && (
            <button
              onClick={suggestWithAI}
              disabled={aiLoading}
              className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {aiLoading ? 'Analisando...' : 'Sugerir com IA'}
            </button>
          )}

          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setPickerOpen(v => !v)}
              className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar receita
            </button>

            {pickerOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-white border border-border rounded-xl shadow-xl overflow-hidden">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      autoFocus
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar receita..."
                      className="w-full h-8 pl-8 pr-3 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {Object.keys(grouped).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {search ? 'Nenhuma receita encontrada.' : 'Todas as receitas já foram adicionadas.'}
                    </p>
                  ) : (
                    Object.entries(grouped).map(([cat, sheets]) => (
                      <div key={cat}>
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 bg-muted/30 sticky top-0">
                          {cat}
                        </div>
                        {sheets.map(sheet => (
                          <button
                            key={sheet.id}
                            onClick={() => addSheet(sheet)}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-primary/5 transition-colors flex items-center gap-2"
                          >
                            <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            {sheet.name}
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

      {/* Selected sheets list */}
      {menuSheets.length === 0 ? (
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
      ) : (
        <div className="space-y-2">
          {menuSheets.map((m, i) => (
            <div key={m.id} className="bg-white border border-border rounded-xl p-4 flex gap-3 items-start group">
              {/* Order controls */}
              <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-muted-foreground text-center w-5">{i + 1}</span>
                <button onClick={() => move(i, 1)} disabled={i === menuSheets.length - 1}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-20 transition-colors">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {m.sheet?.category && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5 block">
                        {m.sheet.category}
                      </span>
                    )}
                    <p className="text-sm font-semibold">{m.sheet?.name ?? '—'}</p>
                  </div>
                  <button
                    onClick={() => removeSheet(m.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-muted-foreground hover:text-destructive transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={m.notes}
                  onChange={e => updateNotes(m.id, e.target.value)}
                  placeholder="Observações (opcional)..."
                  className="mt-2 w-full h-8 px-3 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-colors text-muted-foreground"
                />
              </div>
            </div>
          ))}
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
