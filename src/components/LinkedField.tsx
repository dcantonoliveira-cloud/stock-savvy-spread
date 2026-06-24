import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Check, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';

interface Item { id: string; name: string }

interface Props {
  label: string;
  table: string;
  typeFilter?: string;
  valueId: string | null;
  valueName: string;
  onChangeId: (id: string | null) => void;
  onChangeName: (name: string) => void;
  createLabel?: string;
}

const inputCls =
  'w-full h-10 pl-3 pr-8 text-sm bg-background border border-border rounded-lg ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

export default function LinkedField({
  label, table, typeFilter, valueId, valueName, onChangeId, onChangeName, createLabel,
}: Props) {
  const [items, setItems]       = useState<Item[]>([]);
  const [search, setSearch]     = useState('');   // what user is actively typing
  const [typing, setTyping]     = useState(false); // true while user has focus + typed
  const [open, setOpen]         = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    let q = supabase.from(table as any).select('id, name').order('name');
    if (typeFilter) q = (q as any).eq('type', typeFilter);
    const { data } = await q;
    setItems((data ?? []) as Item[]);
  };

  useEffect(() => { load(); }, [table, typeFilter]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setTyping(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // O valor resolvido: se há seleção, usa o nome do item; caso contrário usa valueName
  const selected = items.find(i => i.id === valueId);
  const resolvedName = selected?.name ?? valueName ?? '';

  // O que o input mostra: se o usuário está digitando, mostra o search; senão o nome resolvido
  const displayValue = typing ? search : resolvedName;

  // Filtragem do dropdown
  const filterText = typing ? search : '';
  const filtered = filterText
    ? items.filter(i => i.name.toLowerCase().includes(filterText.toLowerCase()))
    : items;

  const select = (item: Item) => {
    onChangeId(item.id);
    onChangeName(item.name);
    setTyping(false);
    setSearch('');
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeId(null);
    onChangeName('');
    setSearch('');
    setTyping(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setTyping(true);
    setOpen(true);
    // Limpa a seleção enquanto digita
    if (valueId) { onChangeId(null); onChangeName(e.target.value); }
  };

  const create = async () => {
    if (!newName.trim()) return;
    const insert: any = { name: newName.trim() };
    if (typeFilter) insert.type = typeFilter;
    const { data, error } = await supabase.from(table as any).insert(insert).select('id, name').single();
    if (error) { toast.error('Erro ao criar: ' + error.message); return; }
    await load();
    select(data as Item);
    setCreating(false);
    setNewName('');
    toast.success(`${createLabel ?? label} criado(a)!`);
  };

  return (
    <div ref={ref} className="relative">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">
        {label}
      </label>

      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={displayValue}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            placeholder={`Buscar ${label.toLowerCase()}...`}
            className={inputCls + (selected ? ' font-medium' : '')}
            style={{ fontSize: displayValue.length > 28 ? '11px' : displayValue.length > 20 ? '12px' : undefined }}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {(valueId || resolvedName) ? (
              <button type="button" onClick={clear} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={() => { setCreating(true); setOpen(false); setNewName(''); }}
          className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-border hover:bg-primary/5 hover:border-primary/30 transition-colors text-primary"
          title={`Criar novo(a) ${label.toLowerCase()}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-10 z-50 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">
              Nenhum resultado. Use <strong>+</strong> para criar.
            </p>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => select(item)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
              >
                <span>{item.name}</span>
                {item.id === valueId && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}

      {creating && (
        <div className="mt-1.5 flex gap-1.5 p-3 bg-muted/30 border border-border rounded-xl">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setCreating(false); }}
            placeholder={`Nome do(a) ${label.toLowerCase()}...`}
            className="flex-1 h-8 px-2.5 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
          />
          <button type="button" onClick={create} className="h-8 px-3 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">Criar</button>
          <button type="button" onClick={() => setCreating(false)} className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
        </div>
      )}
    </div>
  );
}
