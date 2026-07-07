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

// ─── estilos inline ─────────────────────────────────────────────────────────
const FONT   = `font-family:'Libre Franklin',Arial,sans-serif;`;
const LBL_S  = `${FONT}font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:#A29D92;font-weight:700;margin-bottom:7px;display:block;`;
const VAL_S  = `${FONT}font-size:13.5px;color:#0E2A45;font-weight:500;border-bottom:1.5px solid #E2DED8;padding-bottom:8px;min-height:22px;word-break:break-word;display:block;`;
const VEMPTY = `${FONT}font-size:13.5px;color:transparent;border-bottom:1.5px solid #EDEAE2;padding-bottom:8px;min-height:22px;display:block;`;

interface Field { label: string; value: string | null; cols?: 1 | 2 | 3 | 4; skipIfEmpty?: boolean }

function grid(fields: Field[]): string {
  const TOTAL = 4;
  const visible = fields.filter(f => !f.skipIfEmpty || (f.value?.trim()));
  const rows: string[] = [];
  let i = 0;

  while (i < visible.length) {
    const f = visible[i];
    const span = Math.min(f.cols ?? 1, TOTAL);
    const pct  = (span / TOTAL * 100).toFixed(4) + '%';
    const v    = f.value?.trim() || '';
    const cell = `<td style="width:${pct};padding:0 18px 22px 0;vertical-align:top;" colspan="${span}">
      <span style="${LBL_S}">${f.label}</span>
      <span style="${v ? VAL_S : VEMPTY}">${v || '&nbsp;'}</span>
    </td>`;

    // verifica se ainda cabe na linha atual
    const usedInRow: string[] = [cell];
    let used = span;
    i++;
    while (used < TOTAL && i < visible.length) {
      const nf   = visible[i];
      const ns   = Math.min(nf.cols ?? 1, TOTAL - used);
      const npct = (ns / TOTAL * 100).toFixed(4) + '%';
      const nv   = nf.value?.trim() || '';
      usedInRow.push(`<td style="width:${npct};padding:0 18px 22px 0;vertical-align:top;" colspan="${ns}">
        <span style="${LBL_S}">${nf.label}</span>
        <span style="${nv ? VAL_S : VEMPTY}">${nv || '&nbsp;'}</span>
      </td>`);
      used += ns;
      i++;
    }
    // preenche colunas restantes
    if (used < TOTAL) {
      usedInRow.push(`<td style="width:${((TOTAL - used) / TOTAL * 100).toFixed(4)}%;padding:0;" colspan="${TOTAL - used}"></td>`);
    }
    rows.push(`<tr>${usedInRow.join('')}</tr>`);
  }

  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">${rows.join('')}</table>`;
}

function divider(title: string): string {
  return `<div style="display:flex;align-items:center;gap:10px;margin:22px 0 13px;">
    <span style="${FONT}font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#0E2A45;font-weight:700;white-space:nowrap;">${title}</span>
    <div style="flex:1;height:1px;background:#E7E3DB;"></div>
  </div>`;
}

function buildPage1Html(event: FichaEvent, customFields: CustomField[], company: FichaCompany | null): string {
  const today     = new Date().toLocaleDateString('pt-BR');
  const footerLine = [company?.endereco, company?.telefone, company?.website].filter(Boolean).join(' · ');
  const logoHtml  = company?.logo_base64
    ? `<img src="${company.logo_base64}" alt="Logo" style="height:52px;width:auto;">`
    : `<span style="${FONT}font-size:20px;font-weight:700;color:#0E2A45;">${company?.name ?? 'Rondello Buffet'}</span>`;

  const infoFields: Field[] = [
    { label: 'Nome do Evento',       value: event.event_name,      cols: 2 },
    { label: 'Tipo de Evento',       value: event.event_type },
    { label: 'Data',                 value: fmtDate(event.event_date) },
    { label: 'Produto / Menu',       value: event.product_name,    cols: 3, skipIfEmpty: true },
    { label: 'Local',                value: event.location_text,             skipIfEmpty: true },
    { label: 'Horário de Início',    value: event.ceremony_time },
    { label: 'Duração',              value: event.duration_hours ? `${event.duration_hours}h` : null },
    { label: 'Horas Adicionais',     value: event.additional_hours ? `+${event.additional_hours}h` : null, skipIfEmpty: true },
    { label: 'Convidados',           value: event.guest_count != null ? String(event.guest_count) : null },
    { label: 'Crianças (50%)',       value: event.children_50_pct ? String(event.children_50_pct) : null, skipIfEmpty: true },
    { label: 'Não Pagantes',         value: event.non_paying_guests ? String(event.non_paying_guests) : null, skipIfEmpty: true },
    { label: 'Qtd. Profissionais',   value: event.professional_count ? String(event.professional_count) : null, skipIfEmpty: true },
    { label: 'Alim. Profissionais',  value: event.professional_meal_type, skipIfEmpty: true },
  ];

  const equipeFields: Field[] = [
    { label: 'Organizadora',         value: event.organizer },
    { label: 'Decorador(a)',         value: event.decorator },
    { label: 'Confeiteiro(a)',       value: event.pastry_chef },
    { label: 'Banda / DJ',          value: event.band_dj },
    { label: 'Foto / Filmagem',     value: event.photo_video },
    { label: 'Bartender',            value: event.bartender },
    { label: 'Outros Profissionais', value: event.other_professionals, cols: 2, skipIfEmpty: true },
    { label: 'Atrações à Parte',     value: event.extra_attractions,   cols: 2, skipIfEmpty: true },
  ];

  const customSection = customFields.length > 0
    ? divider('Detalhes da Festa') + grid(customFields.map(f => ({ label: f.name, value: f.value })))
    : '';

  return `<!DOCTYPE html><html><head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Libre+Franklin:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#fff;${FONT}}</style>
</head><body>
<div style="width:794px;background:#fff;padding:38px 54px 48px;position:relative;overflow:hidden;">

  <!-- Watermark -->
  <img src="${window.location.origin}/emblem-rondello.png" alt="" style="position:absolute;width:400px;height:400px;right:-60px;bottom:0;opacity:.04;pointer-events:none;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
    ${logoHtml}
    <div style="text-align:right;">
      <div style="${FONT}font-size:8.5px;letter-spacing:.18em;text-transform:uppercase;color:#C2A263;font-weight:600;">Ficha Técnica</div>
      <div style="${FONT}font-size:8px;letter-spacing:.10em;color:#9A968D;margin-top:3px;">Emitido em ${today}</div>
    </div>
  </div>

  <div style="border-top:1px solid #E7E3DB;margin-top:14px;"></div>

  <!-- Título -->
  <div style="margin-top:16px;display:flex;align-items:baseline;justify-content:space-between;gap:16px;">
    <div>
      <div style="${FONT}font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:#A29D92;font-weight:600;">Evento</div>
      <h1 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:40px;line-height:1.1;color:#0E2A45;margin-top:6px;word-spacing:6px;hyphens:none;">${event.event_name ?? '—'}</h1>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      ${event.location_text ? `<div style="${FONT}font-size:10px;color:#6B6B6B;">${event.location_text}</div>` : ''}
      ${event.event_date   ? `<div style="${FONT}font-size:14px;font-weight:600;color:#0E2A45;margin-top:2px;">${fmtDate(event.event_date)}</div>` : ''}
    </div>
  </div>

  <div style="border-top:1px solid #E7E3DB;margin-top:14px;"></div>

  ${divider('Informações do Evento')}${grid(infoFields)}
  ${divider('Equipe & Fornecedores')}${grid(equipeFields)}
  ${customSection}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:14px;border-top:1px solid #E7E3DB;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="${FONT}font-size:8.5px;color:#B0ABA0;">${footerLine}</div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:18px;color:#C2A263;font-weight:600;">Rondello Buffet</div>
  </div>

</div></body></html>`;
}

function buildPage2Html(event: FichaEvent, company: FichaCompany | null): string {
  const today      = new Date().toLocaleDateString('pt-BR');
  const footerLine = [company?.endereco, company?.telefone, company?.website].filter(Boolean).join(' · ');
  const logoHtml   = company?.logo_base64
    ? `<img src="${company.logo_base64}" alt="Logo" style="height:40px;width:auto;">`
    : `<span style="${FONT}font-size:16px;font-weight:700;color:#0E2A45;">${company?.name ?? 'Rondello Buffet'}</span>`;

  return `<!DOCTYPE html><html><head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Libre+Franklin:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#fff;${FONT}}</style>
</head><body>
<div style="width:794px;background:#fff;padding:38px 54px 48px;position:relative;overflow:hidden;">

  <!-- Watermark -->
  <img src="${window.location.origin}/emblem-rondello.png" alt="" style="position:absolute;width:400px;height:400px;right:-60px;bottom:0;opacity:.04;pointer-events:none;">

  <!-- Header mini -->
  <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
    ${logoHtml}
    <div style="text-align:right;">
      <div style="${FONT}font-size:8.5px;letter-spacing:.18em;text-transform:uppercase;color:#C2A263;font-weight:600;">Observações</div>
      <div style="${FONT}font-size:8px;letter-spacing:.10em;color:#9A968D;margin-top:3px;">${event.event_name ?? ''}</div>
    </div>
  </div>

  <div style="border-top:1px solid #E7E3DB;margin-top:14px;margin-bottom:20px;"></div>

  <div style="width:100%;font-size:11.5px;color:#2B2B2B;line-height:1.7;background:#FAFAF8;border:1px solid #E2DED8;border-radius:5px;padding:18px 20px;">
    ${event.notes ?? ''}
  </div>

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:14px;border-top:1px solid #E7E3DB;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="${FONT}font-size:8.5px;color:#B0ABA0;">${footerLine}</div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:18px;color:#C2A263;font-weight:600;">Rondello Buffet</div>
  </div>

</div></body></html>`;
}

async function renderHtml(html: string): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1px;border:none;visibility:hidden;';
  document.body.appendChild(frame);
  await new Promise<void>(r => { frame.onload = () => r(); frame.srcdoc = html; });
  await new Promise(r => setTimeout(r, 700));
  const el = frame.contentDocument?.body?.firstElementChild as HTMLElement;
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#fff', windowWidth: 794 });
  document.body.removeChild(frame);
  return canvas;
}

export async function printFichaTecnica(
  event: FichaEvent,
  customFields: CustomField[],
  company: FichaCompany | null,
) {
  const { default: jsPDF } = await import('jspdf');

  const page1Html = buildPage1Html(event, customFields, company);
  const hasObs    = !!(event.notes?.trim());
  const page2Html = hasObs ? buildPage2Html(event, company) : null;

  // Renderiza cada página separadamente
  const canvases = await Promise.all([
    renderHtml(page1Html),
    ...(page2Html ? [renderHtml(page2Html)] : []),
  ]);

  const A4_W = 210, A4_H = 297;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

  canvases.forEach((canvas, i) => {
    if (i > 0) pdf.addPage();
    const imgH = (canvas.height / canvas.width) * A4_W;

    if (imgH <= A4_H) {
      // cabe numa página
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W, imgH);
    } else {
      // fatiamento se o conteúdo for mais alto que A4
      const PX_PER_MM = canvas.width / A4_W;
      const pageHpx   = Math.round(A4_H * PX_PER_MM);
      let srcY = 0, first = true;
      while (srcY < canvas.height) {
        if (!first) pdf.addPage();
        const srcH   = Math.min(pageHpx, canvas.height - srcY);
        const slice  = document.createElement('canvas');
        slice.width  = canvas.width;
        slice.height = srcH;
        slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        const sliceH = (srcH / canvas.width) * A4_W;
        pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W, sliceH);
        srcY += pageHpx;
        first = false;
      }
    }
  });

  const name = (event.event_name ?? 'Evento').trim();
  pdf.save(`FICHA TÉCNICA - ${name}.pdf`);
}
