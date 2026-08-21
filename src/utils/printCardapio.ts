import jsPDF from 'jspdf';

interface Company {
  name: string | null; logo_base64: string | null;
  endereco: string | null; telefone: string | null; website: string | null;
}

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const A4_W_PX  = 794;   // largura do container em px (mesma escala do contrato)
const SCALE    = 2;     // resolução do canvas

// ── Renderiza um elemento HTML num canvas e retorna ele ────────────────────────
async function renderHtml(html: string, width: number): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:-9999px;top:0;width:${width}px;background:white;`;
  el.innerHTML = html;
  document.body.appendChild(el);
  await new Promise(r => setTimeout(r, 150));
  const canvas = await html2canvas(el, { scale: SCALE, useCORS: true, backgroundColor: '#fff', windowWidth: width });
  document.body.removeChild(el);
  return canvas;
}

// ── Header de cada página ──────────────────────────────────────────────────────
function headerHtml(eventName: string, eventDate: string | null, location: string | null, company: Company | null): string {
  const logoHtml = company?.logo_base64
    ? `<img src="${company.logo_base64}" alt="Logo" style="height:44px;width:auto;">`
    : `<span style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#0E2A45;">${company?.name ?? 'Rondello Buffet'}</span>`;

  const meta = [fmtDate(eventDate), location].filter(Boolean).join(' · ');

  return `
<div style="width:${A4_W_PX}px;background:#fff;padding:22px 56px 14px;box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
    ${logoHtml}
    <div style="text-align:right;line-height:1.6;">
      <div style="font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#C2A263;font-weight:600;">Cardápio</div>
      <div style="font-size:12px;font-weight:600;color:#0E2A45;">${eventName}</div>
      ${meta ? `<div style="font-size:9.5px;color:#A29D92;">${meta}</div>` : ''}
    </div>
  </div>
  <div style="border-top:1px solid #E7E3DB;margin-top:12px;"></div>
</div>`;
}

// ── Rodapé de cada página ──────────────────────────────────────────────────────
function footerHtml(page: number, total: number, company: Company | null): string {
  return `
<div style="width:${A4_W_PX}px;background:#fff;padding:12px 56px 20px;box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <div style="border-top:1px solid #E7E3DB;margin-bottom:10px;"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:9.5px;color:#A29D92;">${company?.name ?? 'Rondello Buffet'}</span>
    <span style="font-size:9.5px;color:#A29D92;">Página ${page} de ${total}</span>
  </div>
</div>`;
}

// ── Corpo: só o conteúdo do cardápio ──────────────────────────────────────────
function bodyHtml(eventName: string, menuHtml: string): string {
  return `
<div style="width:${A4_W_PX}px;background:#fff;padding:0 56px 32px;box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">

  <style>
    /* Título do documento — aparece só na primeira página, dentro do body */
    .doc-title { text-align:center; padding: 28px 0 32px; border-bottom: 1px solid #E7E3DB; margin-bottom: 28px; }
    .doc-title .label { font-size:10px; letter-spacing:.44em; text-transform:uppercase; color:#C2A263; font-weight:600; margin-bottom:8px; }
    .doc-title h1 { font-family:Georgia,serif; font-weight:600; font-size:40px; line-height:1.1; color:#0E2A45; margin:0; }

    /* Conteúdo do rich text */
    .menu-content { line-height: 1.7; }
    .menu-content > * { margin: 0; }
    .menu-content h1 {
      font-size:12px; font-weight:700; letter-spacing:.2em; text-transform:uppercase;
      color:#0E2A45; margin-top:22px; margin-bottom:5px; padding:0;
    }
    .menu-content h2 {
      font-size:10.5px; font-weight:600; letter-spacing:.16em; text-transform:uppercase;
      color:#C2A263; margin-top:16px; margin-bottom:4px; padding:0;
    }
    .menu-content h3 {
      font-size:10px; font-weight:600; letter-spacing:.12em; text-transform:uppercase;
      color:#6B6B6B; margin-top:12px; margin-bottom:3px; padding:0;
    }
    .menu-content p {
      font-size:12.5px; color:#2B2B2B; margin:0; padding:0; line-height:1.65; min-height:1.1em;
    }
    .menu-content ul, .menu-content ol { margin:4px 0; padding-left:18px; }
    .menu-content li { font-size:12.5px; color:#2B2B2B; line-height:1.65; margin:0; }
    .menu-content strong { font-weight:700; color:#0E2A45; }
    .menu-content em { font-style:italic; color:#4A4A4A; }
    .menu-content s { text-decoration:line-through; color:#A29D92; }
    .menu-content blockquote {
      border-left:3px solid #C2A263; margin:8px 0; padding:4px 12px;
      color:#6B6B6B; font-style:italic; font-size:12px;
    }
    .menu-content hr { border:none; border-top:1px solid #E7E3DB; margin:14px 0; }
  </style>

  <!-- Título (só na 1ª página) -->
  <div class="doc-title">
    <div class="label">Cardápio</div>
    <h1>${eventName}</h1>
  </div>

  <!-- Conteúdo -->
  <div class="menu-content">
    ${menuHtml}
  </div>
</div>`;
}

// ── Exporta o PDF ──────────────────────────────────────────────────────────────
export async function printCardapio(
  eventName: string,
  eventDate: string | null,
  guestCount: number | null,
  location: string | null,
  menuHtml: string,
  company: Company | null,
) {
  // 1. Renderiza header e footer com 1 página fictícia para medir altura
  const [hCanvasMeasure, fCanvasMeasure, bodyCanvas] = await Promise.all([
    renderHtml(headerHtml(eventName, eventDate, location, company), A4_W_PX),
    renderHtml(footerHtml(1, 1, company), A4_W_PX),
    renderHtml(bodyHtml(eventName, menuHtml), A4_W_PX),
  ]);

  const A4_H_PX      = Math.round((A4_W_PX * SCALE) * 297 / 210); // altura total da página em px de canvas
  const headerH      = hCanvasMeasure.height;
  const footerH      = fCanvasMeasure.height;
  const contentH     = A4_H_PX - headerH - footerH;                // área útil por página

  // 2. Divide o body em fatias
  const totalPages = Math.ceil(bodyCanvas.height / contentH);

  // 3. Renderiza headers e footers com numeração correta
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const A4_W_MM = 210;

  for (let page = 1; page <= totalPages; page++) {
    const [hCanvas, fCanvas] = await Promise.all([
      renderHtml(headerHtml(eventName, eventDate, location, company), A4_W_PX),
      renderHtml(footerHtml(page, totalPages, company), A4_W_PX),
    ]);

    // Cria canvas da página completa
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width  = A4_W_PX * SCALE;
    pageCanvas.height = A4_H_PX;
    const ctx = pageCanvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    // Desenha header no topo
    ctx.drawImage(hCanvas, 0, 0);

    // Desenha fatia do body
    const srcY = (page - 1) * contentH;
    const srcH = Math.min(contentH, bodyCanvas.height - srcY);
    ctx.drawImage(bodyCanvas, 0, srcY, bodyCanvas.width, srcH, 0, headerH, bodyCanvas.width, srcH);

    // Desenha footer no rodapé
    ctx.drawImage(fCanvas, 0, A4_H_PX - footerH);

    const imgH = (A4_H_PX / (A4_W_PX * SCALE)) * A4_W_MM;
    if (page > 1) pdf.addPage();
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W_MM, imgH);
  }

  pdf.save(`CARDÁPIO - ${eventName}.pdf`);
}
