import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Plus, ClipboardList, ChevronDown, ChevronUp, Loader2, Check, ChevronsUpDown,
  Lock, Unlock, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fmtCur, fmtDate } from '@/lib/format';

type Cotacao = {
  id: string; titulo: string; status: string; data_criacao: string;
  itens: CotacaoItem[];
};
type CotacaoItem = {
  id: string; item_id: string; item_name: string; unidade_medida: string;
  quantidade_necessaria: number;
  respostas: Resposta[];
};
type Resposta = {
  id: string; fornecedor_id: string; fornecedor_nome: string;
  preco_cotado: number | null; prazo_entrega_dias: number | null; observacao: string | null;
};
type StockOption    = { id: string; name: string; unit: string };
type FornOption     = { id: string; nome: string };

export default function CotacoesPage() {
  const [cotacoes, setCotacoes]     = useState<Cotacao[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<string | null>(null);

  const [stockOptions, setStockOptions]   = useState<StockOption[]>([]);
  const [fornOptions, setFornOptions]     = useState<FornOption[]>([]);

  // Nova cotação dialog
  const [newOpen, setNewOpen]       = useState(false);
  const [newTitulo, setNewTitulo]   = useState('');
  const [creating, setCreating]     = useState(false);

  // Adicionar item a cotação
  const [addItemOpen, setAddItemOpen]   = useState<string | null>(null); // cotacao_id
  const [addItemId, setAddItemId]       = useState<string | null>(null);
  const [addQtd, setAddQtd]            = useState('');
  const [addUnidade, setAddUnidade]     = useState('');
  const [addItemCombo, setAddItemCombo] = useState(false);
  const [savingItem, setSavingItem]     = useState(false);

  // Resposta inline
  const [editingResp, setEditingResp]   = useState<{cotacaoItemId: string; fornId: string} | null>(null);
  const [respPreco, setRespPreco]       = useState('');
  const [respPrazo, setRespPrazo]       = useState('');
  const [respObs, setRespObs]           = useState('');
  const [savingResp, setSavingResp]     = useState(false);

  // Adicionar fornecedor a resposta
  const [addFornOpen, setAddFornOpen]   = useState<string | null>(null); // cotacao_item_id
  const [addFornId, setAddFornId]       = useState<string | null>(null);
  const [addFornCombo, setAddFornCombo] = useState(false);

  useEffect(() => { load(); loadOptions(); }, []);

  const load = async () => {
    setLoading(true);
    const { data: cots } = await (supabase.from('cotacoes' as any) as any)
      .select('id,titulo,status,data_criacao')
      .order('data_criacao', { ascending: false });

    const { data: itens } = await (supabase.from('cotacao_itens' as any) as any)
      .select('id,cotacao_id,item_id,quantidade_necessaria,unidade_medida,stock_items(name)');

    const { data: resps } = await (supabase.from('cotacao_respostas' as any) as any)
      .select('id,cotacao_item_id,fornecedor_id,preco_cotado,prazo_entrega_dias,observacao,fornecedores(nome)');

    const respMap: Record<string, Resposta[]> = {};
    for (const r of (resps || []) as any[]) {
      if (!respMap[r.cotacao_item_id]) respMap[r.cotacao_item_id] = [];
      respMap[r.cotacao_item_id].push({
        id: r.id, fornecedor_id: r.fornecedor_id,
        fornecedor_nome: (r.fornecedores as any)?.nome || '?',
        preco_cotado: r.preco_cotado, prazo_entrega_dias: r.prazo_entrega_dias,
        observacao: r.observacao,
      });
    }

    const itemMap: Record<string, CotacaoItem[]> = {};
    for (const i of (itens || []) as any[]) {
      if (!itemMap[i.cotacao_id]) itemMap[i.cotacao_id] = [];
      itemMap[i.cotacao_id].push({
        id: i.id, item_id: i.item_id,
        item_name: (i.stock_items as any)?.name || '?',
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
    const [{ data: si }, { data: fo }] = await Promise.all([
      supabase.from('stock_items').select('id,name,unit').order('name').range(0, 9999),
      (supabase.from('fornecedores' as any) as any).select('id,nome').eq('status','ativo').order('nome'),
    ]);
    setStockOptions((si || []) as StockOption[]);
    setFornOptions((fo || []) as FornOption[]);
  };

  const createCotacao = async () => {
    if (!newTitulo.trim()) { toast.error('Título é obrigatório'); return; }
    setCreating(true);
    const { error } = await (supabase.from('cotacoes' as any) as any).insert({ titulo: newTitulo.trim() });
    if (error) { toast.error('Erro ao criar'); setCreating(false); return; }
    toast.success('Cotação criada!');
    setCreating(false);
    setNewOpen(false);
    setNewTitulo('');
    load();
  };

  const toggleStatus = async (c: Cotacao) => {
    const newStatus = c.status === 'aberta' ? 'fechada' : 'aberta';
    await (supabase.from('cotacoes' as any) as any).update({ status: newStatus }).eq('id', c.id);
    // Se fechando: aplicar menores preços em item_suppliers
    if (newStatus === 'fechada') {
      for (const item of c.itens) {
        const menorResp = item.respostas
          .filter(r => r.preco_cotado != null && r.preco_cotado > 0)
          .sort((a, b) => (a.preco_cotado ?? 0) - (b.preco_cotado ?? 0))[0];
        if (!menorResp) continue;
        // Verifica se já existe vínculo
        const { data: existing } = await (supabase.from('item_suppliers' as any) as any)
          .select('id').eq('item_id', item.item_id).eq('fornecedor_id', menorResp.fornecedor_id).single();
        if (existing) {
          await (supabase.from('item_suppliers' as any) as any)
            .update({ unit_price: menorResp.preco_cotado })
            .eq('id', (existing as any).id);
        } else {
          const { data: forn } = await (supabase.from('fornecedores' as any) as any)
            .select('nome').eq('id', menorResp.fornecedor_id).single();
          await (supabase.from('item_suppliers' as any) as any).insert({
            item_id: item.item_id, fornecedor_id: menorResp.fornecedor_id,
            supplier_name: (forn as any)?.nome || '', unit_price: menorResp.preco_cotado,
          });
        }
      }
      toast.success('Cotação fechada! Preços vencedores aplicados.');
    } else {
      toast.success('Cotação reaberta.');
    }
    load();
  };

  const addItem = async () => {
    if (!addItemId || !addQtd || !addUnidade) { toast.error('Preencha todos os campos'); return; }
    setSavingItem(true);
    await (supabase.from('cotacao_itens' as any) as any).insert({
      cotacao_id: addItemOpen, item_id: addItemId,
      quantidade_necessaria: parseFloat(addQtd), unidade_medida: addUnidade,
    });
    setSavingItem(false);
    setAddItemOpen(null); setAddItemId(null); setAddQtd(''); setAddUnidade('');
    toast.success('Insumo adicionado!');
    load();
  };

  const addFornecedor = async () => {
    if (!addFornId || !addFornOpen) return;
    await (supabase.from('cotacao_respostas' as any) as any).insert({
      cotacao_item_id: addFornOpen, fornecedor_id: addFornId,
    });
    setAddFornOpen(null); setAddFornId(null);
    load();
  };

  const saveResposta = async () => {
    if (!editingResp) return;
    setSavingResp(true);
    await (supabase.from('cotacao_respostas' as any) as any)
      .update({
        preco_cotado:       respPreco ? parseFloat(respPreco) : null,
        prazo_entrega_dias: respPrazo ? parseInt(respPrazo) : null,
        observacao:         respObs.trim() || null,
      })
      .eq('cotacao_item_id', editingResp.cotacaoItemId)
      .eq('fornecedor_id', editingResp.fornId);
    setSavingResp(false);
    setEditingResp(null);
    toast.success('Preço salvo!');
    load();
  };

  const openEditResp = (cotacaoItemId: string, r: Resposta) => {
    setEditingResp({ cotacaoItemId, fornId: r.fornecedor_id });
    setRespPreco(r.preco_cotado != null ? String(r.preco_cotado) : '');
    setRespPrazo(r.prazo_entrega_dias != null ? String(r.prazo_entrega_dias) : '');
    setRespObs(r.observacao || '');
  };

  const addItemSi = stockOptions.find(s => s.id === addItemId);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Cotações</h1>
          <p className="text-muted-foreground mt-1 text-sm">{cotacoes.length} cotaç{cotacoes.length !== 1 ? 'ões' : 'ão'}</p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="flex-shrink-0 gap-2">
          <Plus className="w-4 h-4" />Nova cotação
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-xl border border-border animate-pulse" />
          ))}
        </div>
      ) : cotacoes.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-16 text-center text-muted-foreground">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Nenhuma cotação criada ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {cotacoes.map(cot => {
            const isExp = expanded === cot.id;
            return (
              <div key={cot.id} className="bg-white rounded-xl border border-border overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpanded(isExp ? null : cot.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-foreground">{cot.titulo}</span>
                      <Badge variant={cot.status === 'aberta' ? 'default' : 'secondary'} className="text-xs">
                        {cot.status === 'aberta' ? 'Aberta' : 'Fechada'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtDate(cot.data_criacao)} · {cot.itens.length} insumo{cot.itens.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm" variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={e => { e.stopPropagation(); toggleStatus(cot); }}
                    >
                      {cot.status === 'aberta'
                        ? <><Lock className="w-3 h-3" />Fechar</>
                        : <><Unlock className="w-3 h-3" />Reabrir</>
                      }
                    </Button>
                    {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded: matriz */}
                {isExp && (
                  <div className="border-t border-border">
                    {cot.itens.length === 0 ? (
                      <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                        Nenhum insumo adicionado.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[600px]">
                          <thead>
                            <tr className="text-xs border-b border-border" style={{ background: 'hsl(40 30% 97%)' }}>
                              <th className="text-left px-5 py-2.5 font-semibold text-muted-foreground">INSUMO</th>
                              <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">QTDE</th>
                              {/* Colunas dinâmicas por fornecedor */}
                              {Array.from(new Set(cot.itens.flatMap(i => i.respostas.map(r => r.fornecedor_id))))
                                .map(fid => {
                                  const nome = cot.itens.flatMap(i => i.respostas).find(r => r.fornecedor_id === fid)?.fornecedor_nome || '?';
                                  return <th key={fid} className="text-right px-4 py-2.5 font-semibold text-muted-foreground">{nome}</th>;
                                })
                              }
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {cot.itens.map(item => {
                              const fornIds = Array.from(new Set(cot.itens.flatMap(i => i.respostas.map(r => r.fornecedor_id))));
                              const precos  = item.respostas.map(r => r.preco_cotado).filter((p): p is number => p != null && p > 0);
                              const menorPreco = precos.length ? Math.min(...precos) : null;
                              return (
                                <tr key={item.id} className="hover:bg-amber-50/20">
                                  <td className="px-5 py-3">
                                    <span className="font-medium">{item.item_name}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                                    {item.quantidade_necessaria} {item.unidade_medida}
                                  </td>
                                  {fornIds.map(fid => {
                                    const resp = item.respostas.find(r => r.fornecedor_id === fid);
                                    const isBest = resp?.preco_cotado != null && resp.preco_cotado === menorPreco;
                                    if (!resp) return <td key={fid} className="px-4 py-3 text-center text-muted-foreground/30 text-xs">—</td>;
                                    return (
                                      <td key={fid} className={`px-4 py-3 text-right ${isBest ? 'bg-emerald-50' : ''}`}>
                                        {editingResp?.cotacaoItemId === item.id && editingResp?.fornId === fid ? (
                                          <div className="flex flex-col gap-1 items-end">
                                            <Input type="number" step="0.01" value={respPreco}
                                              onChange={e => setRespPreco(e.target.value)}
                                              className="h-7 text-xs w-24 text-right" placeholder="Preço" />
                                            <Input type="number" value={respPrazo}
                                              onChange={e => setRespPrazo(e.target.value)}
                                              className="h-7 text-xs w-24 text-right" placeholder="Prazo (dias)" />
                                            <div className="flex gap-1">
                                              <Button size="sm" className="h-6 text-xs px-2" onClick={saveResposta} disabled={savingResp}>
                                                {savingResp ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                                              </Button>
                                              <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={() => setEditingResp(null)}>
                                                <X className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => cot.status === 'aberta' && openEditResp(item.id, resp)}
                                            className={`text-right w-full ${cot.status !== 'aberta' ? 'cursor-default' : 'hover:underline cursor-pointer'}`}
                                          >
                                            {resp.preco_cotado != null ? (
                                              <span className={`font-medium text-sm ${isBest ? 'text-emerald-700' : ''}`}>
                                                {fmtCur(resp.preco_cotado)}
                                              </span>
                                            ) : (
                                              <span className="text-xs text-muted-foreground">Aguardando</span>
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

                    {/* Footer actions */}
                    {cot.status === 'aberta' && (
                      <div className="flex items-center gap-3 px-5 py-3 border-t border-border bg-muted/10">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                          onClick={() => { setAddItemOpen(cot.id); setAddItemId(null); setAddQtd(''); setAddUnidade(''); }}>
                          <Plus className="w-3 h-3" />Insumo
                        </Button>
                        {cot.itens.length > 0 && (
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                            onClick={() => { setAddFornOpen(cot.itens[0].id); setAddFornId(null); }}>
                            <Plus className="w-3 h-3" />Fornecedor
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Nova cotação */}
      <Dialog open={newOpen} onOpenChange={o => { if (!o) setNewOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova cotação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Título *</label>
              <Input value={newTitulo} onChange={e => setNewTitulo(e.target.value)} placeholder="Ex: Compras Setembro" autoFocus />
            </div>
            <Button className="w-full" onClick={createCotacao} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Criar cotação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adicionar insumo */}
      <Dialog open={!!addItemOpen} onOpenChange={o => { if (!o) setAddItemOpen(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar insumo à cotação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Insumo *</label>
              <Popover open={addItemCombo} onOpenChange={setAddItemCombo}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal text-sm">
                    <span className={cn('truncate', !addItemId && 'text-muted-foreground')}>
                      {addItemSi?.name || 'Selecionar...'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar..." />
                    <CommandList>
                      <CommandEmpty>Nenhum.</CommandEmpty>
                      <CommandGroup>
                        {stockOptions.map(s => (
                          <CommandItem key={s.id} value={s.name}
                            onSelect={() => { setAddItemId(s.id); setAddUnidade(s.unit); setAddItemCombo(false); }}>
                            <Check className={cn('mr-2 h-4 w-4', addItemId === s.id ? 'opacity-100' : 'opacity-0')} />
                            {s.name} <span className="text-xs text-muted-foreground ml-2">{s.unit}</span>
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
                <label className="text-sm text-muted-foreground mb-1 block">Quantidade *</label>
                <Input type="number" value={addQtd} onChange={e => setAddQtd(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Unidade *</label>
                <Input value={addUnidade} onChange={e => setAddUnidade(e.target.value)} placeholder="kg, un, cx..." />
              </div>
            </div>
            <Button className="w-full" onClick={addItem} disabled={savingItem}>
              {savingItem && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adicionar fornecedor à matriz */}
      <Dialog open={!!addFornOpen} onOpenChange={o => { if (!o) setAddFornOpen(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar fornecedor à cotação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Fornecedor *</label>
              <Popover open={addFornCombo} onOpenChange={setAddFornCombo}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal text-sm">
                    <span className={cn('truncate', !addFornId && 'text-muted-foreground')}>
                      {fornOptions.find(f => f.id === addFornId)?.nome || 'Selecionar...'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar..." />
                    <CommandList>
                      <CommandEmpty>Nenhum.</CommandEmpty>
                      <CommandGroup>
                        {fornOptions.map(f => (
                          <CommandItem key={f.id} value={f.nome}
                            onSelect={() => { setAddFornId(f.id); setAddFornCombo(false); }}>
                            <Check className={cn('mr-2 h-4 w-4', addFornId === f.id ? 'opacity-100' : 'opacity-0')} />
                            {f.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-xs text-muted-foreground">
              O fornecedor será adicionado a todos os insumos desta cotação com preço em aberto.
            </p>
            <Button className="w-full" onClick={addFornecedor} disabled={!addFornId}>
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
