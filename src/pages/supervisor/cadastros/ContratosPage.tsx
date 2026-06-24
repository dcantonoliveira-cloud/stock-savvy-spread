import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Star, Check, X } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';

interface Template { id: string; name: string; content: string | null; is_default: boolean }
interface AnnexModel { id: string; name: string; content: string | null }

const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

const inputCls = 'h-8 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1';

const TAGS = [
  '[NOME DO CLIENTE]','[CPF DO CLIENTE]','[RG DO CLIENTE]','[ENDEREÇO DO CLIENTE]',
  '[QTD DE CONVIDADOS]','[TIPO DO CARDÁPIO]','[TIPO DO EVENTO]','[DATA DO EVENTO]',
  '[HORA CERIMONIA]','[LOCAL DO EVENTO]','[TEMPO DE FESTA]','[VALOR DO FRETE]',
  '[VALOR POR CONVIDADO]','[VALOR TOTAL DO EVENTO]',
  '[NOME DA TESTEMUNHA 1]','[CPF DA TESTEMUNHA 1]','[NOME DA TESTEMUNHA 2]','[CPF DA TESTEMUNHA 2]',
  '[DIA DE HOJE]','[MÊS DE HOJE POR EXTENSO]','[ANO DE HOJE]',
];

function ListPanel({
  title, subtitle, items, selectedId, onSelect,
  newName, onNewName, onAdd,
  children,
}: {
  title: string; subtitle?: string;
  items: { id: string; name: string; badge?: string; isDefault?: boolean }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  newName: string; onNewName: (v: string) => void; onAdd: () => void;
  children?: (id: string) => React.ReactNode;
}) {
  return (
    <div className="w-60 shrink-0 border-r border-border flex flex-col bg-muted/10">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-bold text-foreground">{title}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 p-2 overflow-y-auto space-y-0.5">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum modelo ainda</p>
        )}
        {items.map(item => (
          <div key={item.id} onClick={() => onSelect(item.id)}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              selectedId === item.id ? 'bg-primary text-white' : 'hover:bg-muted'
            }`}>
            <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
            {item.isDefault && (
              <Star className={`w-3 h-3 shrink-0 ${selectedId === item.id ? 'text-white/70' : 'text-amber-400'}`} fill="currentColor" />
            )}
            {children && (
              <div onClick={e => e.stopPropagation()}>
                {children(item.id)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-border flex gap-1.5">
        <input value={newName} onChange={e => onNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onAdd(); }}
          placeholder="Nome do modelo..." className={inputCls + ' flex-1'} />
        <button onClick={onAdd}
          className="h-8 w-8 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center justify-center shrink-0">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function ContratosPage() {
  const [templates, setTemplates]       = useState<Template[]>([]);
  const [selected, setSelected]         = useState<Template | null>(null);
  const [newName, setNewName]           = useState('');
  const [editId, setEditId]             = useState<string | null>(null);
  const [editName, setEditName]         = useState('');
  const [annexes, setAnnexes]           = useState<AnnexModel[]>([]);
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

  return (
    <div className="space-y-5">

      {/* ── Explicação ─────────────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-2xl px-6 py-4">
        <p className="text-sm font-semibold mb-2">Modelos de contrato e de anexo</p>
        <div className="grid grid-cols-3 gap-6 text-xs text-muted-foreground">
          <div className="flex gap-2.5">
            <span className="text-primary font-bold text-base leading-none mt-0.5">1</span>
            <p>Crie um <strong className="text-foreground">modelo de contrato</strong> e escreva o texto completo que será usado nos eventos.</p>
          </div>
          <div className="flex gap-2.5">
            <span className="text-primary font-bold text-base leading-none mt-0.5">2</span>
            <p>Insira <strong className="text-foreground">tags entre colchetes</strong> (ex.: <code className="bg-muted px-1 py-0.5 rounded font-mono">[NOME DO CLIENTE]</code>) — elas são substituídas automaticamente ao gerar o contrato de um evento.</p>
          </div>
          <div className="flex gap-2.5">
            <span className="text-primary font-bold text-base leading-none mt-0.5">3</span>
            <p>Marque um modelo como <strong className="text-foreground">padrão</strong> com a estrela — ele será usado automaticamente ao gerar contratos nos eventos.</p>
          </div>
        </div>
      </div>

      {/* ── MODELOS DE CONTRATO ────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">

        {/* Cabeçalho do bloco */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
          <div>
            <p className="text-sm font-semibold">Modelos de contrato</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Selecione um modelo à esquerda para editar. O modelo padrão (⭐) é usado automaticamente nos eventos.
            </p>
          </div>
          {selected && (
            <div className="flex items-center gap-2 shrink-0">
              {editId === selected.id ? (
                <>
                  <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEditName(); if (e.key === 'Escape') setEditId(null); }}
                    className="h-8 px-2 text-sm border border-primary rounded-lg focus:outline-none w-44" />
                  <button onClick={saveEditName} className="h-8 w-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditId(null)} className="h-8 w-8 rounded-lg border border-border text-muted-foreground flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-muted-foreground">{selected.name}</span>
                  <button onClick={() => { setEditId(selected.id); setEditName(selected.name); }}
                    className="h-8 px-2.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors">Renomear</button>
                  <button onClick={() => toggleDefault(selected)}
                    className={`h-8 px-2.5 text-xs rounded-lg flex items-center gap-1.5 border transition-colors ${selected.is_default ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-border hover:bg-muted text-muted-foreground'}`}>
                    <Star className="w-3 h-3" fill={selected.is_default ? 'currentColor' : 'none'} />
                    {selected.is_default ? 'Padrão' : 'Definir padrão'}
                  </button>
                  <button onClick={() => deleteTemplate(selected.id)}
                    className="h-8 px-2.5 text-xs border border-border rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-destructive transition-colors text-muted-foreground flex items-center gap-1">
                    <Trash2 className="w-3 h-3" />Remover
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Layout esquerda / direita */}
        <div className="flex" style={{ minHeight: 520 }}>

          {/* Esquerda — lista */}
          <div className="w-56 shrink-0 border-r border-border flex flex-col bg-muted/10" style={{ height: 520 }}>
            <div className="flex-1 min-h-0 p-2 overflow-y-auto space-y-0.5">
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum modelo ainda</p>
              )}
              {templates.map(t => (
                <button key={t.id} onClick={() => setSelected(t)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    selected?.id === t.id ? 'bg-primary text-white' : 'hover:bg-muted text-foreground'
                  }`}>
                  <span className="flex-1 text-sm font-medium truncate">{t.name}</span>
                  {t.is_default && (
                    <Star className={`w-3 h-3 shrink-0 ${selected?.id === t.id ? 'text-white/70' : 'text-amber-400'}`} fill="currentColor" />
                  )}
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-border flex gap-1.5 shrink-0">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTemplate(); }}
                placeholder="Novo modelo..." className={inputCls + ' flex-1'} />
              <button onClick={addTemplate}
                className="h-8 w-8 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center justify-center shrink-0">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Direita — editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selected ? (
              <>
                {/* Tags */}
                <div className="px-5 py-3 border-b border-border bg-muted/10">
                  <p className={labelCls}>Tags disponíveis — clique para copiar</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {TAGS.map(tag => (
                      <span key={tag}
                        onClick={() => navigator.clipboard.writeText(tag).then(() => toast.success('Copiado!'))}
                        className="text-[10px] font-mono bg-primary/8 text-primary border border-primary/20 px-1.5 py-0.5 rounded cursor-pointer hover:bg-primary/15 transition-colors">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Editor */}
                <div className="flex-1 p-5">
                  <RichTextEditor
                    content={selected.content ?? ''}
                    onChange={html => {
                      setSelected(p => p ? { ...p, content: html } : p);
                      saveContent(selected.id, html);
                    }}
                    placeholder="Escreva o texto do contrato aqui. Use as tags acima para inserir dados automaticamente..."
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-3 p-10">
                <span className="text-4xl">📄</span>
                <div>
                  <p className="text-sm font-semibold mb-1">Selecione um modelo</p>
                  <p className="text-xs">Escolha um modelo à esquerda para editar seu conteúdo,<br />ou crie um novo pelo campo abaixo da lista.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODELOS DE ANEXO ───────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
          <div>
            <p className="text-sm font-semibold">Modelos de anexo</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Textos de anexos contratuais que podem ser adicionados a qualquer evento após gerar o contrato.
            </p>
          </div>
          {selectedAnnex && (
            <button onClick={() => deleteAnnex(selectedAnnex.id)}
              className="h-8 px-2.5 text-xs border border-border rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-destructive transition-colors text-muted-foreground flex items-center gap-1">
              <Trash2 className="w-3 h-3" />Remover
            </button>
          )}
        </div>

        <div className="flex" style={{ minHeight: 380 }}>

          {/* Esquerda — lista */}
          <div className="w-56 shrink-0 border-r border-border flex flex-col bg-muted/10" style={{ height: 380 }}>
            <div className="flex-1 min-h-0 p-2 overflow-y-auto space-y-0.5">
              {annexes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum modelo ainda</p>
              )}
              {annexes.map(a => (
                <button key={a.id} onClick={() => setSelectedAnnex(a)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    selectedAnnex?.id === a.id ? 'bg-primary text-white' : 'hover:bg-muted text-foreground'
                  }`}>
                  <span className="flex-1 text-sm font-medium truncate">{a.name}</span>
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-border flex gap-1.5 shrink-0">
              <input value={newAnnexName} onChange={e => setNewAnnexName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addAnnex(); }}
                placeholder="Novo modelo..." className={inputCls + ' flex-1'} />
              <button onClick={addAnnex}
                className="h-8 w-8 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center justify-center shrink-0">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Direita — editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedAnnex ? (
              <div className="flex-1 p-5">
                <RichTextEditor
                  content={selectedAnnex.content ?? ''}
                  onChange={html => {
                    setSelectedAnnex(p => p ? { ...p, content: html } : p);
                    saveAnnexContent(selectedAnnex.id, html);
                  }}
                  placeholder="Escreva o conteúdo do modelo de anexo..."
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-3 p-10">
                <span className="text-4xl">📎</span>
                <div>
                  <p className="text-sm font-semibold mb-1">Selecione um modelo de anexo</p>
                  <p className="text-xs">Escolha à esquerda ou crie um novo.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
