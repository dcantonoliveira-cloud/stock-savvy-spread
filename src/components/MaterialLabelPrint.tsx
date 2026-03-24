import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer } from 'lucide-react';

export type LabelItem = {
  id: string;
  name: string;
  category: string;
  total_qty: number;
  unit: string;
};

type Props = {
  item: LabelItem | null;
  onClose: () => void;
  companyName?: string;
};

export function MaterialLabelPrint({ item, onClose, companyName = 'Rondello' }: Props) {
  const [copies, setCopies] = useState(1);

  if (!item) return null;

  const handlePrint = () => {
    // Grab the rendered QR SVG from the preview DOM and inject into the print window
    const qrEl = document.getElementById('mat-label-qr-preview');
    const qrSvg = qrEl ? qrEl.outerHTML : '';

    const labelBlock = `
      <div class="label">
        <div class="info">
          <div class="company">${companyName.toUpperCase()}</div>
          <div class="name">${item.name}</div>
          <div class="category">${item.category}</div>
          <div class="qty">${item.total_qty} ${item.unit}</div>
        </div>
        <div class="qr">${qrSvg}</div>
      </div>`;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 8cm 4cm landscape; margin: 0; }
  body { font-family: Arial, Helvetica, sans-serif; background: white; }
  .label {
    width: 8cm;
    height: 4cm;
    display: flex;
    align-items: center;
    padding: 3mm 3mm 3mm 4mm;
    gap: 3mm;
    page-break-after: always;
    overflow: hidden;
  }
  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    padding: 1mm 0;
  }
  .company {
    font-size: 6pt;
    color: #aaa;
    letter-spacing: 0.8px;
  }
  .name {
    font-size: 11pt;
    font-weight: bold;
    color: #000;
    line-height: 1.15;
    word-break: break-word;
  }
  .category {
    font-size: 7.5pt;
    color: #555;
  }
  .qty {
    font-size: 9pt;
    font-weight: bold;
    color: #000;
  }
  .qr {
    width: 3cm;
    height: 3cm;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .qr svg {
    width: 3cm !important;
    height: 3cm !important;
  }
</style>
</head>
<body>
  ${Array(copies).fill(labelBlock).join('')}
</body>
</html>`;

    const win = window.open('', '_blank', 'width=600,height=400');
    if (!win) {
      alert('Pop-up bloqueado. Permita pop-ups para este site e tente novamente.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  };

  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Etiqueta — {item.name}
          </DialogTitle>
        </DialogHeader>

        {/* ── Label preview ── */}
        <div className="flex justify-center my-2">
          <div>
            <p className="text-[10px] text-muted-foreground text-center mb-2 uppercase tracking-wider">
              Preview · 8 × 4 cm · Impressora Térmica
            </p>
            {/* Preview container scaled to ~340×170 px (representing 8cm×4cm) */}
            <div className="border border-dashed border-border rounded-sm shadow-sm">
              <div
                style={{
                  width: 340,
                  height: 170,
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 10px 10px 16px',
                  gap: 10,
                  boxSizing: 'border-box',
                }}
              >
                {/* Text area */}
                <div style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%',
                  padding: '4px 0',
                }}>
                  <div style={{ fontSize: 9, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {companyName}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 'bold', color: '#000', lineHeight: 1.2 }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#666' }}>
                    {item.category}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 'bold', color: '#000' }}>
                    {item.total_qty} {item.unit}
                  </div>
                </div>

                {/* QR code */}
                <div style={{ width: 120, height: 120, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QRCodeSVG
                    id="mat-label-qr-preview"
                    value={item.id}
                    size={114}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Copies ── */}
        <div className="flex items-center gap-3 px-1 mb-2">
          <Label className="text-sm flex-shrink-0">Cópias</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={copies}
            onChange={e => setCopies(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="w-20 h-8 text-center"
          />
          <p className="text-xs text-muted-foreground">
            {copies === 1
              ? 'Uma etiqueta'
              : `${copies} etiquetas idênticas`}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 gold-button" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir{copies > 1 ? ` (${copies}×)` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
