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

// Converte HTML do editor rico para linhas de texto estilizadas
function richHtmlToLines(html: string): string {
  // Substitui tags de bloco por marcações temporárias
  const processed = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '%%H1%%$1%%END%%')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '%%H2%%$1%%END%%')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '<b>$1</b>')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '<i>$1</i>')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '%%LI%%$1%%END%%')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '%%P%%$1%%END%%')
    .replace(/<br\s*\/?>/gi, '%%BR%%')
    .replace(/<[^>]+>/g, ''); // remove demais tags

  const lines = processed.split(/%%END%%/).flatMap(chunk => {
    if (chunk.startsWith('%%H1%%')) {
      const text = chunk.replace('%%H1%%', '').trim();
      return text ? [{ type: 'h1', text }] : [];
    }
    if (chunk.startsWith('%%H2%%')) {
      const text = chunk.replace('%%H2%%', '').trim();
      return text ? [{ type: 'h2', text }] : [];
    }
    if (chunk.startsWith('%%LI%%')) {
      const text = chunk.replace('%%LI%%', '').trim();
      return text ? [{ type: 'li', text }] : [];
    }
    if (chunk.startsWith('%%P%%')) {
      const text = chunk.replace('%%P%%', '').replace(/%%BR%%/g, '\n').trim();
      return text ? [{ type: 'p', text }] : [];
    }
    // texto solto com quebras
    const parts = chunk.replace(/%%BR%%/g, '\n').split('\n');
    return parts.map(t => t.trim()).filter(Boolean).map(text => ({ type: 'p', text }));
  });

  return lines.map(l => {
    if (l.type === 'h1') {
      return `<div style="font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#0E2A45;margin-top:20px;margin-bottom:6px;">${l.text}</div>`;
    }
    if (l.type === 'h2') {
      return `<div style="font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#C2A263;margin-top:16px;margin-bottom:4px;">${l.text}</div>`;
    }
    if (l.type === 'li') {
      return `<div style="font-size:12.5px;color:#2B2B2B;padding:2px 0 2px 14px;position:relative;">
                <span style="position:absolute;left:0;color:#C2A263;">·</span>${l.text}
              </div>`;
    }
    return `<div style="font-size:12.5px;color:#2B2B2B;padding:1.5px 0;">${l.text}</div>`;
  }).join('');
}

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

  const menuContent = richHtmlToLines(menuHtml);

  return `
<div style="width:794px;background:#FFFFFF;padding:40px 56px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#2B2B2B;box-sizing:border-box;">

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
  <div style="text-align:center;margin-top:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
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
      <h2 style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#0E2A45;font-weight:600;white-space:nowrap;">Menu</h2>
      <div style="flex:1;height:1px;background:#EAE6DE;"></div>
    </div>
    <div style="line-height:1.7;">
      ${menuContent}
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:18px;border-top:1px solid #E7E3DB;display:flex;justify-content:flex-end;align-items:flex-end;">
    <div style="text-align:right;font-size:10.5px;color:#A29D92;line-height:1.7;">
      <div style="font-family:Georgia,serif;font-size:20px;color:#C2A263;font-weight:600;letter-spacing:.01em;">${company?.name ?? 'Rondello Buffet'}</div>
    </div>
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
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;';
  wrapper.innerHTML = inner;
  document.body.appendChild(wrapper);

  await new Promise(r => setTimeout(r, 150));

  const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#fff' });
  document.body.removeChild(wrapper);

  const PW_MM = 210, PH_MM = 297;
  const CONTENT_W_MM = PW_MM;
  const PX_PER_MM = canvas.width / CONTENT_W_MM;
  const pageHeightPx = Math.round(PH_MM * PX_PER_MM);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let srcY = 0;
  let pageNum = 0;

  while (srcY < canvas.height) {
    const srcH = Math.min(pageHeightPx, canvas.height - srcY);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = srcH;
    slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
    const imgH = (srcH / canvas.width) * CONTENT_W_MM;
    if (pageNum > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, CONTENT_W_MM, imgH);
    srcY += srcH;
    pageNum++;
  }

  pdf.save(`CARDÁPIO - ${eventName}.pdf`);
}
