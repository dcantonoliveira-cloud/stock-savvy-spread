import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Star, Check, X } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';

interface Template { id: string; name: string; content: string | null; is_default: boolean }
interface AnnexModel { id: string; name: string; content: string | null }

const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

const inputCls = 'h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1';

const TAGS = [
  ['[NOME DO CLIENTE]','[CPF DO CLIENTE]','[RG DO CLIENTE]','[ENDEREÇO DO CLIENTE]'],
  ['[QTD DE CONVIDADOS]','[TIPO DO CARDÁPIO]','[TIPO DO EVENTO]','[DATA DO EVENTO]'],
  ['[HORA CERIMONIA]','[LOCAL DO EVENTO]','[TEMPO DE FESTA]','[VALOR DO FRETE]'],
  ['[VALOR POR CONVIDADO]','[VALOR TOTAL DO EVENTO]'],
  ['[NOME DA TESTEMUNHA 1]','[CPF DA TESTEMUNHA 1]','[NOME DA TESTEMUNHA 2]','[CPF DA TESTEMUNHA 2]'],
  ['[DIA DE HOJE]','[MÊS DE HOJE POR EXTENSO]','[ANO DE HOJE]'],
];

export default function ContratosPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [annexes, setAnnexes] = useState<AnnexModel[]>([]);
  const [newAnnexName, setNewAnnexName] = useState('');
  const [selectedAnnex, setSelectedAnnex] = useState<AnnexModel | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadTemplates = async () => {
    const { data } = await supabase.from('contract_templates' as any)
      .select('id,name,content,is_default').eq('company_id', COMPANY_ID).order('name');
    setTemplates((data ?? []) as Template[]);
  };

  const loadAnnexes = async () => {
    const { data } = await supabase.from('annex_models' as any)
      .select('id,name,content').eq('company_id', COMPANY_ID).order('name');
    setAnnexes((data ?? []) as AnnexModel[]);
  };

  useEffect(() => { loadTemplates(); loadAnnexes(); }, []);

  const addTemplate = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from('contract_templates' as any)
      .insert({ name: newName.trim(), company_id: COMPANY_ID, is_default: false, content: '' })
      .select('id,name,content,is_default').single();
    if (error) { toast.error('Erro: ' + error.message); return; }
    setNewName('');
    toast.success('Modelo criado');
    await loadTemplates();
    setSelected(data as Template);
  };

  const saveContent = (id: string, content: string) => {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      await supabase.from('contract_templates' as any).update({ content }).eq('id', id);
    }, 1200);
  };

  const toggleDefault = async (t: Template) => {
    await supabase.from('contract_templates' as any).update({ is_default: !t.is_default }).eq('id', t.id);
    loadTemplates();
    if (selected?.id === t.id) setSelected(p => p ? { ...p, is_default: !p.is_default } : p);
  };

  const saveEditName = async () => {
    if (!editId || !editName.trim()) return;
    await supabase.from('contract_templates' as any).update({ name: editName.trim() }).eq('id', editId);
    setEditId(null);
    loadTemplates();
    if (selected?.id === editId) setSelected(p => p ? { ...p, name: editName.trim() } : p);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Remover este modelo?')) return;
    await supabase.from('contract_templates' as any).delete().eq('id', id);
    if (selected?.id === id) setSelected(null);
    loadTemplates();
    toast.success('Removido');
  };

  const addAnnex = async () => {
    if (!newAnnexName.trim()) return;
    const { data, error } = await supabase.from('annex_models' as any)
      .insert({ name: newAnnexName.trim(), company_id: COMPANY_ID, content: '' })
      .select('id,name,content').single();
    if (error) { toast.error('Erro: ' + error.message); return; }
    setNewAnnexName('');
    await loadAnnexes();
    setSelectedAnnex(data as AnnexModel);
    toast.success('Modelo de anexo criado');
  };

  const saveAnnexContent = (id: string, content: string) => {
    clearTimeout(timers.current['ax_' + id]);
    timers.current['ax_' + id] = setTimeout(async () => {
      await supabase.from('annex_models' as any).update({ content }).eq('id', id);
    }, 1200);
  };

  const deleteAnnex = async (id: string) => {
    if (!confirm('Remover este modelo de anexo?')) return;
    await supabase.from('annex_models' as any).delete().eq('id', id);
    if (selectedAnnex?.id === id) setSelectedAnnex(null);
    loadAnnexes();
    toast.success('Removido');
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── MODELOS DE CONTRATO ──────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <SectionTitle title="Modelos de contrato" />

        <div className="grid grid-cols-5 gap-5">
          {/* Lista */}
          <div className="col-span-2 space-y-2">
            {templates.map(t => (
              <div key={t.id} onClick={() => setSelected(t)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border ${selected?.id === t.id ? 'bg-primary/8 border-primary/20' : 'hover:bg-muted border-transparent'}`}>
                {editId === t.id ? (
                  <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEditName(); if (e.key === 'Escape') setEditId(null); }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 h-7 px-2 text-sm border border-primary rounded-md focus:outline-none" />
                ) : (
                  <span className="flex-1 text-sm font-medium truncate">{t.name}</span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button onClick={() => toggleDefault(t)} title={t.is_default ? 'Remover padrão' : 'Padrão'}
                    className={`p-1 rounded transition-colors ${t.is_default ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}>
                    <Star className="w-3.5 h-3.5" fill={t.is_default ? 'currentColor' : 'none'} />
                  </button>
                  {editId === t.id ? (
                    <>
                      <button onClick={saveEditName} className="p-1 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditId(null)} className="p-1 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                    </>
                  ) : (
                    <button onClick={() => { setEditId(t.id); setEditName(t.name); }} className="p-1 text-muted-foreground hover:text-foreground text-xs">✏</button>
                  )}
                  <button onClick={() => deleteTemplate(t.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {templates.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum modelo</p>}
            <div className="flex gap-1.5 pt-2 border-t border-border">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTemplate(); }}
                placeholder="Nome do modelo..." className={inputCls + ' flex-1 h-8 text-xs'} />
              <button onClick={addTemplate} className="h-8 px-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="col-span-3">
            {selected ? (
              <div className="space-y-3">
                {/* Tags de referência */}
                <div className="p-3 bg-muted/30 border border-border/50 rounded-xl">
                  <p className={labelCls + ' mb-2'}>Tags disponíveis</p>
                  <div className="flex flex-wrap gap-1">
                    {TAGS.flat().map(tag => (
                      <span key={tag} className="text-[10px] font-mono bg-primary/8 text-primary border border-primary/20 px-1.5 py-0.5 rounded cursor-pointer hover:bg-primary/15"
                        onClick={() => navigator.clipboard.writeText(tag).then(() => toast.success('Copiado'))}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">Clique numa tag para copiar e colar no contrato</p>
                </div>
                <RichTextEditor
                  content={selected.content ?? ''}
                  onChange={html => {
                    setSelected(p => p ? { ...p, content: html } : p);
                    saveContent(selected.id, html);
                  }}
                  placeholder="Escreva o modelo do contrato aqui. Use as tags acima para preencher automaticamente..."
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
                <span className="text-3xl">📄</span>
                <p className="text-sm font-medium">Selecione um modelo à esquerda</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODELOS DE ANEXO ──────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <SectionTitle title="Modelos de anexo" />

        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-2 space-y-2">
            {annexes.map(a => (
              <div key={a.id} onClick={() => setSelectedAnnex(a)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border ${selectedAnnex?.id === a.id ? 'bg-primary/8 border-primary/20' : 'hover:bg-muted border-transparent'}`}>
                <span className="flex-1 text-sm font-medium truncate">{a.name}</span>
                <button onClick={e => { e.stopPropagation(); deleteAnnex(a.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {annexes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum modelo</p>}
            <div className="flex gap-1.5 pt-2 border-t border-border">
              <input value={newAnnexName} onChange={e => setNewAnnexName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addAnnex(); }}
                placeholder="Nome do modelo..." className={inputCls + ' flex-1 h-8 text-xs'} />
              <button onClick={addAnnex} className="h-8 px-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="col-span-3">
            {selectedAnnex ? (
              <RichTextEditor
                content={selectedAnnex.content ?? ''}
                onChange={html => {
                  setSelectedAnnex(p => p ? { ...p, content: html } : p);
                  saveAnnexContent(selectedAnnex.id, html);
                }}
                placeholder="Conteúdo do modelo de anexo..."
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
                <span className="text-3xl">📎</span>
                <p className="text-sm font-medium">Selecione um modelo de anexo</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
