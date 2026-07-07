export interface FichaEvent {
  event_name: string | null;
  event_type: string | null;
  event_date: string | null;
  location_text: string | null;
  product_name: string | null;
  ceremony_time: string | null;
  duration_hours: number | null;
  guest_count: number | null;
  children_50_pct: number | null;
  non_paying_guests: number | null;
  price_per_person: number | null;
  contract_value: number | null;
  pricing_mode: string | null;
  additional_hours: number | null;
  professional_count: number | null;
  professional_meal_value: number | null;
  professional_meal_type: string | null;
  organizer: string | null;
  decorator: string | null;
  pastry_chef: string | null;
  band_dj: string | null;
  photo_video: string | null;
  bartender: string | null;
  other_professionals: string | null;
  extra_attractions: string | null;
  notes: string | null;
  clients: { name: string | null; phone: string | null; email: string | null } | null;
}

export interface CustomField { name: string; value: string }

export interface FichaCompany {
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

const COLS = 4;
const CELL = `style="width:25%;padding:0 12px 14px 0;vertical-align:top;"`;
const LBL  = `style="font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:#A29D92;font-weight:700;margin-bottom:3px;"`;
const VAL  = `style="font-size:11px;color:#0E2A45;font-weight:500;border-bottom:1px solid #EDEAE2;padding-bottom:3px;min-height:16px;word-break:break-word;"`;
const VAL_EMPTY = `style="font-size:11px;color:transparent;border-bottom:1px solid #F0EDE6;padding-bottom:3px;min-height:16px;"`;

function grid(fields: { label: string; value: string | null; wide?: boolean; html?: boolean; skipIfEmpty?: boolean }[]) {
  const filtered = fields.filter(f => !f.skipIfEmpty || (f.value && f.value.trim()));
  const rows: string[] = [];
  let i = 0;
  while (i < filtered.length) {
    const rowFields = filtered.slice(i, i + COLS);
    const cells = rowFields.map(f => {
      const v = f.value?.trim() || '';
      return `<td ${CELL}><div ${LBL}>${f.label}</div><div ${f.html ? `style="font-size:11px;color:#2B2B2B;line-height:1.5;"` : (v ? VAL : VAL_EMPTY)}>${v || '&nbsp;'}</div></td>`;
    });
    // Preenche colunas vazias
    while (cells.length < COLS) cells.push(`<td ${CELL}></td>`);
    rows.push(`<tr>${cells.join('')}</tr>`);
    i += COLS;
  }
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">${rows.join('')}</table>`;
}

function section(title: string, content: string) {
  if (!content.trim()) return '';
  return `
    <div style="margin-top:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#0E2A45;font-weight:700;white-space:nowrap;">${title}</div>
        <div style="flex:1;height:1px;background:#EAE6DE;"></div>
      </div>
      ${content}
    </div>`;
}

export async function printFichaTecnica(
  event: FichaEvent,
  customFields: CustomField[],
  company: FichaCompany | null,
) {
  const today = new Date().toLocaleDateString('pt-BR');
  const isPpx = event.pricing_mode !== 'fixed';
  const footerLine = [company?.endereco, company?.telefone, company?.website].filter(Boolean).join(' · ');

  const logoHtml = company?.logo_base64
    ? `<img src="${company.logo_base64}" alt="Logo" style="height:52px;width:auto;">`
    : `<span style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600;color:#0E2A45;">${company?.name ?? 'Rondello Buffet'}</span>`;

  // Seção 1: Informações do evento
  const infoContent = grid([
    { label: 'Nome do Evento',        value: event.event_name },
    { label: 'Tipo de Evento',        value: event.event_type },
    { label: 'Data',                  value: fmtDate(event.event_date) },
    { label: 'Local',                 value: event.location_text },
    { label: 'Produto / Menu',        value: event.product_name },
    { label: 'Horário de Início',     value: event.ceremony_time },
    { label: 'Duração',               value: event.duration_hours ? `${event.duration_hours}h` : null },
    { label: 'Horas Adicionais',      value: event.additional_hours ? `+${event.additional_hours}h` : null },
    { label: 'Convidados',            value: event.guest_count != null ? String(event.guest_count) : null },
    { label: 'Crianças (50%)',        value: event.children_50_pct ? String(event.children_50_pct) : null },
    { label: 'Não Pagantes',          value: event.non_paying_guests ? String(event.non_paying_guests) : null },
    { label: 'Qtd. Profissionais',    value: event.professional_count ? String(event.professional_count) : null },
    { label: 'Alim. Profissionais',   value: event.professional_meal_type },
  ]);

  // Seção 2: Equipe & Fornecedores
  const equipeContent = grid([
    { label: 'Organizadora',          value: event.organizer },
    { label: 'Decorador(a)',          value: event.decorator },
    { label: 'Confeiteiro(a)',        value: event.pastry_chef },
    { label: 'Banda / DJ',           value: event.band_dj },
    { label: 'Foto / Filmagem',      value: event.photo_video },
    { label: 'Bartender',             value: event.bartender },
    { label: 'Outros Profissionais',  value: event.other_professionals },
    { label: 'Atrações à Parte',      value: event.extra_attractions },
  ]);

  // Seção 3: Detalhes (campos customizados) — reutiliza grid()
  const detalhesSection = customFields.length > 0
    ? section('Detalhes da Festa', grid(customFields.map(f => ({ label: f.name, value: f.value }))))
    : '';

  // Observações
  const obsSection = event.notes && event.notes.trim() ? `
    <div style="margin-top:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#0E2A45;font-weight:700;white-space:nowrap;">Observações</div>
        <div style="flex:1;height:1px;background:#EAE6DE;"></div>
      </div>
      <div style="width:100%;font-size:11px;color:#2B2B2B;line-height:1.65;background:#FAFAF8;border:1px solid #EDEAE2;border-radius:4px;padding:14px 16px;box-sizing:border-box;">
        ${event.notes}
      </div>
    </div>` : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ficha Técnica — ${event.event_name ?? 'Evento'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Libre+Franklin:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#E7E4DD;font-family:'Libre Franklin',sans-serif;}
    @media print{body{background:#fff;}.page{box-shadow:none!important;margin:0!important;}}
  </style>
</head>
<body>
<div class="page" style="width:794px;min-height:1123px;margin:32px auto;background:#FFFFFF;box-shadow:0 8px 40px rgba(14,42,69,.10);padding:36px 52px 48px;position:relative;overflow:hidden;">

  <!-- Emblem watermark -->
  <img src="${window.location.origin}/emblem-rondello.png" alt="" style="position:absolute;width:480px;height:480px;right:-130px;bottom:-130px;opacity:.04;pointer-events:none;user-select:none;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
    ${logoHtml}
    <div style="text-align:right;">
      <div style="font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#C2A263;font-weight:600;">Ficha Técnica</div>
      <div style="font-size:9px;letter-spacing:.10em;text-transform:uppercase;color:#9A968D;margin-top:3px;">Emitido em ${today}</div>
    </div>
  </div>

  <div style="border-top:1px solid #E7E3DB;margin-top:16px;"></div>

  <!-- Título do evento -->
  <div style="margin-top:18px;display:flex;align-items:baseline;justify-content:space-between;gap:16px;">
    <div>
      <div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#A29D92;font-weight:600;">Evento</div>
      <h1 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:32px;line-height:1.1;color:#0E2A45;margin-top:4px;">${event.event_name ?? '—'}</h1>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      ${event.location_text ? `<div style="font-size:11px;color:#6B6B6B;">${event.location_text}</div>` : ''}
      ${event.event_date ? `<div style="font-size:15px;font-weight:600;color:#0E2A45;margin-top:2px;">${fmtDate(event.event_date)}</div>` : ''}
    </div>
  </div>


  <div style="border-top:1px solid #E7E3DB;margin-top:16px;"></div>

  ${section('Informações do Evento', infoContent)}
  ${equipeContent ? section('Equipe & Fornecedores', equipeContent) : ''}
  ${detalhesSection}
  ${obsSection}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E7E3DB;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="font-size:9px;letter-spacing:.06em;color:#B0ABA0;">${footerLine}</div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:18px;color:#C2A263;font-weight:600;">Rondello Buffet</div>
  </div>

</div>
</body>
</html>`;

  // Renderiza em elemento oculto e baixa como PDF
  const SCALE = 2;
  const A4_W_MM = 210, A4_H_MM = 297, PX_PER_MM = 3.7795;
  const PAGE_W_PX = Math.round(A4_W_MM * PX_PER_MM);

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1px;border:none;visibility:hidden;';
  document.body.appendChild(frame);

  await new Promise<void>(resolve => {
    frame.onload = () => resolve();
    frame.srcdoc = html;
  });

  // Aguarda fontes e imagens
  await new Promise(r => setTimeout(r, 600));

  const { default: html2canvas } = await import('html2canvas');
  const { default: jsPDF } = await import('jspdf');

  const el = frame.contentDocument?.body?.firstElementChild as HTMLElement;
  if (!el) { document.body.removeChild(frame); return; }

  const canvas = await html2canvas(el, {
    scale: SCALE,
    useCORS: true,
    backgroundColor: '#fff',
    windowWidth: 794,
  });
  document.body.removeChild(frame);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const imgW = A4_W_MM;
  const imgH = (canvas.height / canvas.width) * imgW;
  const pageH = A4_H_MM;

  // Divide em páginas se necessário
  let posY = 0;
  let pageNum = 0;
  while (posY < imgH) {
    if (pageNum > 0) pdf.addPage();
    const srcY = Math.round((posY / imgH) * canvas.height);
    const srcH = Math.min(Math.round((pageH / imgH) * canvas.height), canvas.height - srcY);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = srcH;
    slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
    const sliceH = (srcH / canvas.width) * imgW;
    pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, imgW, sliceH);
    posY += pageH;
    pageNum++;
  }

  const name = (event.event_name ?? 'Evento').trim();
  pdf.save(`FICHA TÉCNICA - ${name}.pdf`);
}
