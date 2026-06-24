import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, GripVertical, Check, X, Star, Info } from 'lucide-react';

interface Template { id: string; name: string; is_default: boolean; item_count?: number }
interface TemplateItem { id: string; title: string; sort_order: number }

const inputCls =
  'h-9 px-3 text-sm bg-background border border-border rounded-lg ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

export default function ChecklistsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [newTplName, setNewTplName] = useState('');
  const [editTplId, setEditTplId] = useState<string | null>(null);
  const [editTplName, setEditTplName] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('checklist_templates' as any)
      .select('id, name, is_default')
      .order('name');
    // count items per template
    const tpls: Template[] = data ?? [];
    await Promise.all(tpls.map(async t => {
      const { count } = await supabase
        .from('checklist_template_items' as any)
        .select('id', { count: 'exact', head: true })
        .eq('template_id', t.id);
      t.item_count = count ?? 0;
    }));
    setTemplates(tpls);
    setLoading(false);
  };

  const loadItems = async (templateId: string) => {
    const { data } = await supabase
      .from('checklist_template_items' as any)
      .select('id, title, sort_order')
      .eq('template_id', templateId)
      .order('sort_order');
    setItems(data ?? []);
  };

  useEffect(() => { loadTemplates(); }, []);

  const selectTemplate = (t: Template) => {
    setSelected(t);
    loadItems(t.id);
  };

  const addTemplate = async () => {
    if (!newTplName.trim()) return;
    const { data, error } = await supabase
      .from('checklist_templates' as any)
      .insert({ name: newTplName.trim(), is_default: false })
      .select('id, name, is_default')
      .single();
    if (error) { toast.error('Erro: ' + error.message); return; }
    setNewTplName('');
    toast.success('Checklist criado');
    await loadTemplates();
    selectTemplate({ ...(data as Template), item_count: 0 });
  };

  const saveEditTpl = async () => {
    if (!editTplId || !editTplName.trim()) return;
    await supabase.from('checklist_templates' as any).update({ name: editTplName.trim() }).eq('id', editTplId);
    setEditTplId(null);
    toast.success('Renomeado');
    loadTemplates();
    if (selected?.id === editTplId) setSelected(prev => prev ? { ...prev, name: editTplName.trim() } : null);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Remover este checklist e todos os seus itens?')) return;
    await supabase.from('checklist_templates' as any).delete().eq('id', id);
    toast.success('Removido');
    if (selected?.id === id) { setSelected(null); setItems([]); }
    loadTemplates();
  };

  const toggleDefault = async (t: Template) => {
    await supabase.from('checklist_templates' as any).update({ is_default: !t.is_default }).eq('id', t.id);
    loadTemplates();
    if (selected?.id === t.id) setSelected(prev => prev ? { ...prev, is_default: !t.is_default } : null);
  };

  const addItem = async () => {
    if (!selected || !newItemTitle.trim()) return;
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 10 : 10;
    const { data, error } = await supabase
      .from('checklist_template_items' as any)
      .insert({ template_id: selected.id, title: newItemTitle.trim(), sort_order: maxOrder })
      .select('id, title, sort_order')
      .single();
    if (error) { toast.error('Erro: ' + error.message); return; }
    setItems(prev => [...prev, data as TemplateItem]);
    setTemplates(prev => prev.map(t => t.id === selected.id ? { ...t, item_count: (t.item_count ?? 0) + 1 } : t));
    setNewItemTitle('');
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setTemplates(prev => prev.map(t => t.id === selected?.id ? { ...t, item_count: Math.max(0, (t.item_count ?? 0) - 1) } : t));
    await supabase.from('checklist_template_items' as any).delete().eq('id', id);
  };

  const updateItemTitle = async (id: string, title: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, title } : i));
    await supabase.from('checklist_template_items' as any).update({ title }).eq('id', id);
  };

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
        <div>
          <p className="font-semibold mb-0.5">Como funcionam os modelos</p>
          <p className="text-blue-700/80">
            Cada modelo é um conjunto de tarefas padrão. Ao abrir um evento e ir na aba <strong>Checklist</strong>, você aplica
            qualquer modelo com um clique — as tarefas são copiadas para aquele evento e podem ser editadas livremente.
            Modelos marcados com <strong>⭐ Padrão</strong> aparecem em destaque na lista.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* Coluna esquerda: lista de templates */}
        <div className="col-span-2 bg-white border border-border rounded-2xl p-5 space-y-3 h-fit">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Modelos</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum modelo ainda.</p>
          ) : (
            <div className="space-y-1">
              {templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    selected?.id === t.id ? 'bg-primary/8 border border-primary/20' : 'hover:bg-muted border border-transparent'
                  }`}
                >
                  {editTplId === t.id ? (
                    <input
                      autoFocus
                      value={editTplName}
                      onChange={e => setEditTplName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEditTpl(); if (e.key === 'Escape') setEditTplId(null); }}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 h-7 px-2 text-sm border border-primary rounded-md focus:outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-sm font-medium truncate">{t.name}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground/60 shrink-0">{t.item_count} itens</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleDefault(t)} title={t.is_default ? 'Remover padrão' : 'Marcar como padrão'}
                      className={`p-1 rounded transition-colors ${t.is_default ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}>
                      <Star className="w-3.5 h-3.5" fill={t.is_default ? 'currentColor' : 'none'} />
                    </button>
                    {editTplId === t.id ? (
                      <>
                        <button onClick={saveEditTpl} className="p-1 text-emerald-600 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditTplId(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                      </>
                    ) : (
                      <button onClick={() => { setEditTplId(t.id); setEditTplName(t.name); }} className="p-1 text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => deleteTemplate(t.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Novo template */}
          <div className="flex gap-1.5 pt-2 border-t border-border">
            <input
              type="text"
              value={newTplName}
              onChange={e => setNewTplName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTemplate(); }}
              placeholder="Nome do modelo..."
              className={inputCls + ' flex-1 h-8 text-xs'}
            />
            <button onClick={addTemplate}
              className="h-8 px-2.5 flex items-center gap-1 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Coluna direita: itens do template selecionado */}
        <div className="col-span-3 bg-white border border-border rounded-2xl p-5">
          {!selected ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
              <span className="text-3xl">☑️</span>
              <p className="text-sm font-medium">Selecione um modelo à esquerda</p>
              <p className="text-xs">para editar seus itens</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{selected.name}</span>
                {selected.is_default && (
                  <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Star className="w-2.5 h-2.5" fill="currentColor" />Padrão
                  </span>
                )}
                <div className="flex-1 h-px bg-border" />
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum item ainda. Adicione abaixo.</p>
              ) : (
                <div className="space-y-1.5 mb-4">
                  {items.map((item, idx) => (
                    <div key={item.id} className="group flex items-center gap-2.5 px-3 py-2 bg-muted/30 border border-border/50 rounded-lg hover:border-border transition-colors">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                      <span className="text-xs text-muted-foreground/50 w-4 shrink-0">{idx + 1}.</span>
                      <input
                        value={item.title}
                        onChange={e => updateItemTitle(item.id, e.target.value)}
                        className="flex-1 bg-transparent text-sm focus:outline-none"
                      />
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-border">
                <input
                  type="text"
                  value={newItemTitle}
                  onChange={e => setNewItemTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addItem(); }}
                  placeholder="Nova tarefa..."
                  className={inputCls + ' flex-1'}
                />
                <button onClick={addItem}
                  className="h-9 px-3 flex items-center gap-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
