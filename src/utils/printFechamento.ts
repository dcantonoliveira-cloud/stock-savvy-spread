// Abre o fechamento em nova janela com o design exato do Claude Design
// e dispara o print automaticamente.

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

export function printFechamento(
  event: EventData,
  payments: Payment[],
  additionals: Additional[],
  company: Company | null,
) {
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

  // ── Linhas da tabela Resumo ────────────────────────────────────────────────
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
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #EFECE5;">
          <span style="color:#6B6B6B;">${fmtDate(p.payment_date)}</span>
          <span style="color:#2B2B2B;">${fmtBRL(p.value)}</span>
        </div>`).join('');

  const logoHtml = company?.logo_base64
    ? `<img src="${company.logo_base64}" alt="Logo" style="height:58px;width:auto;">`
    : `<span style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:600;color:#0E2A45;">${company?.name ?? 'Rondello Buffet'}</span>`;

  const billingHtml = (company?.razao_social || company?.cnpj || company?.banco) ? `
    <div style="font-size:10.5px;color:#7C7C7C;line-height:1.75;">
      <div style="font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#A29D92;font-weight:600;margin-bottom:5px;">Dados para faturamento</div>
      ${company?.razao_social ? `<div>Razão social · ${company.razao_social}</div>` : ''}
      ${company?.cnpj ? `<div>CNPJ / PIX · ${company.cnpj}</div>` : ''}
      ${(company?.banco || company?.agencia || company?.conta) ? `<div>${[company?.banco && `Banco ${company.banco}`, company?.agencia && `Ag. ${company.agencia}`, company?.conta && `Conta ${company.conta}`].filter(Boolean).join(' · ')}</div>` : ''}
    </div>` : '';

  const footerLine = [company?.endereco, company?.telefone, company?.website].filter(Boolean).join(' · ');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Fechamento — ${clientTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Libre+Franklin:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#E7E4DD;font-family:'Libre Franklin',sans-serif;color:#2B2B2B;}
    @media print{
      body{background:#fff;}
      .page{box-shadow:none!important;margin:0!important;}
    }
  </style>
</head>
<body>
<div class="page" style="width:794px;min-height:1123px;margin:32px auto;background:#FFFFFF;box-shadow:0 8px 40px rgba(14,42,69,.10);padding:40px 56px;position:relative;overflow:hidden;">

  <!-- Emblem watermark -->
  <img src="${window.location.origin}/emblem-rondello.png" alt="" style="position:absolute;width:520px;height:520px;right:-150px;bottom:-150px;opacity:.045;pointer-events:none;user-select:none;">

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
    <h1 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:42px;line-height:1.06;color:#0E2A45;margin:8px 0 0;">${clientTitle}</h1>
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
      <tbody style="font-variant-numeric:tabular-nums;">
        ${resumoHtml}
      </tbody>
    </table>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;background:#0E2A45;color:#FFFFFF;padding:13px 18px;border-radius:3px;">
      <span style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:#C9D4E0;">Total do evento</span>
      <span style="font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;">${fmtBRL(grand)}</span>
    </div>
  </div>

  <!-- Pagamentos -->
  <div style="margin-top:28px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <h2 style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#0E2A45;font-weight:600;white-space:nowrap;">Pagamentos efetuados</h2>
      <div style="flex:1;height:1px;background:#EAE6DE;"></div>
    </div>
    <div style="font-size:12.5px;font-variant-numeric:tabular-nums;">
      ${paymentsHtml}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;border:1px solid #E7E3DB;padding:12px 16px;border-radius:3px;">
        <span style="font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#A29D92;font-weight:600;">Total pago</span>
        <span style="font-size:16px;font-weight:600;color:#0E2A45;font-variant-numeric:tabular-nums;">${fmtBRL(totalPaid)}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;background:${isQuitado ? '#F0FDF4' : '#F7F1E5'};border:1px solid ${isQuitado ? '#BBF7D0' : '#E4D4B2'};padding:12px 16px;border-radius:3px;">
        <span style="font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:${isQuitado ? '#15803D' : '#A07E2E'};font-weight:600;">${isQuitado ? 'Quitado' : 'A pagar'}</span>
        <span style="font-size:16px;font-weight:700;color:#0E2A45;font-variant-numeric:tabular-nums;">${fmtBRL(Math.abs(balance))}</span>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:34px;padding-top:18px;border-top:1px solid #E7E3DB;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;">
    ${billingHtml}
    <div style="text-align:right;font-size:10.5px;color:#A29D92;line-height:1.7;margin-left:auto;">
      <div style="font-family:'Cormorant Garamond',serif;font-size:20px;color:#C2A263;font-weight:600;letter-spacing:.01em;">Rondello Buffet</div>
    </div>
  </div>

  ${footerLine ? `<div style="margin-top:16px;text-align:center;font-size:9.5px;letter-spacing:.06em;color:#B0ABA0;">${footerLine}</div>` : ''}

</div>
<script>
  // Aguarda as fontes carregarem antes de imprimir
  document.fonts.ready.then(function() {
    setTimeout(function() { window.print(); }, 300);
  });
</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=900');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
