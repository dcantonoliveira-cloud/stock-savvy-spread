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

function buildHtml(
  eventName: string,
  eventDate: string | null,
  guestCount: number | null,
  menuHtml: string,
  company: Company | null,
): string {
  const today = new Date().toLocaleDateString('pt-BR');

  const logoHtml = company?.logo_base64
    ? `<img src="${company.logo_base64}" alt="Logo" style="height:58px;width:auto;">`
    : `<span style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#0E2A45;">${company?.name ?? 'Rondello Buffet'}</span>`;

  const footerLine = [company?.endereco, company?.telefone, company?.website].filter(Boolean).join(' · ');

  return `
<div style="width:794px;background:#FFFFFF;padding:40px 56px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#2B2B2B;box-sizing:border-box;">

  <style>
    .menu-content h1, .menu-content h2, .menu-content h3 {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: #0E2A45;
      margin: 20px 0 6px 0;
      padding: 0;
    }
    .menu-content h2 {
      font-size: 11px;
      color: #C2A263;
      margin-top: 14px;
    }
    .menu-content h3 {
      font-size: 10.5px;
      color: #6B6B6B;
      letter-spacing: .12em;
    }
    .menu-content p {
      font-size: 12.5px;
      color: #2B2B2B;
      margin: 2px 0;
      padding: 0;
      line-height: 1.65;
    }
    .menu-content ul, .menu-content ol {
      margin: 4px 0;
      padding-left: 18px;
    }
    .menu-content li {
      font-size: 12.5px;
      color: #2B2B2B;
      line-height: 1.65;
      margin: 1px 0;
    }
    .menu-content strong { font-weight: 700; color: #0E2A45; }
    .menu-content em { font-style: italic; color: #4A4A4A; }
    .menu-content s { text-decoration: line-through; color: #A29D92; }
    .menu-content blockquote {
      border-left: 3px solid #C2A263;
      margin: 8px 0;
      padding: 4px 12px;
      color: #6B6B6B;
      font-style: italic;
    }
    .menu-content hr {
      border: none;
      border-top: 1px solid #E7E3DB;
      margin: 14px 0;
    }
  </style>

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
    ${logoHtml}
    <div style="text-align:right;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#9A968D;line-height:1.7;">
      <div>Cardápio do evento</div>
      <div>Emitido em ${today}</div>
    </div>
  </div>

  <div style="border-top:1px solid #E7E3DB;margin-top:18px;"></div>

  <!-- Title -->
  <div style="text-align:center;margin-top:22px;display:flex;flex-direction:column;align-items:center;gap:4px;">
    <div style="font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:#C2A263;font-weight:600;padding-left:.42em;">Cardápio</div>
    <h1 style="font-family:Georgia,serif;font-weight:600;font-size:38px;line-height:1.1;color:#0E2A45;margin:0;">${eventName}</h1>
  </div>

  <!-- Stats strip -->
  <div style="display:grid;grid-template-columns:1fr 1fr;margin-top:20px;border-top:1px solid #E7E3DB;border-bottom:1px solid #E7E3DB;">
    <div style="text-align:center;padding:12px;">
      <div style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#A29D92;font-weight:600;">Data do evento</div>
      <div style="font-size:18px;color:#0E2A45;margin-top:6px;font-weight:500;">${fmtDate(eventDate)}</div>
    </div>
    <div style="text-align:center;padding:12px;border-left:1px solid #EDEAE2;">
      <div style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#A29D92;font-weight:600;">Convidados</div>
      <div style="font-size:18px;color:#0E2A45;margin-top:6px;font-weight:500;">${guestCount ?? '—'}</div>
    </div>
  </div>

  <!-- Cardápio -->
  <div style="margin-top:28px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <h2 style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#0E2A45;font-weight:600;white-space:nowrap;margin:0;">Menu</h2>
      <div style="flex:1;height:1px;background:#EAE6DE;"></div>
    </div>
    <div class="menu-content">
      ${menuHtml}
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:18px;border-top:1px solid #E7E3DB;display:flex;justify-content:flex-end;">
    <div style="font-family:Georgia,serif;font-size:20px;color:#C2A263;font-weight:600;letter-spacing:.01em;">${company?.name ?? 'Rondello Buffet'}</div>
  </div>

  ${footerLine ? `<div style="margin-top:16px;text-align:center;font-size:9.5px;letter-spacing:.06em;color:#B0ABA0;">${footerLine}</div>` : ''}

</div>`;
}

export async function printCardapio(
  eventName: string,
  eventDate: string | null,
  guestCount: number | null,
  menuHtml: string,
  company: Company | null,
) {
  const { default: html2canvas } = await import('html2canvas');

  const inner = buildHtml(eventName, eventDate, guestCount, menuHtml, company);

  // Monta o wrapper fora da tela
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;';
  wrapper.innerHTML = inner;
  document.body.appendChild(wrapper);

  // Aguarda render + imagens
  await new Promise(r => setTimeout(r, 200));

  const canvas = await html2canvas(wrapper, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#fff',
    windowWidth: 794,
  });
  document.body.removeChild(wrapper);

  const A4_W_MM = 210;
  const A4_H_MM = 297;
  // Sem margem lateral: a página já tem padding interno
  const PX_PER_MM = canvas.width / A4_W_MM;
  const pageHeightPx = Math.round(A4_H_MM * PX_PER_MM);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let srcY = 0;
  let pageNum = 0;

  while (srcY < canvas.height) {
    // Tenta evitar cortar no meio de uma linha: procura 10px para baixo
    // por uma faixa de pixels brancos para quebrar aí
    let cutY = Math.min(srcY + pageHeightPx, canvas.height);
    if (cutY < canvas.height) {
      // Busca até 40px antes para encontrar linha quase-branca
      const ctx = canvas.getContext('2d')!;
      for (let probe = cutY; probe > cutY - 40 && probe > srcY; probe--) {
        const px = ctx.getImageData(0, probe, canvas.width, 1).data;
        let isWhite = true;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i] < 240 || px[i + 1] < 240 || px[i + 2] < 240) { isWhite = false; break; }
        }
        if (isWhite) { cutY = probe; break; }
      }
    }

    const srcH = cutY - srcY;
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = srcH;
    slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    const imgH = (srcH / canvas.width) * A4_W_MM;
    if (pageNum > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W_MM, imgH);

    srcY = cutY;
    pageNum++;
  }

  pdf.save(`CARDÁPIO - ${eventName}.pdf`);
}
