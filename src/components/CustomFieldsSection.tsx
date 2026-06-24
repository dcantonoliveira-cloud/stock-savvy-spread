import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, GripVertical, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface FieldDef { id: string; name: string; sort_order: number; is_active: boolean }

interface Props {
  eventId: string;
  onSaveStatus?: (status: 'saving' | 'saved' | 'idle') => void;
}

const inputCls =
  'w-full h-10 px-3 text-sm bg-background border border-border rounded-lg ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5';

export default function CustomFieldsSection({ eventId, onSaveStatus }: Props) {
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [managing, setManaging] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const valuesRef = useRef<Record<string, string>>({});

  const loadDefs = async () => {
    const { data } = await supabase
      .from('event_field_definitions')
      .select('id, name, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order');
    setDefs((data ?? []) as FieldDef[]);
  };

  const loadValues = async () => {
    const { data } = await supabase
      .from('event_field_values')
      .select('field_id, value')
      .eq('event_id', eventId);
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => { map[r.field_id] = r.value ?? ''; });
    setValues(map);
  };

  useEffect(() => {
    loadDefs();
    loadValues();
  }, [eventId]);

  const persistValue = async (fieldId: string, value: string) => {
    onSaveStatus?.('saving');
    const { error } = await supabase.from('event_field_values').upsert(
      { event_id: eventId, field_id: fieldId, value },
      { onConflict: 'event_id,field_id' }
    );
    if (error) { onSaveStatus?.('idle'); toast.error('Erro ao salvar: ' + error.message); return; }
    onSaveStatus?.('saved');
    toast.success('Salvo com sucesso');
    setTimeout(() => onSaveStatus?.('idle'), 2000);
  };

  const saveValue = (fieldId: string, value: string) => {
    valuesRef.current = { ...valuesRef.current, [fieldId]: value };
    setValues(prev => ({ ...prev, [fieldId]: value }));
    if (timersRef.current[fieldId]) clearTimeout(timersRef.current[fieldId]);
    timersRef.current[fieldId] = setTimeout(() => persistValue(fieldId, valuesRef.current[fieldId]), 1500);
  };

  const addField = async () => {
    if (!newFieldName.trim()) return;
    const maxOrder = defs.length > 0 ? Math.max(...defs.map(d => d.sort_order)) + 10 : 10;
    const { error } = await supabase
      .from('event_field_definitions')
      .insert({ name: newFieldName.trim(), sort_order: maxOrder });
    if (error) { toast.error('Erro: ' + error.message); return; }
    setNewFieldName('');
    await loadDefs();
    toast.success('Campo criado para todos os eventos!');
  };

  const deactivateField = async (id: string) => {
    if (!confirm('Remover este campo de todos os eventos desta empresa?')) return;
    await supabase.from('event_field_definitions').update({ is_active: false }).eq('id', id);
    await loadDefs();
    toast.success('Campo removido.');
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Detalhes da Festa</span>
        <div className="flex-1 h-px bg-border" />
        <button
          onClick={() => setManaging(v => !v)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
            managing
              ? 'bg-primary/10 border-primary/20 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Settings className="w-3 h-3" />
          {managing ? 'Concluir' : 'Gerenciar campos'}
        </button>
      </div>

      {/* Managing mode */}
      {managing && (
        <div className="mb-5 p-4 bg-muted/30 border border-border rounded-xl space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            Estes campos são <strong>compartilhados por todos os eventos</strong> da sua empresa.
            Adições e remoções afetam todos.
          </p>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {defs.map(def => (
              <div key={def.id} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-lg group">
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                <span className="flex-1 text-sm">{def.name}</span>
                <button
                  onClick={() => deactivateField(def.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add new field */}
          <div className="flex gap-1.5 pt-2">
            <input
              type="text"
              value={newFieldName}
              onChange={e => setNewFieldName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addField(); }}
              placeholder="Nome do novo campo..."
              className="flex-1 h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
            />
            <button
              onClick={addField}
              className="h-9 px-3 flex items-center gap-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Fields grid */}
      {defs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhum campo definido. Clique em <strong>Gerenciar campos</strong> para adicionar.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {defs.map(def => (
            <div key={def.id}>
              <label className={labelCls}>{def.name}</label>
              <input
                type="text"
                value={values[def.id] ?? ''}
                onChange={e => saveValue(def.id, e.target.value)}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
