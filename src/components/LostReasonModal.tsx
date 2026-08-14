import { useState } from 'react';
import { X } from 'lucide-react';
import { LOST_REASONS } from '@/lib/lostReasons';

interface Props {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function LostReasonModal({ onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="font-semibold text-foreground text-sm">Motivo de não fechar</p>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          {LOST_REASONS.map(r => (
            <button
              key={r.key}
              onClick={() => setSelected(r.key)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm border transition-colors ${
                selected === r.key
                  ? 'bg-rose-50 border-rose-300 text-rose-700 font-medium'
                  : 'border-border text-foreground hover:bg-muted/40'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="flex-1 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
