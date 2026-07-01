import { useRef, useState, useEffect, useCallback } from 'react';
import { X, RotateCcw, PenLine, Type } from 'lucide-react';

interface Props {
  onConfirm: (method: 'drawn' | 'typed', data: string) => void;
  onCancel: () => void;
  employeeName: string;
  allowTyped?: boolean;
}

export default function SignaturePad({ onConfirm, onCancel, employeeName, allowTyped = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'drawn' | 'typed'>('drawn');
  const [typedName, setTypedName] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [declared, setDeclared] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // ── Canvas setup ────────────────────────────────────────────
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasDrawing(false);
  }, []);

  useEffect(() => {
    if (mode === 'drawn') {
      setTimeout(initCanvas, 50);
    }
  }, [mode, initCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setDrawing(true);
    lastPoint.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    if (lastPoint.current) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPoint.current = pos;
    setHasDrawing(true);
  };

  const endDraw = () => {
    setDrawing(false);
    lastPoint.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  const handleConfirm = () => {
    if (!declared) return;
    if (mode === 'drawn') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawing) return;
      const data = canvas.toDataURL('image/png');
      onConfirm('drawn', data);
    } else {
      if (!typedName.trim()) return;
      onConfirm('typed', typedName.trim());
    }
  };

  const canConfirm = declared && (mode === 'drawn' ? hasDrawing : typedName.trim().length >= 3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Assinar Holerite</h2>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Declaration */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={declared}
              onChange={e => setDeclared(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-primary cursor-pointer"
            />
            <span className="text-sm text-foreground leading-snug">
              Declaro que visualizei e recebi este holerite.
            </span>
          </label>

          {/* Mode selector */}
          {allowTyped && (
            <div className="flex gap-2">
              <button
                onClick={() => setMode('drawn')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  mode === 'drawn'
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}>
                <PenLine className="w-3.5 h-3.5" />
                Desenhar
              </button>
              <button
                onClick={() => setMode('typed')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  mode === 'typed'
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}>
                <Type className="w-3.5 h-3.5" />
                Digitar nome
              </button>
            </div>
          )}

          {/* Signature area */}
          {mode === 'drawn' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Assine no espaço abaixo</p>
                {hasDrawing && (
                  <button onClick={clearCanvas}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RotateCcw className="w-3 h-3" />
                    Limpar
                  </button>
                )}
              </div>
              <canvas
                ref={canvasRef}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
                className="w-full h-36 rounded-xl border-2 border-dashed border-border bg-slate-50 cursor-crosshair touch-none"
                style={{ display: 'block' }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Digite seu nome completo</p>
              <input
                type="text"
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                placeholder={employeeName}
                className="w-full border border-border rounded-xl px-4 py-3 text-lg font-signature focus:outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50"
                style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Confirmar assinatura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
