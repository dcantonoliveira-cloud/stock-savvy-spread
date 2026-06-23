import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Check, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';

interface Item { id: string; name: string }

interface Props {
  label: string;
  table: string;                      // 'event_locations' | 'event_products' | 'suppliers'
  typeFilter?: string;                // for suppliers: 'organizer' | 'decorator' etc.
  valueId: string | null;
  valueName: string;                  // fallback text (legacy data)
  onChangeId: (id: string | null) => void;
  onChangeName: (name: string) => void;
  createLabel?: string;
}

export default function LinkedField({
  label, table, typeFilter, valueId, valueName, onChangeId, onChangeName, createLabel,
}: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState(valueName);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Load items
  const load = async () => {
    let q = supabase.from(table as any).select('id, name').order('name');
    if (typeFilter) q = (q as any).eq('type', typeFilter);
    const { data } = await q;
    setItems((data ?? []) as Item[]);
  };

  useEffect(() => { load(); }, [table, typeFilter]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync external valueName → query
  useEffect(() => { setQuery(valueName); }, [valueName]);

  const filtered = items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()));
  const selected = items.find(i => i.id === valueId);

  const select = (item: Item) => {
    onChangeId(item.id);
    onChangeName(item.name);
    setQuery(item.name);
    setOpen(false);
  };

  const clear = () => {
    onChangeId(null);
    onChangeName('');
    setQuery('');
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

  const inputCls =
    'w-full h-10 pl-3 pr-8 text-sm bg-background border border-border rounded-lg ' +
    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

  return (
    <div ref={ref} className="relative">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5">
        {label}
      </label>

      <div className="flex gap-1.5">
        {/* Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); onChangeId(null); onChangeName(e.target.value); }}
            onFocus={() => setOpen(true)}
            placeholder={`Buscar ${label.toLowerCase()}...`}
            className={inputCls}
          />
          {/* Right icon */}
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {valueId && (
              <button type="button" onClick={clear} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
            {!valueId && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50" />}
          </span>
        </div>

        {/* Add new button */}
        <button
          type="button"
          onClick={() => { setCreating(true); setOpen(false); setNewName(''); }}
          className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-border hover:bg-primary/5 hover:border-primary/30 transition-colors text-primary"
          title={`Criar novo(a) ${label.toLowerCase()}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-10 z-50 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
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

      {/* Inline create form */}
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
