import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Check, ChevronDown, User, Calendar, ListChecks, Info } from 'lucide-react';

interface ChecklistTemplate { id: string; name: string; is_default: boolean }
interface ChecklistItem {
  id: string;
  title: string;
  is_done: boolean;
  assigned_user_id: string | null;
  assigned_name?: string | null;
  due_date: string | null;
  notes: string | null;
  sort_order: number;
}
interface Profile { id: string; display_name: string }

const inputCls =
  'h-8 px-2.5 text-sm bg-background border border-border rounded-lg ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

export default function EventChecklistTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = async () => {
    const [itemsRes, tplRes, profRes] = await Promise.all([
      supabase.from('event_checklist_items' as any)
        .select('id, title, is_done, assigned_user_id, due_date, notes, sort_order, profiles:assigned_user_id(display_name)')
        .eq('event_id', eventId)
        .order('sort_order'),
      supabase.from('checklist_templates' as any).select('id, name, is_default').order('name'),
      supabase.from('profiles' as any).select('id, display_name').order('display_name'),
    ]);
    setItems((itemsRes.data ?? []).map((r: any) => ({ ...r, assigned_name: r.profiles?.display_name ?? null })));
    setTemplates(tplRes.data ?? []);
    setProfiles(profRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventId]);

  const addItem = async () => {
    if (!newTitle.trim()) return;
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 10 : 10;
    const { data, error } = await supabase.from('event_checklist_items' as any)
      .insert({ event_id: eventId, title: newTitle.trim(), sort_order: maxOrder })
      .select('id, title, is_done, assigned_user_id, due_date, notes, sort_order')
      .single();
    if (error) { toast.error('Erro: ' + error.message); return; }
    setItems(prev => [...prev, { ...(data as any), assigned_name: null }]);
    setNewTitle('');
  };

  const toggleDone = async (item: ChecklistItem) => {
    const next = !item.is_done;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_done: next } : i));
    await supabase.from('event_checklist_items' as any).update({ is_done: next }).eq('id', item.id);
  };

  const updateField = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    if (timers.current[id + field]) clearTimeout(timers.current[id + field]);
    timers.current[id + field] = setTimeout(async () => {
      await supabase.from('event_checklist_items' as any).update({ [field]: value || null }).eq('id', id);
    }, 1000);
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from('event_checklist_items' as any).delete().eq('id', id);
    toast.success('Item removido');
  };

  const applyTemplate = async (tpl: ChecklistTemplate) => {
    const { data: tplItems, error } = await supabase
      .from('checklist_template_items' as any)
      .select('title, sort_order')
      .eq('template_id', tpl.id)
      .order('sort_order');
    if (error) { toast.error('Erro: ' + error.message); return; }
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) : 0;
    const inserts = (tplItems ?? []).map((ti: any, idx: number) => ({
      event_id: eventId,
      title: ti.title,
      sort_order: maxOrder + (idx + 1) * 10,
      template_id: tpl.id,
    }));
    if (!inserts.length) { toast('Checklist vazio.'); return; }
    const { error: insErr } = await supabase.from('event_checklist_items' as any).insert(inserts);
    if (insErr) { toast.error('Erro: ' + insErr.message); return; }
    toast.success(`Checklist "${tpl.name}" aplicado`);
    setShowTemplates(false);
    load();
  };

  const done = items.filter(i => i.is_done).length;

  return (
    <div className="space-y-4">
      {/* Banner explicativo */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
        <div>
          <p className="font-semibold mb-0.5">Como usar os checklists</p>
          <p className="text-blue-700/80">
            Adicione tarefas manualmente ou aplique um modelo pré-cadastrado. Você pode atribuir cada tarefa a um usuário e definir uma data limite.
            Gerencie os modelos em <strong>Cadastros → Checklists</strong>.
          </p>
        </div>
      </div>

      {/* Cabeçalho + ações */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
              Checklist do Evento
            </span>
            {items.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {done}/{items.length} concluídos
              </span>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowTemplates(v => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <ListChecks className="w-3.5 h-3.5" />
              Aplicar modelo
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-border rounded-xl shadow-lg z-20 py-1">
                {templates.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum modelo cadastrado.</p>
                ) : templates.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                    {t.is_default && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Padrão</span>}
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {items.length > 0 && (
          <div className="mb-5 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(done / items.length) * 100}%` }}
            />
          </div>
        )}

        {/* Lista de itens */}
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma tarefa ainda. Adicione abaixo ou aplique um modelo.</p>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id}
                className={`group flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                  item.is_done ? 'bg-muted/30 border-border/50' : 'bg-white border-border hover:border-primary/20'
                }`}>
                {/* Checkbox */}
                <button
                  onClick={() => toggleDone(item)}
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    item.is_done
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-border hover:border-primary'
                  }`}
                >
                  {item.is_done && <Check className="w-3 h-3" />}
                </button>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    value={item.title}
                    onChange={e => updateField(item.id, 'title', e.target.value)}
                    className={`w-full bg-transparent text-sm font-medium border-0 focus:outline-none focus:ring-0 p-0 ${
                      item.is_done ? 'line-through text-muted-foreground' : 'text-foreground'
                    }`}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Responsável */}
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-muted-foreground/50" />
                      <select
                        value={item.assigned_user_id ?? ''}
                        onChange={e => updateField(item.id, 'assigned_user_id', e.target.value || null)}
                        className="text-xs text-muted-foreground bg-transparent border-0 focus:outline-none cursor-pointer hover:text-foreground"
                      >
                        <option value="">Sem responsável</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                      </select>
                    </div>
                    {/* Data */}
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground/50" />
                      <input
                        type="date"
                        value={item.due_date ?? ''}
                        onChange={e => updateField(item.id, 'due_date', e.target.value)}
                        className="text-xs text-muted-foreground bg-transparent border-0 focus:outline-none cursor-pointer hover:text-foreground"
                      />
                    </div>
                  </div>
                  {/* Notas */}
                  <input
                    value={item.notes ?? ''}
                    onChange={e => updateField(item.id, 'notes', e.target.value)}
                    placeholder="Observação..."
                    className="w-full bg-transparent text-xs text-muted-foreground border-0 focus:outline-none focus:ring-0 p-0 placeholder:text-muted-foreground/30"
                  />
                </div>

                {/* Delete */}
                <button
                  onClick={() => deleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 mt-0.5 p-1 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar novo item */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-border">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
            placeholder="Nova tarefa..."
            className={inputCls + ' flex-1'}
          />
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 px-3 h-8 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
