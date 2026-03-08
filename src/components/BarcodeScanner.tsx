import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export default function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const scannerId = 'barcode-reader';
    let scanner: Html5Qrcode;

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 120 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            onScan(decodedText);
            scanner.stop().catch(() => {});
            onClose();
          },
          () => {}
        );
      } catch (err) {
        console.error('Scanner error:', err);
        setError('Não foi possível acessar a câmera. Verifique as permissões.');
      }
    };

    // Small delay to ensure the DOM element exists
    const timer = setTimeout(startScanner, 300);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Scanner de Código de Barras
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-4">
          {error ? (
            <div className="text-center py-8">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </div>
          ) : (
            <>
              <div id="barcode-reader" className="rounded-xl overflow-hidden bg-card" />
              <p className="text-xs text-muted-foreground text-center mt-3">
                Aponte a câmera para o código de barras do produto
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
