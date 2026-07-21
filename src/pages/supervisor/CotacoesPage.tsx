import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, ClipboardList, ChevronDown, ChevronUp, Loader2,
  Lock, Unlock, Search, Check, X, Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { fmtCur, fmtDate } from '@/lib/format';

type Cotacao = {
  id: string; titulo: string; status: string; data_criacao: string;
  itens: CotacaoItem[];
};
type CotacaoItem = {
  id: string; item_id: string; item_name: string; unidade_medida: string;
  quantidade_necessaria: number; respostas: Resposta[];
};
type Resposta = {
  id: string; fornecedor_id: string; fornecedor_nome: string;
  preco_cotado: number | null; prazo_entrega_dias: number | null;
};
type FornOption  = { id: string; nome: string };
type StockItem   = { id: string; name: string; unit: string; category: string };

// ── Wizard state ─────────────────────────────────────────────
type WizardStep = 1 | 2;
type WizardState = {
  titulo: string;
  fornecedoresSelecionados: string[]; // ids
  // filtros passo 2
  filtroCategoria: string;
  filtroBusca: string;
  filtroFornecedor: string; // só insumos desse fornecedor
  itensSelecionados: Record<string, string>; // item_id → quantidade
};
const EMPTY_WIZARD: WizardState = {
  titulo: '', fornecedoresSelecionados: [],
  filtroCategoria: '', filtroBusca: '', filtroFornecedor: '',
  itensSelecionados: {},
};

export default function CotacoesPage() {
  const [cotacoes, setCotacoes]       = useState<Cotacao[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<string | null>(null);

  const [fornOptions, setFornOptions]   = useState<FornOption[]>([]);
  const [stockItems, setStockItems]     = useState<StockItem[]>([]);
  const [categorias, setCategorias]     = useState<string[]>([]);
  const [itemsByForn, setItemsByForn]   = useState<Record<string, string[]>>({}); // fornecedor_id → [item_id]

  // Wizard
  const [wizardOpen, setWizardOpen]     = useState(false);
  const [step, setStep]                 = useState<WizardStep>(1);
  const [wiz, setWiz]                   = useState<WizardState>(EMPTY_WIZARD);
  const [creating, setCreating]         = useState(false);

  // Edição inline de resposta
  const [editResp, setEditResp]         = useState<{itemId: string; fornId: string; preco: string; prazo: string} | null>(null);
  const [savingResp, setSavingResp]     = useState(false);

  useEffect(() => { load(); loadOptions(); }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: cots }, { data: itens }, { data: resps }] = await Promise.all([
      (supabase.from('cotacoes' as any) as any).select('id,titulo,status,data_criacao').order('data_criacao', { ascending: false }),
      (supabase.from('cotacao_itens' as any) as any).select('id,cotacao_id,item_id,quantidade_necessaria,unidade_medida,stock_items(name)'),
      (supabase.from('cotacao_respostas' as any) as any).select('id,cotacao_item_id,fornecedor_id,preco_cotado,prazo_entrega_dias,fornecedores(nome)'),
    ]);

    const respMap: Record<string, Resposta[]> = {};
    for (const r of (resps || []) as any[]) {
      if (!respMap[r.cotacao_item_id]) respMap[r.cotacao_item_id] = [];
      respMap[r.cotacao_item_id].push({
        id: r.id, fornecedor_id: r.fornecedor_id,
        fornecedor_nome: r.fornecedores?.nome || '?',
        preco_cotado: r.preco_cotado, prazo_entrega_dias: r.prazo_entrega_dias,
      });
    }
    const itemMap: Record<string, CotacaoItem[]> = {};
    for (const i of (itens || []) as any[]) {
      if (!itemMap[i.cotacao_id]) itemMap[i.cotacao_id] = [];
      itemMap[i.cotacao_id].push({
        id: i.id, item_id: i.item_id,
        item_name: i.stock_items?.name || '?',
        unidade_medida: i.unidade_medida,
        quantidade_necessaria: i.quantidade_necessaria,
        respostas: respMap[i.id] || [],
      });
    }
    setCotacoes(((cots || []) as any[]).map((c: any) => ({
      id: c.id, titulo: c.titulo, status: c.status, data_criacao: c.data_criacao,
      itens: itemMap[c.id] || [],
    })));
    setLoading(false);
  };

  const loadOptions = async () => {
    const [{ data: fo }, { data: si }, { data: isData }] = await Promise.all([
      (supabase.from('fornecedores' as any) as any).select('id,nome').eq('status','ativo').order('nome'),
      supabase.from('stock_items').select('id,name,unit,category').order('name').range(0, 9999),
      (supabase.from('item_suppliers' as any) as any).select('fornecedor_id,item_id').not('fornecedor_id','is',null),
    ]);
    setFornOptions((fo || []) as FornOption[]);
    const items = (si || []) as StockItem[];
    setStockItems(items);
    setCategorias([...new Set(items.map(s => s.category).filter(Boolean))].sort());

    const map: Record<string, string[]> = {};
    for (const r of (isData || []) as any[]) {
      if (!map[r.fornecedor_id]) map[r.fornecedor_id] = [];
      map[r.fornecedor_id].push(r.item_id);
    }
    setItemsByForn(map);
  };

  // ── Wizard helpers ──────────────────────────────────────────
  const toggleForn = (id: string) => setWiz(w => ({
    ...w,
    fornecedoresSelecionados: w.fornecedoresSelecionados.includes(id)
      ? w.fornecedoresSelecionados.filter(f => f !== id)
      : [...w.fornecedoresSelecionados, id],
  }));

  const filteredItems = stockItems.filter(s => {
    const matchCat  = !wiz.filtroCategoria || s.category === wiz.filtroCategoria;
    const matchBusca = !wiz.filtroBusca || s.name.toLowerCase().includes(wiz.filtroBusca.toLowerCase());
    const matchForn  = !wiz.filtroFornecedor ||
      (itemsByForn[wiz.filtroFornecedor] || []).includes(s.id);
    return matchCat && matchBusca && matchForn;
  });

  const toggleItem = (id: string, unit: string) => setWiz(w => {
    const next = { ...w.itensSelecionados };
    if (next[id] !== undefined) { delete next[id]; } else { next[id] = '1'; }
    return { ...w, itensSelecionados: next };
  });

  const selectAll = () => {
    const next: Record<string, string> = { ...wiz.itensSelecionados };
    for (const s of filteredItems) { if (next[s.id] === undefined) next[s.id] = '1'; }
    setWiz(w => ({ ...w, itensSelecionados: next }));
  };
  const deselectAll = () => {
    const ids = new Set(filteredItems.map(s => s.id));
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(wiz.itensSelecionados)) {
      if (!ids.has(k)) next[k] = v;
    }
    setWiz(w => ({ ...w, itensSelecionados: next }));
  };

  const totalSelecionado = Object.keys(wiz.itensSelecionados).length;

  const createCotacao = async () => {
    if (!wiz.titulo.trim()) { toast.error('Título obrigatório'); return; }
    if (wiz.fornecedoresSelecionados.length === 0) { toast.error('Selecione ao menos um fornecedor'); return; }
    if (totalSelecionado === 0) { toast.error('Selecione ao menos um insumo'); return; }
    setCreating(true);

    const { data: cot, error } = await (supabase.from('cotacoes' as any) as any)
      .insert({ titulo: wiz.titulo.trim() }).select().single();
    if (error || !cot) { toast.error('Erro ao criar cotação'); setCreating(false); return; }
    const cotId = (cot as any).id;

    // Inserir itens
    const itemsPayload = Object.entries(wiz.itensSelecionados).map(([item_id, qtd]) => {
      const si = stockItems.find(s => s.id === item_id);
      return {
        cotacao_id: cotId, item_id,
        quantidade_necessaria: parseFloat(qtd) || 1,
        unidade_medida: si?.unit || 'un',
      };
    });
    const { data: itensCreated, error: eIt } = await (supabase.from('cotacao_itens' as any) as any)
      .insert(itemsPayload).select('id');
    if (eIt) { toast.error('Erro ao inserir itens'); setCreating(false); return; }

    // Inserir respostas em branco para cada (item × fornecedor)
    const respsPayload: any[] = [];
    for (const ci of (itensCreated || []) as any[]) {
      for (const fid of wiz.fornecedoresSelecionados) {
        respsPayload.push({ cotacao_item_id: ci.id, fornecedor_id: fid });
      }
    }
    if (respsPayload.length > 0) {
      await (supabase.from('cotacao_respostas' as any) as any).insert(respsPayload);
    }

    toast.success(`Cotação criada com ${totalSelecionado} insumos e ${wiz.fornecedoresSelecionados.length} fornecedores!`);
    setCreating(false);
    setWizardOpen(false);
    setWiz(EMPTY_WIZARD);
    setStep(1);
    load();
  };

  const toggleStatus = async (c: Cotacao) => {
    const newStatus = c.status === 'aberta' ? 'fechada' : 'aberta';
    await (supabase.from('cotacoes' as any) as any).update({ status: newStatus }).eq('id', c.id);
    if (newStatus === 'fechada') {
      // Aplicar menores preços vencedores
      let aplicados = 0;
      for (const item of c.itens) {
        const melhor = item.respostas
          .filter(r => r.preco_cotado != null && r.preco_cotado > 0)
          .sort((a, b) => (a.preco_cotado ?? 0) - (b.preco_cotado ?? 0))[0];
        if (!melhor) continue;
        const { data: ex } = await (supabase.from('item_suppliers' as any) as any)
          .select('id').eq('item_id', item.item_id).eq('fornecedor_id', melhor.fornecedor_id).maybeSingle();
        if (ex) {
          await (supabase.from('item_suppliers' as any) as any)
            .update({ unit_price: melhor.preco_cotado }).eq('id', (ex as any).id);
        } else {
          await (supabase.from('item_suppliers' as any) as any).insert({
            item_id: item.item_id, fornecedor_id: melhor.fornecedor_id,
            supplier_name: melhor.fornecedor_nome, unit_price: melhor.preco_cotado,
          });
        }
        aplicados++;
      }
      toast.success(`Cotação fechada! ${aplicados} preço(s) atualizado(s).`);
    } else {
      toast.success('Cotação reaberta.');
    }
    load();
  };

  const saveResp = async () => {
    if (!editResp) return;
    setSavingResp(true);
    await (supabase.from('cotacao_respostas' as any) as any)
      .update({
        preco_cotado:       editResp.preco ? parseFloat(editResp.preco) : null,
        prazo_entrega_dias: editResp.prazo ? parseInt(editResp.prazo)  : null,
      })
      .eq('cotacao_item_id', editResp.itemId)
      .eq('fornecedor_id',   editResp.fornId);
    setSavingResp(false);
    setEditResp(null);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Cotações</h1>
          <p className="text-muted-foreground mt-1 text-sm">{cotacoes.length} cotaç{cotacoes.length !== 1 ? 'ões' : 'ão'}</p>
        </div>
        <Button onClick={() => { setWiz(EMPTY_WIZARD); setStep(1); setWizardOpen(true); }} className="flex-shrink-0 gap-2">
          <Plus className="w-4 h-4" />Nova cotação
        </Button>
      </div>

      {/* Lista de cotações */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-xl border border-border animate-pulse" />)}
        </div>
      ) : cotacoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-16 text-center text-muted-foreground">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Nenhuma cotação ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {cotacoes.map(cot => {
            const isExp = expanded === cot.id;
            // Fornecedores únicos nessa cotação
            const fornIds = [...new Set(cot.itens.flatMap(i => i.respostas.map(r => r.fornecedor_id)))];
            const fornNomes = [...new Set(cot.itens.flatMap(i => i.respostas.map(r => r.fornecedor_nome)))];

            return (
              <div key={cot.id} className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-muted/20"
                  onClick={() => setExpanded(isExp ? null : cot.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-semibold">{cot.titulo}</span>
                      <Badge variant={cot.status === 'aberta' ? 'default' : 'secondary'} className="text-xs">
                        {cot.status === 'aberta' ? 'Aberta' : 'Fechada'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtDate(cot.data_criacao)} · {cot.itens.length} insumo{cot.itens.length !== 1 ? 's' : ''} · {fornNomes.join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                      onClick={e => { e.stopPropagation(); toggleStatus(cot); }}>
                      {cot.status === 'aberta' ? <><Lock className="w-3 h-3" />Fechar e aplicar</> : <><Unlock className="w-3 h-3" />Reabrir</>}
                    </Button>
                    {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExp && (
                  <div className="border-t border-border overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead>
                        <tr className="text-xs border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                          <th className="text-left px-5 py-2.5 font-semibold text-muted-foreground">INSUMO</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">QTD</th>
                          {fornIds.map(fid => {
                            const nome = cot.itens.flatMap(i => i.respostas).find(r => r.fornecedor_id === fid)?.fornecedor_nome || '?';
                            return <th key={fid} className="text-right px-4 py-2.5 font-semibold text-muted-foreground min-w-[120px]">{nome}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {cot.itens.map(item => {
                          const precos  = item.respostas.map(r => r.preco_cotado).filter((p): p is number => p != null && p > 0);
                          const menorP  = precos.length ? Math.min(...precos) : null;
                          return (
                            <tr key={item.id} className="hover:bg-amber-50/20">
                              <td className="px-5 py-2.5 font-medium">{item.item_name}</td>
                              <td className="px-3 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                                {item.quantidade_necessaria} {item.unidade_medida}
                              </td>
                              {fornIds.map(fid => {
                                const resp   = item.respostas.find(r => r.fornecedor_id === fid);
                                const isBest = resp?.preco_cotado != null && resp.preco_cotado === menorP;
                                const isEditing = editResp?.itemId === item.id && editResp?.fornId === fid;
                                if (!resp) return <td key={fid} className="px-4 py-2.5 text-center text-muted-foreground/30 text-xs">—</td>;
                                return (
                                  <td key={fid} className={`px-4 py-2.5 text-right ${isBest ? 'bg-emerald-50' : ''}`}>
                                    {isEditing ? (
                                      <div className="flex flex-col gap-1 items-end">
                                        <Input type="number" step="0.01" value={editResp.preco}
                                          onChange={e => setEditResp(r => r && ({ ...r, preco: e.target.value }))}
                                          className="h-7 text-xs w-28 text-right" placeholder="Preço R$" autoFocus />
                                        <Input type="number" value={editResp.prazo}
                                          onChange={e => setEditResp(r => r && ({ ...r, prazo: e.target.value }))}
                                          className="h-7 text-xs w-28 text-right" placeholder="Prazo (dias)" />
                                        <div className="flex gap-1">
                                          <Button size="sm" className="h-6 text-xs px-2" onClick={saveResp} disabled={savingResp}>
                                            {savingResp ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={() => setEditResp(null)}>
                                            <X className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        disabled={cot.status !== 'aberta'}
                                        onClick={() => setEditResp({ itemId: item.id, fornId: fid, preco: resp.preco_cotado != null ? String(resp.preco_cotado) : '', prazo: resp.prazo_entrega_dias != null ? String(resp.prazo_entrega_dias) : '' })}
                                        className={`w-full text-right ${cot.status === 'aberta' ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                                      >
                                        {resp.preco_cotado != null ? (
                                          <span className={`font-semibold ${isBest ? 'text-emerald-700' : ''}`}>
                                            {fmtCur(resp.preco_cotado)}
                                            {isBest && <span className="block text-[10px] font-normal text-emerald-600">✓ Menor</span>}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-muted-foreground italic">Preencher</span>
                                        )}
                                        {resp.prazo_entrega_dias && (
                                          <span className="block text-xs text-muted-foreground">{resp.prazo_entrega_dias}d</span>
                                        )}
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Wizard ─────────────────────────────────────────── */}
      <Dialog open={wizardOpen} onOpenChange={o => { if (!o) setWizardOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {step === 1 ? 'Nova cotação — Passo 1: Fornecedores' : `Nova cotação — Passo 2: Insumos (${totalSelecionado} selecionado${totalSelecionado !== 1 ? 's' : ''})`}
            </DialogTitle>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Nome da cotação *</label>
                <Input value={wiz.titulo} onChange={e => setWiz(w => ({ ...w, titulo: e.target.value }))}
                  placeholder="Ex: Compras semana 30" autoFocus />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  Fornecedores que vão cotar * ({wiz.fornecedoresSelecionados.length} selecionado{wiz.fornecedoresSelecionados.length !== 1 ? 's' : ''})
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {fornOptions.map(f => {
                    const sel = wiz.fornecedoresSelecionados.includes(f.id);
                    return (
                      <button key={f.id}
                        onClick={() => toggleForn(f.id)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                          sel ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          sel ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                        }`}>
                          {sel && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-sm font-medium truncate">{f.nome}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={() => setStep(2)}
                  disabled={!wiz.titulo.trim() || wiz.fornecedoresSelecionados.length === 0}>
                  Próximo — Selecionar insumos
                </Button>
                <Button variant="outline" onClick={() => setWizardOpen(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3 overflow-hidden flex-1 min-h-0">
              {/* Filtros */}
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input value={wiz.filtroBusca}
                    onChange={e => setWiz(w => ({ ...w, filtroBusca: e.target.value }))}
                    placeholder="Buscar insumo..." className="pl-8 h-8 text-sm" />
                </div>
                <select
                  value={wiz.filtroCategoria}
                  onChange={e => setWiz(w => ({ ...w, filtroCategoria: e.target.value }))}
                  className="h-8 text-sm border border-border rounded-md px-2 bg-white text-foreground"
                >
                  <option value="">Todas as categorias</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={wiz.filtroFornecedor}
                  onChange={e => setWiz(w => ({ ...w, filtroFornecedor: e.target.value }))}
                  className="h-8 text-sm border border-border rounded-md px-2 bg-white text-foreground"
                >
                  <option value="">Todos os fornecedores</option>
                  {fornOptions.filter(f => wiz.fornecedoresSelecionados.includes(f.id)).map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={selectAll}>
                  <Check className="w-3 h-3" />Sel. todos ({filteredItems.length})
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={deselectAll}>
                  <X className="w-3 h-3" />Desmarcar
                </Button>
              </div>

              {/* Lista de insumos com checkbox */}
              <div className="flex-1 overflow-y-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ background: 'hsl(40 30% 97%)' }}>
                    <tr className="border-b border-border text-xs">
                      <th className="w-10 px-3 py-2" />
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">INSUMO</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">CATEGORIA</th>
                      <th className="text-center px-3 py-2 font-semibold text-muted-foreground">UNIDADE</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground w-24">QUANTIDADE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredItems.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">Nenhum insumo encontrado.</td></tr>
                    ) : filteredItems.map(s => {
                      const sel = wiz.itensSelecionados[s.id] !== undefined;
                      return (
                        <tr key={s.id}
                          className={`cursor-pointer transition-colors ${sel ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                          onClick={() => toggleItem(s.id, s.unit)}
                        >
                          <td className="px-3 py-2 text-center">
                            <div className={`w-4 h-4 rounded border mx-auto flex items-center justify-center ${
                              sel ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                            }`}>
                              {sel && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{s.category}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground text-xs">{s.unit}</td>
                          <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                            {sel && (
                              <Input
                                type="number" min="0" step="0.01"
                                value={wiz.itensSelecionados[s.id] || ''}
                                onChange={e => setWiz(w => ({
                                  ...w, itensSelecionados: { ...w.itensSelecionados, [s.id]: e.target.value }
                                }))}
                                className="h-6 text-xs text-right w-20 ml-auto"
                                placeholder="Qtd"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep(1)}>← Voltar</Button>
                <Button className="flex-1" onClick={createCotacao} disabled={creating || totalSelecionado === 0}>
                  {creating
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Criando...</>
                    : `Criar cotação com ${totalSelecionado} insumo${totalSelecionado !== 1 ? 's' : ''}`
                  }
                </Button>
                <Button variant="outline" onClick={() => setWizardOpen(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
