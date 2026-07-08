import jsPDF from 'jspdf';

interface Payment { payment_date: string | null; value: number; is_confirmed: boolean }
interface Additional { description: string | null; value: number }
interface Company {
  name: string | null; logo_base64: string | null;
  razao_social: string | null; cnpj: string | null;
  banco: string | null; agencia: string | null; conta: string | null;
  endereco: string | null; telefone: string | null; website: string | null;
}
export interface EventData {
  event_name: string | null; event_date: string | null;
  guest_count: number | null; children_50_pct: number | null;
  price_per_person: number | null; professional_count: number | null;
  professional_meal_value: number | null; pricing_mode: string | null;
  contract_value: number | null;
  clients: { name: string | null } | null;
}

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

function buildHtml(
  event: EventData,
  payments: Payment[],
  additionals: Additional[],
  company: Company | null,
): string {
  const isPpx    = event.pricing_mode !== 'fixed';
  const guests   = event.guest_count ?? 0;
  const children = event.children_50_pct ?? 0;
  const ppx      = event.price_per_person ?? 0;
  const profN    = event.professional_count ?? 0;
  const profV    = event.professional_meal_value ?? 0;
  const contV    = event.contract_value ?? 0;
  const paying   = guests - children;

  const base  = isPpx ? paying * ppx + children * ppx * 0.5 + profN * profV : contV;
  const grand = base + additionals.reduce((s, a) => s + a.value, 0);

  const confirmed = payments.filter(p => p.is_confirmed);
  const totalPaid = confirmed.reduce((s, p) => s + p.value, 0);
  const balance   = grand - totalPaid;
  const isQuitado = balance <= 0;

  const clientTitle = event.event_name ?? event.clients?.name ?? 'Evento';
  const today = new Date().toLocaleDateString('pt-BR');

  const resumoRows: { label: string; note?: string; qty?: string; unit?: string; total: number }[] = [];
  if (isPpx) {
    if (paying > 0)  resumoRows.push({ label: 'Convidados pagantes', qty: String(paying), unit: fmtBRL(ppx), total: paying * ppx });
    if (children > 0) resumoRows.push({ label: 'Crianças', note: '(50%)', qty: String(children), unit: fmtBRL(ppx * 0.5), total: children * ppx * 0.5 });
    if (profN > 0)   resumoRows.push({ label: 'Staff', qty: String(profN), unit: fmtBRL(profV), total: profN * profV });
  } else {
    resumoRows.push({ label: 'Valor do contrato', total: contV });
  }
  additionals.forEach(a => resumoRows.push({ label: a.description ?? 'Adicional', total: a.value }));

  const resumoHtml = resumoRows.map(r => `
    <tr style="border-top:1px solid #EFECE5;">
      <td style="padding:11px 0;color:#2B2B2B;">
        ${r.label}${r.note ? ` <span style="color:#A29D92;font-size:11px;">${r.note}</span>` : ''}
      </td>
      <td style="padding:11px 0;text-align:right;color:${r.qty ? '#6B6B6B' : '#C9C5BC'};">${r.qty ?? '—'}</td>
      <td style="padding:11px 0;text-align:right;color:${r.unit ? '#6B6B6B' : '#C9C5BC'};">${r.unit ?? '—'}</td>
      <td style="padding:11px 0;text-align:right;color:#0E2A45;font-weight:600;">${fmtBRL(r.total)}</td>
    </tr>`).join('');

  const paymentsHtml = confirmed.length === 0
    ? `<div style="color:#A29D92;padding:8px 0;font-size:12px;">Nenhum pagamento registrado.</div>`
    : confirmed.map(p => `
        <div style="display:flex;justify-content:space-between;padding:11px 2px;border-bottom:1px solid #EFECE5;">
          <span style="color:#6B6B6B;font-size:12.5px;">${fmtDate(p.payment_date)}</span>
          <span style="color:#0E2A45;font-size:12.5px;font-weight:600;">${fmtBRL(p.value)}</span>
        </div>`).join('');

  const logoHtml = company?.logo_base64
    ? `<img src="${company.logo_base64}" alt="Logo" style="height:58px;width:auto;">`
    : `<span style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#0E2A45;">${company?.name ?? 'Rondello Buffet'}</span>`;

  const billingHtml = (company?.razao_social || company?.cnpj || company?.banco) ? `
    <div style="font-size:10.5px;color:#7C7C7C;line-height:1.75;">
      <div style="font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#A29D92;font-weight:600;margin-bottom:5px;">Dados para faturamento</div>
      ${company?.razao_social ? `<div>Razão social · ${company.razao_social}</div>` : ''}
      ${company?.cnpj ? `<div>CNPJ / PIX · ${company.cnpj}</div>` : ''}
      ${(company?.banco || company?.agencia || company?.conta) ? `<div>${[company?.banco && `Banco ${company.banco}`, company?.agencia && `Ag. ${company.agencia}`, company?.conta && `Conta ${company.conta}`].filter(Boolean).join(' · ')}</div>` : ''}
    </div>` : '';

  const footerLine = [company?.endereco, company?.telefone, company?.website].filter(Boolean).join(' · ');

  return `
<div style="width:794px;background:#FFFFFF;padding:40px 56px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#2B2B2B;box-sizing:border-box;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;">
    ${logoHtml}
    <div style="text-align:right;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#9A968D;line-height:1.7;">
      <div>Fechamento de evento</div>
      <div>Emitido em ${today}</div>
    </div>
  </div>

  <div style="border-top:1px solid #E7E3DB;margin-top:18px;"></div>

  <!-- Title -->
  <div style="text-align:center;margin-top:22px;">
    <div style="font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:#C2A263;font-weight:600;padding-left:.42em;">Fechamento</div>
    <h1 style="font-family:Georgia,serif;font-weight:600;font-size:38px;line-height:1.1;color:#0E2A45;margin:8px 0 0;">${clientTitle}</h1>
  </div>

  <!-- Stats strip -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:20px;border-top:1px solid #E7E3DB;border-bottom:1px solid #E7E3DB;">
    <div style="text-align:center;padding:12px;">
      <div style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#A29D92;font-weight:600;">Data do evento</div>
      <div style="font-size:18px;color:#0E2A45;margin-top:6px;font-weight:500;">${fmtDate(event.event_date)}</div>
    </div>
    <div style="text-align:center;padding:12px;border-left:1px solid #EDEAE2;border-right:1px solid #EDEAE2;">
      <div style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#A29D92;font-weight:600;">Convidados</div>
      <div style="font-size:18px;color:#0E2A45;margin-top:6px;font-weight:500;">${guests || '—'}</div>
    </div>
    <div style="text-align:center;padding:12px;">
      <div style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#A29D92;font-weight:600;">${isPpx ? 'Valor por convidado' : 'Valor do contrato'}</div>
      <div style="font-size:18px;color:#0E2A45;margin-top:6px;font-weight:500;">${fmtBRL(isPpx ? ppx : contV)}</div>
    </div>
  </div>

  <!-- Resumo -->
  <div style="margin-top:24px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <h2 style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#0E2A45;font-weight:600;white-space:nowrap;">Resumo</h2>
      <div style="flex:1;height:1px;background:#EAE6DE;"></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <thead>
        <tr style="text-align:left;color:#A29D92;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;">
          <th style="font-weight:600;padding:0 0 9px;">Item</th>
          <th style="font-weight:600;padding:0 0 9px;text-align:right;">Qtd.</th>
          <th style="font-weight:600;padding:0 0 9px;text-align:right;">Valor unit.</th>
          <th style="font-weight:600;padding:0 0 9px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${resumoHtml}
      </tbody>
    </table>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;border:1px solid #E7E3DB;padding:13px 18px;border-radius:3px;">
      <span style="font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#A29D92;font-weight:600;">Total do evento</span>
      <span style="font-size:16px;font-weight:600;color:#0E2A45;">${fmtBRL(grand)}</span>
    </div>
  </div>

  <!-- Pagamentos -->
  <div style="margin-top:28px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <h2 style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#0E2A45;font-weight:600;white-space:nowrap;">Pagamentos efetuados</h2>
      <div style="flex:1;height:1px;background:#EAE6DE;"></div>
    </div>
    <div style="font-size:12.5px;">
      ${paymentsHtml}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;border:1px solid #E7E3DB;padding:12px 16px;border-radius:3px;">
        <span style="font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#A29D92;font-weight:600;">Total pago</span>
        <span style="font-size:16px;font-weight:600;color:#0E2A45;">${fmtBRL(totalPaid)}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;background:${isQuitado ? '#F0FDF4' : '#F7F1E5'};border:1px solid ${isQuitado ? '#BBF7D0' : '#E4D4B2'};padding:12px 16px;border-radius:3px;">
        <span style="font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:${isQuitado ? '#15803D' : '#A07E2E'};font-weight:600;">${isQuitado ? 'Quitado' : 'A pagar'}</span>
        <span style="font-size:16px;font-weight:700;color:#0E2A45;">${fmtBRL(Math.abs(balance))}</span>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:34px;padding-top:18px;border-top:1px solid #E7E3DB;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;">
    ${billingHtml}
    <div style="text-align:right;font-size:10.5px;color:#A29D92;line-height:1.7;margin-left:auto;">
      <div style="font-family:Georgia,serif;font-size:20px;color:#C2A263;font-weight:600;letter-spacing:.01em;">${company?.name ?? 'Rondello Buffet'}</div>
    </div>
  </div>

  ${footerLine ? `<div style="margin-top:16px;text-align:center;font-size:9.5px;letter-spacing:.06em;color:#B0ABA0;">${footerLine}</div>` : ''}

</div>`;
}

export async function downloadFechamento(
  event: EventData,
  payments: Payment[],
  additionals: Additional[],
  company: Company | null,
) {
  const { default: html2canvas } = await import('html2canvas');

  const inner = buildHtml(event, payments, additionals, company);
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;';
  wrapper.innerHTML = inner;
  document.body.appendChild(wrapper);

  await new Promise(r => setTimeout(r, 150));

  const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#fff' });
  document.body.removeChild(wrapper);

  const PW_MM = 210, PH_MM = 297, MX_MM = 0;
  const CONTENT_W_MM = PW_MM - MX_MM * 2;
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

  const name = event.event_name ?? event.clients?.name ?? 'Evento';
  pdf.save(`FECHAMENTO - ${name}.pdf`);
}

// mantém compatibilidade legada (não usado mais, mas não quebra imports)
export function printFechamento(
  event: EventData,
  payments: Payment[],
  additionals: Additional[],
  company: Company | null,
) {
  downloadFechamento(event, payments, additionals, company);
}
