import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Props {
  totalValue: number | null;
  onConfirm: (fee: number) => void;
  onCancel: () => void;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PERCENT_PRESETS = [30, 50, 100];

export function CancelEventModal({ totalValue, onConfirm, onCancel }: Props) {
  const base = totalValue ?? 0;
  const [fee, setFee] = useState(() => (base * 0.3).toFixed(2).replace('.', ','));

  const feeNum = parseFloat(fee.replace(',', '.')) || 0;
  const pct = base > 0 ? (feeNum / base) * 100 : 0;

  const applyPreset = (p: number) => setFee(((base * p) / 100).toFixed(2).replace('.', ','));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="font-semibold text-foreground text-sm">Cancelar evento</p>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p>O valor do evento sai do faturamento do mês do evento. Se cobrar multa, ela entra como faturamento no mês de hoje (cancelamento).</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Valor da multa (R$) {base > 0 && <span className="text-muted-foreground/70">— evento vale {fmtBRL(base)}</span>}
            </label>
            <input
              type="text" inputMode="decimal" autoFocus
              value={fee}
              onChange={e => setFee(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder="0,00"
            />
            {base > 0 && <p className="text-[11px] text-muted-foreground mt-1">≈ {pct.toFixed(0)}% do valor do evento</p>}
          </div>

          {base > 0 && (
            <div className="flex gap-2">
              {PERCENT_PRESETS.map(p => (
                <button key={p} type="button" onClick={() => applyPreset(p)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
                  {p}%
                </button>
              ))}
              <button type="button" onClick={() => setFee('0')}
                className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
                Sem multa
              </button>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
            Voltar
          </button>
          <button onClick={() => onConfirm(Math.max(0, feeNum))}
            className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 transition-colors">
            Confirmar cancelamento
          </button>
        </div>
      </div>
    </div>
  );
}
