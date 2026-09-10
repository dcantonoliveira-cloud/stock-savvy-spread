export interface ProductionQuote {
  name: string;
  quote_date: string | null;
  value: number | null;
  content: string | null;
}

export interface QuoteCompany {
  name: string | null;
  logo_base64: string | null;
  endereco: string | null;
  telefone: string | null;
  website: string | null;
}

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const fmtBRL = (v: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

const FONT = `font-family:'Libre Franklin',Arial,sans-serif;`;
// Altura de uma página A4 na largura de renderização (794px ≈ 210mm de largura)
const PAGE_H = Math.round(794 * (297 / 210));

function divider(title: string): string {
  return `<div style="display:flex;align-items:center;gap:10px;margin:26px 0 16px;">
    <span style="${FONT}font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#0E2A45;font-weight:700;white-space:nowrap;">${title}</span>
    <div style="flex:1;height:1px;background:#E7E3DB;"></div>
  </div>`;
}

function buildHtml(quote: ProductionQuote, company: QuoteCompany | null): string {
  const today = new Date().toLocaleDateString('pt-BR');
  const footerLine = [company?.endereco, company?.telefone, company?.website].filter(Boolean).join(' · ');
  const logoHtml = company?.logo_base64
    ? `<img src="${company.logo_base64}" alt="Logo" style="height:52px;width:auto;">`
    : `<span style="${FONT}font-size:20px;font-weight:700;color:#0E2A45;">${company?.name ?? 'Rondello Buffet'}</span>`;

  return `<!DOCTYPE html><html><head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Libre+Franklin:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#fff;${FONT}}
    .rq-content{${FONT}font-size:13px;color:#33322E;line-height:1.7;}
    .rq-content p{margin:0 0 12px;}
    .rq-content h1{font-size:20px;font-weight:700;color:#0E2A45;margin:0 0 12px;}
    .rq-content h2{font-size:17px;font-weight:700;color:#0E2A45;margin:0 0 10px;}
    .rq-content ul,.rq-content ol{margin:0 0 12px;padding-left:22px;}
    .rq-content strong{font-weight:700;}
    .rq-content a{color:#0E2A45;}
    .rq-content hr{border:none;border-top:1px solid #E7E3DB;margin:16px 0;}
    .rq-content img{max-width:100%;border-radius:6px;margin:8px 0;}
  </style>
</head><body>
<div style="width:794px;min-height:${PAGE_H}px;background:#fff;padding:44px 54px;position:relative;overflow:hidden;display:flex;flex-direction:column;">

  <!-- Watermark -->
  <img src="${window.location.origin}/emblem-rondello.png" alt="" style="position:absolute;width:420px;height:420px;right:-70px;bottom:-40px;opacity:.035;pointer-events:none;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
    ${logoHtml}
    <div style="text-align:right;">
      <div style="${FONT}font-size:8.5px;letter-spacing:.18em;text-transform:uppercase;color:#C2A263;font-weight:600;">Orçamento de Produção</div>
      <div style="${FONT}font-size:8px;letter-spacing:.10em;color:#9A968D;margin-top:3px;">Emitido em ${today}</div>
    </div>
  </div>

  <div style="border-top:1px solid #E7E3DB;margin-top:16px;"></div>

  <!-- Título -->
  <div style="margin-top:24px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;">
    <div>
      <div style="${FONT}font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:#A29D92;font-weight:600;">Pedido</div>
      <h1 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:38px;line-height:1.15;color:#0E2A45;margin-top:8px;hyphens:none;">${quote.name || '—'}</h1>
      <div style="${FONT}font-size:11px;color:#6B6B6B;margin-top:8px;">${fmtDate(quote.quote_date)}</div>
    </div>
    <div style="text-align:right;flex-shrink:0;background:#F8F6F1;border:1px solid #E7E3DB;border-radius:10px;padding:11px 18px;">
      <div style="${FONT}font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:#A29D92;font-weight:600;">Valor</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:600;color:#0E2A45;margin-top:4px;white-space:nowrap;">${fmtBRL(quote.value)}</div>
    </div>
  </div>

  ${divider('Detalhes do Pedido')}

  <div class="rq-content" style="flex:1;">${quote.content || '<p style="color:#B0ABA0;">—</p>'}</div>

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E7E3DB;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="${FONT}font-size:8.5px;color:#B0ABA0;">${footerLine}</div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:18px;color:#C2A263;font-weight:600;letter-spacing:.4px;">Rondello Buffet</div>
  </div>

</div></body></html>`;
}

async function renderHtml(html: string): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1px;border:none;visibility:hidden;';
  document.body.appendChild(frame);
  await new Promise<void>(r => { frame.onload = () => r(); frame.srcdoc = html; });
  await new Promise(r => setTimeout(r, 900));
  const el = frame.contentDocument?.body?.firstElementChild as HTMLElement;
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#fff', windowWidth: 794 });
  document.body.removeChild(frame);
  return canvas;
}

export async function printProductionQuote(quote: ProductionQuote, company: QuoteCompany | null) {
  const { default: jsPDF } = await import('jspdf');

  const canvas = await renderHtml(buildHtml(quote, company));

  const A4_W = 210, A4_H = 297;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const imgH = (canvas.height / canvas.width) * A4_W;

  if (imgH <= A4_H) {
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W, imgH);
  } else {
    // fatiamento se o conteúdo (texto rico) for mais alto que uma página A4
    const PX_PER_MM = canvas.width / A4_W;
    const pageHpx = Math.round(A4_H * PX_PER_MM);
    let srcY = 0, first = true;
    while (srcY < canvas.height) {
      if (!first) pdf.addPage();
      const srcH = Math.min(pageHpx, canvas.height - srcY);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = srcH;
      slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      const sliceH = (srcH / canvas.width) * A4_W;
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W, sliceH);
      srcY += pageHpx;
      first = false;
    }
  }

  const name = (quote.name || 'Orçamento').trim();
  pdf.save(`ORÇAMENTO - ${name}.pdf`);
}
