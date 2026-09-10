import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCompany } from '@/lib/companyCache';
import { printProductionQuote } from '@/utils/printProductionQuote';
import RichTextEditor from '@/components/RichTextEditor';
import { Plus, Search, FileDown, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';

interface Quote {
  id: string;
  name: string;
  quote_date: string;
  value: number | null;
  content: string | null;
}

const fmtDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
const fmtBRL = (v: number | null) => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5';
const BLANK = { name: '', quote_date: '', value: '', content: '' };

export function ProducaoOrcamentosTab() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from as any)('production_quotes')
      .select('id, name, quote_date, value, content')
      .eq('company_id', COMPANY_ID)
      .order('quote_date', { ascending: false });
    setQuotes(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ ...BLANK, quote_date: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (q: Quote) => {
    setForm({ name: q.name, quote_date: q.quote_date, value: q.value != null ? String(q.value) : '', content: q.content ?? '' });
    setEditingId(q.id);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.quote_date || !user) return;
    setSaving(true);
    const payload = {
      name: form.name,
      quote_date: form.quote_date,
      value: form.value ? parseFloat(form.value.replace(',', '.')) : null,
      content: form.content || null,
    };
    if (editingId) {
      const { error } = await (supabase.from as any)('production_quotes').update(payload).eq('id', editingId);
      if (error) { toast.error('Erro ao salvar orçamento'); setSaving(false); return; }
      toast.success('Orçamento atualizado!');
    } else {
      const { error } = await (supabase.from as any)('production_quotes')
        .insert({ company_id: COMPANY_ID, ...payload, created_by: user.id });
      if (error) { toast.error('Erro ao criar orçamento'); setSaving(false); return; }
      toast.success('Orçamento criado! Gerando o PDF...');
      try {
        const company = await getCompany();
        await printProductionQuote(payload, company);
      } catch {
        toast.error('Orçamento salvo, mas houve erro ao gerar o PDF. Use o botão de download na lista.');
      }
    }
    setSaving(false);
    setModalOpen(false);
    setEditingId(null);
    setForm(BLANK);
    load();
  };

  const deleteQuote = async (id: string) => {
    if (!confirm('Excluir este orçamento?')) return;
    const { error } = await (supabase.from as any)('production_quotes').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    setQuotes(prev => prev.filter(q => q.id !== id));
    toast.success('Orçamento excluído');
  };

  const handleGeneratePdf = async (q: Quote) => {
    setGeneratingId(q.id);
    try {
      const company = await getCompany();
      await printProductionQuote({ name: q.name, quote_date: q.quote_date, value: q.value, content: q.content }, company);
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingId(null);
    }
  };

  const filtered = quotes.filter(q => !search || q.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input className={inputCls + ' pl-8'} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={openNew}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Novo orçamento
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhum orçamento encontrado.</div>
      ) : (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                <th className="text-left px-5 py-3">Nome</th>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(q => (
                <tr key={q.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{q.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(q.quote_date)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmtBRL(q.value)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => handleGeneratePdf(q)} disabled={generatingId === q.id}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                        title="Gerar PDF">
                        {generatingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => openEdit(q)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteQuote(q.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setModalOpen(false); setEditingId(null); }}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <p className="font-semibold text-sm">{editingId ? 'Editar orçamento' : 'Novo orçamento de produção'}</p>
              <button onClick={() => { setModalOpen(false); setEditingId(null); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Nome *</label>
                <input className={inputCls} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Maria Silva - Aniversário" required autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Data *</label>
                  <input className={inputCls} type="date" value={form.quote_date}
                    onChange={e => setForm(p => ({ ...p, quote_date: e.target.value }))} required />
                </div>
                <div>
                  <label className={labelCls}>Valor (R$)</label>
                  <input className={inputCls} type="text" inputMode="decimal" value={form.value} placeholder="0,00"
                    onChange={e => setForm(p => ({ ...p, value: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Pedido</label>
                <RichTextEditor content={form.content} onChange={html => setForm(p => ({ ...p, content: html }))} placeholder="Descreva o pedido..." />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar orçamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
