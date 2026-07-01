import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib';

export interface AuditData {
  signature_id: string;
  signature_hash: string;
  document_hash: string;
  employee_name: string;
  company_name: string;
  payslip_title: string;
  signed_at_utc: string;
  signed_at_local: string;
  timezone: string;
  ip_address: string;
  browser: string;
  os: string;
  device_type: string;
  document_version: number;
  sig_method: 'drawn' | 'typed';
  sig_data: string;
}

// ── SHA-256 via Web Crypto ────────────────────────────────────
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Generate signed PDF (original + audit page) ───────────────
export async function generateSignedPdf(originalBytes: ArrayBuffer, audit: AuditData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const gray = rgb(0.4, 0.4, 0.4);
  const dark = rgb(0.1, 0.1, 0.1);
  const teal = rgb(0.05, 0.58, 0.53);
  const lightBg = rgb(0.97, 0.98, 0.98);

  // Header bar
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: teal });
  page.drawText('COMPROVANTE DE ASSINATURA ELETRÔNICA', {
    x: 40, y: height - 45, size: 16, font: helveticaBold, color: rgb(1, 1, 1),
  });
  page.drawText('Documento gerado automaticamente pelo sistema', {
    x: 40, y: height - 65, size: 9, font: helvetica, color: rgb(0.9, 0.98, 0.97),
  });

  let y = height - 110;

  const section = (title: string) => {
    page.drawText(title.toUpperCase(), {
      x: 40, y, size: 8, font: helveticaBold, color: teal,
    });
    y -= 6;
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: rgb(0.85, 0.9, 0.9) });
    y -= 14;
  };

  const row = (label: string, value: string) => {
    page.drawText(label, { x: 40, y, size: 9, font: helveticaBold, color: gray });
    page.drawText(value, { x: 200, y, size: 9, font: helvetica, color: dark });
    y -= 16;
  };

  // Documento
  section('Documento');
  row('Holerite', audit.payslip_title);
  row('Empresa', audit.company_name);
  row('Versão do documento', `v${audit.document_version}`);
  y -= 4;

  // Signatário
  section('Signatário');
  row('Funcionário', audit.employee_name);
  row('Data/hora (UTC)', audit.signed_at_utc);
  row('Data/hora (local)', `${audit.signed_at_local} (${audit.timezone})`);
  row('Método de assinatura', audit.sig_method === 'drawn' ? 'Assinatura desenhada' : 'Nome digitado');
  y -= 4;

  // Dispositivo
  section('Dispositivo e Rede');
  row('Endereço IP', audit.ip_address);
  row('Navegador', audit.browser);
  row('Sistema operacional', audit.os);
  row('Tipo de dispositivo', audit.device_type === 'mobile' ? 'Mobile' : 'Desktop');
  y -= 4;

  // Integridade
  section('Integridade do Documento');
  row('Hash SHA-256 do PDF', truncHash(audit.document_hash));
  row('Hash da assinatura', truncHash(audit.signature_hash));
  row('Código único', audit.signature_id);
  y -= 4;

  // Assinatura visual (se desenhada)
  if (audit.sig_method === 'drawn') {
    section('Assinatura');
    try {
      const imgData = audit.sig_data.split(',')[1];
      const imgBytes = Uint8Array.from(atob(imgData), c => c.charCodeAt(0));
      const img = await pdfDoc.embedPng(imgBytes);
      const dims = img.scale(0.3);
      page.drawRectangle({ x: 40, y: y - dims.height - 4, width: dims.width + 8, height: dims.height + 8, color: lightBg });
      page.drawImage(img, { x: 44, y: y - dims.height, width: dims.width, height: dims.height });
      y -= dims.height + 20;
    } catch {
      row('Assinatura', 'Imagem indisponível');
    }
  } else {
    section('Assinatura');
    page.drawText(audit.sig_data, {
      x: 44, y, size: 18, font: helvetica, color: dark,
    });
    y -= 28;
  }

  // Declaration
  y -= 8;
  page.drawRectangle({ x: 40, y: y - 28, width: width - 80, height: 36, color: lightBg });
  page.drawText('✓  Declaro que visualizei e recebi este holerite.', {
    x: 48, y: y - 14, size: 9, font: helveticaBold, color: dark,
  });
  y -= 40;

  // Footer
  page.drawLine({ start: { x: 40, y: 60 }, end: { x: width - 40, y: 60 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  page.drawText('Este documento é um comprovante de assinatura eletrônica com trilha de auditoria completa.', {
    x: 40, y: 44, size: 7.5, font: helvetica, color: gray,
  });
  page.drawText(`Código de verificação: ${audit.signature_id}`, {
    x: 40, y: 30, size: 7.5, font: helveticaBold, color: teal,
  });

  return pdfDoc.save();
}

function truncHash(hash: string): string {
  if (hash.length <= 32) return hash;
  return `${hash.slice(0, 16)}...${hash.slice(-16)}`;
}
