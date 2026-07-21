import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Truck, Star, ExternalLink, Pencil, Trash2, Plus, Loader2,
  ChevronsUpDown, Check, Phone, Mail, FileText, Package, ThumbsUp, ThumbsDown,
  AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fmtCur, fmtDate, fmtNum } from '@/lib/format';

const CATEGORIAS = [
  { value: 'hortifruti',   label: 'Hortifruti' },
  { value: 'proteinas',    label: 'Proteínas' },
  { value: 'bebidas',      label: 'Bebidas' },
  { value: 'descartaveis', label: 'Descartáveis' },
  { value: 'embalagens',   label: 'Embalagens' },
  { value: 'outros',       label: 'Outros' },
];

type Fornecedor = {
  id: string; nome: string; cnpj: string | null;
  telefone: string | null; email: string | null;
  categoria: string | null; status: string; observacoes: string | null;
};

type ItemRow = {
  record_id: string; item_id: string; item_name: string; item_unit: string;
  unit_price: number; is_preferred: boolean; ativo: boolean; notes: string | null;
  pedido_minimo: number | null; prazo_entrega_dias: number | null; condicao_pagamento: string | null;
};

type StockOption  = { id: string; name: string; unit: string };
type Avaliacao    = { id: string; data: string; tipo: string; observacao: string | null };
type Scorecard    = { pct_pontualidade: number | null; pct_nao_conformidade: number | null; pct_atraso: number | null; total_avaliacoes: number };

type ItemFormState = {
  selectedItemId: string | null; unitPrice: string; isPreferred: boolean;
  notes: string; pedidoMinimo: string; prazoEntrega: string; condicaoPagamento: string;
};
const EMPTY_FORM: ItemFormState = {
  selectedItemId: null, unitPrice: '', isPreferred: false,
  notes: '', pedidoMinimo: '', prazoEntrega: '', condicaoPagamento: '',
};

type AvalForm = { tipo: string; observacao: string };

export default function FornecedorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';

  const [forn, setForn]             = useState<Fornecedor | null>(null);
  const [editingForn, setEditingForn] = useState(isNew);
  const [draft, setDraft]           = useState<Partial<Fornecedor>>({
    nome: '', cnpj: '', telefone: '', email: '', categoria: '', status: 'ativo', observacoes: '',
  });
  const [savingForn, setSavingForn]   = useState(false);

  const [items, setItems]           = useState<ItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(!isNew);
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [itemForm, setItemForm]     = useState<ItemFormState>(EMPTY_FORM);
  const [savingItem, setSavingItem] = useState(false);
  const [comboOpen, setComboOpen]   = useState(false);

  const [avaliacoes, setAvaliacoes]   = useState<Avaliacao[]>([]);
  const [scorecard, setScorecard]     = useState<Scorecard | null>(null);
  const [avalDialogOpen, setAvalDialogOpen] = useState(false);
  const [avalForm, setAvalForm]       = useState<AvalForm>({ tipo: 'entrega_no_prazo', observacao: '' });
  const [savingAval, setSavingAval]   = useState(false);

  useEffect(() => {
    if (!isNew && id) {
      loadFornecedor();
      loadItems();
      loadAvaliacoes();
    }
    loadStockOptions();
  }, [id]);

  const loadFornecedor = async () => {
    const { data } = await (supabase.from('fornecedores' as any) as any)
      .select('*').eq('id', id).single();
    if (data) { setForn(data as Fornecedor); setDraft(data as Fornecedor); }
  };

  const loadItems = async () => {
    setLoadingItems(true);
    const { data } = await (supabase.from('item_suppliers' as any) as any)
      .select('id,item_id,unit_price,is_preferred,ativo,notes,pedido_minimo,prazo_entrega_dias,condicao_pagamento,stock_items(name,unit)')
      .eq('fornecedor_id', id)
      .order('is_preferred', { ascending: false });
    setItems(((data || []) as any[]).map((r: any) => ({
      record_id:          r.id,
      item_id:            r.item_id,
      item_name:          r.stock_items?.name || '?',
      item_unit:          r.stock_items?.unit || '',
      unit_price:         r.unit_price ?? 0,
      is_preferred:       r.is_preferred ?? false,
      ativo:              r.ativo ?? true,
      notes:              r.notes,
      pedido_minimo:      r.pedido_minimo,
      prazo_entrega_dias: r.prazo_entrega_dias,
      condicao_pagamento: r.condicao_pagamento,
    })));
    setLoadingItems(false);
  };

  const loadStockOptions = async () => {
    const { data } = await supabase.from('stock_items').select('id,name,unit').order('name').range(0, 9999);
    setStockOptions((data || []) as StockOption[]);
  };

  const loadAvaliacoes = async () => {
    const [{ data: avals }, { data: sc }] = await Promise.all([
      (supabase.from('avaliacoes_fornecedor' as any) as any)
        .select('id,data,tipo,observacao')
        .eq('fornecedor_id', id)
        .order('data', { ascending: false })
        .limit(20),
      (supabase.from('vw_scorecard_fornecedor' as any) as any)
        .select('*').eq('fornecedor_id', id).single(),
    ]);
    setAvaliacoes((avals || []) as Avaliacao[]);
    setScorecard(sc as Scorecard | null);
  };

  // ── Fornecedor CRUD ──────────────────────────────────────────
  const saveFornecedor = async () => {
    if (!(draft.nome || '').trim()) { toast.error('Nome é obrigatório'); return; }
    setSavingForn(true);
    const payload = {
      nome:        (draft.nome || '').trim(),
      cnpj:        draft.cnpj || null,
      telefone:    draft.telefone || null,
      email:       draft.email   || null,
      categoria:   draft.categoria || null,
      status:      draft.status || 'ativo',
      observacoes: draft.observacoes || null,
    };
    if (isNew) {
      const { data, error } = await (supabase.from('fornecedores' as any) as any).insert(payload).select().single();
      if (error) { toast.error('Erro ao criar fornecedor'); setSavingForn(false); return; }
      toast.success('Fornecedor criado!');
      navigate(`/fornecedores/${(data as any).id}`, { replace: true });
    } else {
      const { error } = await (supabase.from('fornecedores' as any) as any).update(payload).eq('id', id);
      if (error) { toast.error('Erro ao salvar'); setSavingForn(false); return; }
      setForn({ ...forn!, ...payload });
      setEditingForn(false);
      toast.success('Dados atualizados!');
    }
    setSavingForn(false);
  };

  // ── Item CRUD ────────────────────────────────────────────────
  const openAddItem = () => { setEditingRecordId(null); setItemForm(EMPTY_FORM); setItemDialogOpen(true); };
  const openEditItem = (row: ItemRow) => {
    setEditingRecordId(row.record_id);
    setItemForm({
      selectedItemId:    row.item_id,
      unitPrice:         String(row.unit_price),
      isPreferred:       row.is_preferred,
      notes:             row.notes || '',
      pedidoMinimo:      row.pedido_minimo != null ? String(row.pedido_minimo) : '',
      prazoEntrega:      row.prazo_entrega_dias != null ? String(row.prazo_entrega_dias) : '',
      condicaoPagamento: row.condicao_pagamento || '',
    });
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.selectedItemId) { toast.error('Selecione um insumo'); return; }
    setSavingItem(true);
    const payload: any = {
      item_id:            itemForm.selectedItemId,
      fornecedor_id:      id,
      supplier_name:      forn?.nome || '',
      unit_price:         parseFloat(itemForm.unitPrice) || 0,
      is_preferred:       itemForm.isPreferred,
      notes:              itemForm.notes.trim() || null,
      pedido_minimo:      itemForm.pedidoMinimo ? parseFloat(itemForm.pedidoMinimo) : null,
      prazo_entrega_dias: itemForm.prazoEntrega ? parseInt(itemForm.prazoEntrega) : null,
      condicao_pagamento: itemForm.condicaoPagamento.trim() || null,
    };
    const { error } = editingRecordId
      ? await (supabase.from('item_suppliers' as any) as any).update(payload).eq('id', editingRecordId)
      : await (supabase.from('item_suppliers' as any) as any).insert(payload);
    if (error) { toast.error('Erro ao salvar'); setSavingItem(false); return; }
    toast.success(editingRecordId ? 'Item atualizado!' : 'Item adicionado!');
    setSavingItem(false);
    setItemDialogOpen(false);
    loadItems();
  };

  const handleDeleteItem = async (recordId: string) => {
    if (!confirm('Remover este insumo do fornecedor?')) return;
    await (supabase.from('item_suppliers' as any) as any).delete().eq('id', recordId);
    toast.success('Insumo removido');
    loadItems();
  };

  const handleInlinePrice = async (recordId: string, price: number) => {
    await (supabase.from('item_suppliers' as any) as any).update({ unit_price: price }).eq('id', recordId);
    setItems(prev => prev.map(i => i.record_id === recordId ? { ...i, unit_price: price } : i));
    toast.success('Preço atualizado!');
  };

  // ── Avaliação ────────────────────────────────────────────────
  const handleSaveAval = async () => {
    if (!avalForm.tipo) return;
    setSavingAval(true);
    const { error } = await (supabase.from('avaliacoes_fornecedor' as any) as any).insert({
      fornecedor_id: id,
      tipo:          avalForm.tipo,
      observacao:    avalForm.observacao.trim() || null,
    });
    if (error) { toast.error('Erro ao salvar avaliação'); setSavingAval(false); return; }
    toast.success('Avaliação registrada!');
    setSavingAval(false);
    setAvalDialogOpen(false);
    setAvalForm({ tipo: 'entrega_no_prazo', observacao: '' });
    loadAvaliacoes();
  };

  const tipoLabel = (t: string) => ({
    entrega_no_prazo:    'Entrega no prazo',
    entrega_atrasada:    'Entrega atrasada',
    produto_nao_conforme:'Produto não conforme',
    produto_ok:          'Produto OK',
  }[t] ?? t);

  const tipoIcon = (t: string) => {
    if (t === 'entrega_no_prazo' || t === 'produto_ok') return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
    return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
  };

  const selectedItemLabel = itemForm.selectedItemId
    ? stockOptions.find(s => s.id === itemForm.selectedItemId)?.name || 'Selecionar...'
    : 'Selecionar insumo...';

  if (!isNew && !forn && !editingForn) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayName = isNew ? (draft.nome || 'Novo Fornecedor') : (forn?.nome || '');

  return (
    <div>
      <button onClick={() => navigate('/fornecedores')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />Voltar para Fornecedores
      </button>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Truck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold gold-text">{displayName}</h1>
            {!isNew && forn && (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-muted-foreground text-sm">
                  {items.length} insumo{items.length !== 1 ? 's' : ''}
                </p>
                <Badge variant={forn.status === 'ativo' ? 'default' : 'secondary'} className="text-xs">
                  {forn.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
                {forn.categoria && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {CATEGORIAS.find(c => c.value === forn.categoria)?.label}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {!editingForn && !isNew && (
          <Button variant="outline" size="sm" onClick={() => setEditingForn(true)} className="gap-2 flex-shrink-0">
            <Pencil className="w-3.5 h-3.5" />Editar dados
          </Button>
        )}
      </div>

      {/* Scorecard KPIs (only when has avaliacoes) */}
      {!isNew && scorecard && scorecard.total_avaliacoes > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-border p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{scorecard.pct_pontualidade ?? 0}%</div>
            <div className="text-xs text-muted-foreground mt-0.5">Entregas no prazo</div>
          </div>
          <div className="bg-white rounded-xl border border-border p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{scorecard.pct_atraso ?? 0}%</div>
            <div className="text-xs text-muted-foreground mt-0.5">Atrasos</div>
          </div>
          <div className="bg-white rounded-xl border border-border p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{scorecard.pct_nao_conformidade ?? 0}%</div>
            <div className="text-xs text-muted-foreground mt-0.5">Não conformidade</div>
          </div>
        </div>
      )}

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-border p-5 mb-6">
        {editingForn ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nome *</label>
              <Input value={draft.nome || ''} onChange={e => setDraft(d => ({ ...d, nome: e.target.value }))} placeholder="Nome do fornecedor" autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">CNPJ</label>
              <Input value={draft.cnpj || ''} onChange={e => setDraft(d => ({ ...d, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Categoria</label>
              <Select value={draft.categoria || ''} onValueChange={v => setDraft(d => ({ ...d, categoria: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Telefone / WhatsApp</label>
              <Input value={draft.telefone || ''} onChange={e => setDraft(d => ({ ...d, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">E-mail</label>
              <Input value={draft.email || ''} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder="contato@fornecedor.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Status</label>
              <Select value={draft.status || 'ativo'} onValueChange={v => setDraft(d => ({ ...d, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Observações</label>
              <Input value={draft.observacoes || ''} onChange={e => setDraft(d => ({ ...d, observacoes: e.target.value }))} placeholder="Condições gerais, prazo padrão..." />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button onClick={saveFornecedor} disabled={savingForn} className="gap-2">
                {savingForn && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar dados
              </Button>
              {!isNew && <Button variant="outline" onClick={() => setEditingForn(false)}>Cancelar</Button>}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {forn?.telefone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>{forn.telefone}</span>
              </div>
            )}
            {forn?.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>{forn.email}</span>
              </div>
            )}
            {forn?.cnpj && (
              <div className="flex items-center gap-2.5 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">{forn.cnpj}</span>
              </div>
            )}
            {forn?.observacoes && (
              <div className="flex items-start gap-2.5 text-sm sm:col-span-2">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{forn.observacoes}</span>
              </div>
            )}
            {!forn?.telefone && !forn?.email && !forn?.cnpj && !forn?.observacoes && (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Nenhum dado de contato.{' '}
                <button className="text-primary underline" onClick={() => setEditingForn(true)}>Adicionar agora</button>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tabs: Insumos | Avaliações */}
      {!isNew && (
        <Tabs defaultValue="insumos">
          <div className="flex items-center justify-between mb-3">
            <TabsList>
              <TabsTrigger value="insumos" className="gap-1.5">
                <Package className="w-3.5 h-3.5" />Insumos ({items.length})
              </TabsTrigger>
              <TabsTrigger value="avaliacoes" className="gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5" />Avaliações ({avaliacoes.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── INSUMOS ─────────────────────────────────── */}
          <TabsContent value="insumos">
            <div className="flex justify-end mb-3">
              <Button size="sm" variant="outline" onClick={openAddItem} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />Adicionar insumo
              </Button>
            </div>
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground">INSUMO</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">PREÇO UNIT.</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">PED. MÍN.</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">PRAZO</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">PAGAMENTO</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground">PREF.</th>
                    <th className="w-28 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loadingItems ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        {[40, 15, 10, 10, 12, 5, 8].map((w, j) => (
                          <td key={j} className="px-5 py-3">
                            <div className="h-4 bg-muted/40 rounded animate-pulse" style={{ width: `${w}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">
                        Nenhum insumo cadastrado para este fornecedor.
                      </td>
                    </tr>
                  ) : items.map(row => (
                    <tr key={row.record_id} className={`hover:bg-amber-50/30 transition-colors ${!row.ativo ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3">
                        <span className="font-medium">{row.item_name}</span>
                        <span className="text-muted-foreground text-xs ml-1.5">({row.item_unit})</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-xs text-muted-foreground">R$</span>
                          <input
                            type="number" step="0.01" min="0"
                            defaultValue={row.unit_price}
                            onBlur={e => {
                              const v = parseFloat(e.target.value) || 0;
                              if (v !== row.unit_price) handleInlinePrice(row.record_id, v);
                            }}
                            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            className="w-24 text-right text-sm font-medium border border-transparent rounded px-1.5 py-0.5 hover:border-border focus:border-primary focus:outline-none bg-transparent focus:bg-white transition-all"
                          />
                          <span className="text-xs text-muted-foreground">/{row.item_unit}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {row.pedido_minimo != null ? fmtNum(row.pedido_minimo, 0) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground text-xs">
                        {row.prazo_entrega_dias != null ? `${row.prazo_entrega_dias}d` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {row.condicao_pagamento || '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.is_preferred
                          ? <Star className="w-4 h-4 text-amber-500 fill-amber-400 mx-auto" />
                          : <span className="text-muted-foreground/30 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="w-7 h-7" title="Ver insumo"
                            onClick={() => navigate(`/items/${row.item_id}`)}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEditItem(row)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive/60 hover:text-destructive"
                            onClick={() => handleDeleteItem(row.record_id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── AVALIAÇÕES ──────────────────────────────── */}
          <TabsContent value="avaliacoes">
            <div className="flex justify-end mb-3">
              <Button size="sm" variant="outline" onClick={() => setAvalDialogOpen(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />Nova avaliação
              </Button>
            </div>
            {avaliacoes.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground text-sm">
                Nenhuma avaliação registrada.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs" style={{ background: 'hsl(40 30% 97%)' }}>
                      <th className="text-left px-5 py-3 font-semibold text-muted-foreground">DATA</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">TIPO</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">OBSERVAÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {avaliacoes.map(a => (
                      <tr key={a.id}>
                        <td className="px-5 py-3 text-muted-foreground text-xs">{fmtDate(a.data)}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            {tipoIcon(a.tipo)}
                            <span className="text-xs font-medium">{tipoLabel(a.tipo)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{a.observacao || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={o => { if (!o) setItemDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRecordId ? 'Editar insumo' : 'Adicionar insumo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Insumo *</label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-sm">
                    <span className={cn('truncate', !itemForm.selectedItemId && 'text-muted-foreground')}>
                      {selectedItemLabel}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar insumo..." />
                    <CommandList>
                      <CommandEmpty>Nenhum insumo.</CommandEmpty>
                      <CommandGroup>
                        {stockOptions.map(si => (
                          <CommandItem key={si.id} value={si.name}
                            onSelect={() => { setItemForm(f => ({ ...f, selectedItemId: si.id })); setComboOpen(false); }}>
                            <Check className={cn('mr-2 h-4 w-4', itemForm.selectedItemId === si.id ? 'opacity-100' : 'opacity-0')} />
                            <span className="flex-1">{si.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">{si.unit}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Preço unitário (R$)</label>
                <Input type="number" step="0.01" value={itemForm.unitPrice}
                  onChange={e => setItemForm(f => ({ ...f, unitPrice: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Pedido mínimo</label>
                <Input type="number" value={itemForm.pedidoMinimo}
                  onChange={e => setItemForm(f => ({ ...f, pedidoMinimo: e.target.value }))} placeholder="—" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Prazo entrega (dias)</label>
                <Input type="number" value={itemForm.prazoEntrega}
                  onChange={e => setItemForm(f => ({ ...f, prazoEntrega: e.target.value }))} placeholder="—" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Cond. pagamento</label>
                <Input value={itemForm.condicaoPagamento}
                  onChange={e => setItemForm(f => ({ ...f, condicaoPagamento: e.target.value }))} placeholder="à vista, 30d..." />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Observações</label>
              <Input value={itemForm.notes}
                onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pref" checked={itemForm.isPreferred}
                onChange={e => setItemForm(f => ({ ...f, isPreferred: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="pref" className="text-sm cursor-pointer">Fornecedor preferido para este insumo</label>
            </div>
            <Button className="w-full" onClick={handleSaveItem} disabled={savingItem}>
              {savingItem && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingRecordId ? 'Salvar alterações' : 'Adicionar insumo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Avaliação Dialog */}
      <Dialog open={avalDialogOpen} onOpenChange={o => { if (!o) setAvalDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova avaliação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Tipo *</label>
              <Select value={avalForm.tipo} onValueChange={v => setAvalForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrega_no_prazo">✅ Entrega no prazo</SelectItem>
                  <SelectItem value="entrega_atrasada">⚠️ Entrega atrasada</SelectItem>
                  <SelectItem value="produto_ok">✅ Produto OK</SelectItem>
                  <SelectItem value="produto_nao_conforme">⚠️ Produto não conforme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Observação</label>
              <Input value={avalForm.observacao}
                onChange={e => setAvalForm(f => ({ ...f, observacao: e.target.value }))}
                placeholder="Opcional" />
            </div>
            <Button className="w-full" onClick={handleSaveAval} disabled={savingAval}>
              {savingAval && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Registrar avaliação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
