import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, X, CheckCircle2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao',   label: 'Cartão' },
  { value: 'pix',      label: 'Pix' },
  { value: 'evento',   label: 'Evento' },
];

const fmtDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y.slice(2)}`; };

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5';

export interface ProductionOrderFormValues {
  title: string;
  description: string;
  delivery_address: string;
  event_id: string;
  event_name: string;
  delivery_date: string;
  delivery_time: string;
  extra_value: string;
  payment_method: string;
}

const BLANK: ProductionOrderFormValues = {
  title: '', description: '', delivery_address: '', event_id: '', event_name: '',
  delivery_date: '', delivery_time: '', extra_value: '', payment_method: '',
};

interface EventOption { id: string; event_name: string; event_date: string }

/**
 * Modal de criar/editar um pedido de produção — mesmo formulário usado na tela Produção,
 * extraído pra poder ser aberto também a partir de um Orçamento de Produção já existente
 * (pré-preenchido com nome/data/valor/pedido, faltando só endereço, evento, horário e pagamento).
 */
export default function ProductionOrderFormModal({ open, orderId, initialValues, onClose, onSaved }: {
  open: boolean;
  /** Se informado, atualiza esse pedido em vez de criar um novo. */
  orderId?: string | null;
  initialValues?: Partial<ProductionOrderFormValues>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProductionOrderFormValues>(BLANK);
  const [saving, setSaving] = useState(false);
  const [eventSearch, setEventSearch] = useState('');
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm({ ...BLANK, ...initialValues });
    setEventSearch(initialValues?.event_name ?? '');
  }, [open]);

  useEffect(() => {
    if (eventSearch.length < 2) { setEventOptions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await (supabase.from as any)('events')
        .select('id, event_name, event_date')
        .ilike('event_name', `%${eventSearch}%`)
        .eq('company_id', COMPANY_ID)
        .order('event_date').limit(8);
      setEventOptions(data ?? []);
      setShowDrop(true);
    }, 300);
    return () => clearTimeout(t);
  }, [eventSearch]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.delivery_date) return;
    setSaving(true);
    const payload = {
      title:            form.title,
      description:      form.description || null,
      delivery_address: form.delivery_address || null,
      event_id:         form.event_id || null,
      delivery_date:    form.delivery_date,
      delivery_time:    form.delivery_time || null,
      extra_value:      form.extra_value ? parseFloat(form.extra_value.replace(',', '.')) : null,
      payment_method:   form.payment_method || null,
    };
    if (orderId) {
      const { error } = await (supabase.from as any)('production_orders').update(payload).eq('id', orderId);
      if (error) { toast.error('Erro ao salvar pedido: ' + error.message); setSaving(false); return; }
      toast.success('Pedido atualizado!');
    } else {
      const { error } = await (supabase.from as any)('production_orders').insert({ company_id: COMPANY_ID, ...payload, status: 'pending' });
      if (error) { toast.error('Erro ao criar pedido: ' + error.message); setSaving(false); return; }
      toast.success('Pedido criado!');
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <p className="font-semibold text-sm">{orderId ? 'Editar pedido' : 'Novo pedido de produção'}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Título *</label>
            <input className={inputCls} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Ex: Bolo de 3 andares, brigadeiros..." required />
          </div>

          <div>
            <label className={labelCls}>Descrição</label>
            <textarea className={inputCls + ' resize-none'} rows={4} value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Quantidade, sabor, detalhes..." />
          </div>

          <div>
            <label className={labelCls}>Endereço de entrega</label>
            <input className={inputCls} value={form.delivery_address}
              onChange={e => setForm(p => ({ ...p, delivery_address: e.target.value }))}
              placeholder="Rua, número, bairro..." />
          </div>

          <div ref={searchRef} className="relative">
            <label className={labelCls}>Evento (opcional)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input className={inputCls + ' pl-8'} value={eventSearch}
                onChange={e => { setEventSearch(e.target.value); if (!e.target.value) setForm(p => ({ ...p, event_id: '' })); }}
                onFocus={() => eventOptions.length > 0 && setShowDrop(true)}
                placeholder="Buscar evento..." />
            </div>
            {form.event_id && (
              <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Evento vinculado
              </p>
            )}
            {showDrop && eventOptions.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                {eventOptions.map(ev => (
                  <button key={ev.id} type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                    onClick={() => { setForm(p => ({ ...p, event_id: ev.id })); setEventSearch(ev.event_name); setShowDrop(false); }}>
                    <p className="text-sm font-medium">{ev.event_name}</p>
                    {ev.event_date && <p className="text-xs text-muted-foreground">{fmtDate(ev.event_date)}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data de entrega *</label>
              <input className={inputCls} type="date" value={form.delivery_date}
                onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Horário</label>
              <input className={inputCls} type="time" value={form.delivery_time}
                onChange={e => setForm(p => ({ ...p, delivery_time: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Valor do extra (R$)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input className={inputCls + ' pl-8'} type="text" inputMode="decimal"
                value={form.extra_value} placeholder="0,00"
                onChange={e => setForm(p => ({ ...p, extra_value: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Forma de pagamento</label>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_METHODS.map(({ value, label }) => (
                <button key={value} type="button"
                  onClick={() => setForm(p => ({ ...p, payment_method: p.payment_method === value ? '' : value }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    form.payment_method === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white text-muted-foreground border-border hover:border-primary/40'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? 'Salvando...' : orderId ? 'Salvar alterações' : 'Criar pedido'}
          </button>
        </form>
      </div>
    </div>
  );
}
