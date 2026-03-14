import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Merge, Trash2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type Item = {
  id: string; name: string; category: string; unit: string;
  current_stock: number; min_stock: number; unit_cost: number;
};

type DuplicateGroup = {
  canonical: Item;
  duplicates: Item[];
  reason: string;
  confidence: 'high' | 'medium' | 'low';
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: Item[];
  onDone: () => void;
};

export default function DuplicateReviewDialog({ open, onClose, items, onDone }: Props) {
  const [step, setStep] = useState<'idle' | 'analyzing' | 'review' | 'merging' | 'done'>('idle');
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [progress, setProgress] = useState('');

  const analyze = async () => {
    setStep('analyzing');
    setProgress('Enviando itens para análise...');

    try {
      // Limit to 500 items to avoid API limits
      const itemsToAnalyze = items.slice(0, 500);
      const itemList = itemsToAnalyze.map(i => `${i.id}|${i.name}|${i.unit}`).join('\n');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: `Você é um assistente especializado em análise de estoque de buffet.
Analise a lista de itens e identifique grupos de duplicatas ou itens muito similares que deveriam ser unificados.
Responda APENAS com JSON válido, sem texto adicional, sem markdown, sem explicações fora do JSON.`,
          messages: [{
            role: 'user',
            content: `Analise estes itens de estoque e identifique duplicatas (itens com numeração como "ABOBRINHA 1", "ABOBRINHA 2" que são o mesmo produto, ou nomes quase idênticos):

${itemList}

Formato da lista: ID|NOME|UNIDADE

Responda SOMENTE com este JSON (sem markdown):
{"groups":[{"canonical_id":"uuid","duplicate_ids":["uuid1"],"reason":"motivo curto","confidence":"high"}]}`
          }]
        })
      });

      setProgress('Processando resultados...');
      const data = await response.json();
      const text = data.content?.[0]?.text || '{"groups":[]}';

      let parsed: any;
      try {
        const clean = text.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { groups: [] };
      }

      const result: DuplicateGroup[] = [];
      for (const g of (parsed.groups || [])) {
        const canonical = items.find(i => i.id === g.canonical_id);
        const duplicates = (g.duplicate_ids || []).map((id: string) => items.find(i => i.id === id)).filter(Boolean) as Item[];
        if (canonical && duplicates.length > 0) {
          result.push({ canonical, duplicates, reason: g.reason, confidence: g.confidence });
        }
      }

      setGroups(result);
      setSelected(new Set(result.map((_, i) => i).filter(i => result[i].confidence === 'high')));
      setExpanded(new Set([0]));
      setStep('review');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao analisar duplicatas');
      setStep('idle');
    }
  };

  const toggleGroup = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleExpand = (idx: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const merge = async () => {
    if (selected.size === 0) { toast.error('Selecione pelo menos um grupo'); return; }
    setStep('merging');

    let mergedCount = 0;
    let errorCount = 0;

    for (const idx of selected) {
      const group = groups[idx];
      try {
        for (const dup of group.duplicates) {
          const { data: sheetItems } = await supabase
            .from('technical_sheet_items')
            .select('id, sheet_id, quantity')
            .eq('item_id', dup.id as any);

          for (const si of (sheetItems || [])) {
            const { data: existing } = await supabase
              .from('technical_sheet_items')
              .select('id, quantity')
              .eq('sheet_id', si.sheet_id as any)
              .eq('item_id', group.canonical.id as any)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('technical_sheet_items')
                .update({ quantity: (existing.quantity as number) + ((si.quantity as number) || 0) } as any)
                .eq('id', existing.id as any);
              await supabase.from('technical_sheet_items').delete().eq('id', si.id as any);
            } else {
              await supabase
                .from('technical_sheet_items')
                .update({ item_id: group.canonical.id } as any)
                .eq('id', si.id as any);
            }
          }

          await supabase.from('stock_entries').update({ item_id: group.canonical.id } as any).eq('item_id', dup.id as any);
          await supabase.from('stock_outputs').update({ item_id: group.canonical.id } as any).eq('item_id', dup.id as any);

          if (dup.current_stock > 0) {
            await supabase
              .from('stock_items')
              .update({ current_stock: group.canonical.current_stock + dup.current_stock } as any)
              .eq('id', group.canonical.id as any);
          }

          await supabase.from('stock_items').delete().eq('id', dup.id as any);
          mergedCount++;
        }
      } catch (err) {
        console.error('Erro ao unificar grupo', idx, err);
        errorCount++;
      }
    }

    if (mergedCount > 0) toast.success(`${mergedCount} itens unificados com sucesso!`);
    if (errorCount > 0) toast.error(`${errorCount} grupos com erro`);

    setStep('done');
    onDone();
  };

  const reset = () => {
    setStep('idle');
    setGroups([]);
    setSelected(new Set());
    onClose();
  };

  const confidenceColor = (c: string) => {
    if (c === 'high') return 'bg-destructive/20 text-destructive border-destructive/30';
    if (c === 'medium') return 'bg-warning/20 text-warning border-warning/30';
    return 'bg-muted text-muted-foreground border-border';
  };

  const confidenceLabel = (c: string) => {
    if (c === 'high') return 'Alta certeza';
    if (c === 'medium') return 'Média certeza';
    return 'Baixa certeza';
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Revisar Duplicatas com IA
          </DialogTitle>
          <DialogDescription>
            A IA analisa até 500 itens do estoque e identifica possíveis duplicatas para unificação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === 'idle' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-medium">Pronto para analisar</p>
                <p className="text-sm text-muted-foreground mt-1">
                  A IA vai comparar os itens e sugerir grupos de duplicatas.<br />
                  Você poderá revisar e confirmar antes de qualquer alteração.
                </p>
              </div>
              <Button onClick={analyze} className="mt-2">
                <Sparkles className="w-4 h-4 mr-2" />
                Analisar Duplicatas
              </Button>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">{progress}</p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-3 py-2">
              {groups.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
                  <p className="font-medium text-foreground">Nenhuma duplicata encontrada!</p>
                  <p className="text-sm text-muted-foreground">Seu estoque parece estar bem organizado.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-1 mb-2">
                    <p className="text-sm text-muted-foreground">{groups.length} grupos encontrados · {selected.size} selecionados</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelected(new Set(groups.map((_, i) => i)))}>
                        Todos
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                        Limpar
                      </Button>
                    </div>
                  </div>

                  {groups.map((group, idx) => (
                    <div key={idx} className={`rounded-xl border transition-all ${selected.has(idx) ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}>
                      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => toggleGroup(idx)}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected.has(idx) ? 'bg-primary border-primary' : 'border-border'}`}>
                          {selected.has(idx) && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground text-sm">{group.canonical.name}</span>
                            <Badge variant="outline" className="text-[10px]">principal</Badge>
                            <Badge variant="outline" className={`text-[10px] ${confidenceColor(group.confidence)}`}>
                              {confidenceLabel(group.confidence)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{group.reason}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="flex-shrink-0 w-7 h-7" onClick={e => { e.stopPropagation(); toggleExpand(idx); }}>
                          {expanded.has(idx) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>

                      {expanded.has(idx) && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Será unificado com:</p>
                          {group.duplicates.map(dup => (
                            <div key={dup.id} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                              <Trash2 className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground">{dup.name}</p>
                                <p className="text-xs text-muted-foreground">{dup.unit} · Estoque: {dup.current_stock}</p>
                              </div>
                              {dup.current_stock > 0 && (
                                <Badge variant="outline" className="text-[10px] text-success border-success/30">
                                  +{dup.current_stock} transferido
                                </Badge>
                              )}
                            </div>
                          ))}
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                            <Merge className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground">{group.canonical.name} <span className="text-xs text-muted-foreground">(fica no estoque)</span></p>
                              <p className="text-xs text-muted-foreground">Fichas técnicas serão atualizadas automaticamente</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {step === 'merging' && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Unificando itens e atualizando fichas técnicas...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-8 text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto" />
              <div>
                <p className="font-medium text-foreground">Unificação concluída!</p>
                <p className="text-sm text-muted-foreground mt-1">Fichas técnicas atualizadas com sucesso.</p>
              </div>
              <Button onClick={reset}>Fechar</Button>
            </div>
          )}
        </div>

        {step === 'review' && groups.length > 0 && (
          <div className="border-t border-border pt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              Esta ação não pode ser desfeita
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={merge} disabled={selected.size === 0}>
                <Merge className="w-4 h-4 mr-2" />
                Unificar {selected.size} grupo{selected.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
