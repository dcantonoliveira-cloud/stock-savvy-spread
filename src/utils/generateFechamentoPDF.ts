import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Paleta (hex → RGB 0-255) ──────────────────────────────────────────────────
const NAVY   = [14,  42,  69]  as [number,number,number];
const GOLD   = [194,162, 99]   as [number,number,number];
const INK    = [43,  43,  43]  as [number,number,number];
const SMOKE  = [107,107,107]   as [number,number,number];
const MIST   = [162,157,146]   as [number,number,number];
const RULE   = [231,227,219]   as [number,number,number];
const EFEC   = [239,236,229]   as [number,number,number];
const WHITE  = [255,255,255]   as [number,number,number];
const AMBFG  = [247,241,229]   as [number,number,number];
const AMBBR  = [228,212,178]   as [number,number,number];
const AMBTX  = [160,126, 46]   as [number,number,number];
const GRNFG  = [240,253,244]   as [number,number,number];
const GRNBR  = [187,247,208]   as [number,number,number];
const GRNTX  = [ 21,128, 61]   as [number,number,number];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtBRL  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const hline = (doc: jsPDF, x1: number, y: number, x2: number, w = 0.2, color = RULE) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
};

const vline = (doc: jsPDF, x: number, y1: number, y2: number, color = RULE) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.2);
  doc.line(x, y1, x, y2);
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CompanySettings {
  name: string | null; logo_base64: string | null;
  razao_social: string | null; cnpj: string | null;
  banco: string | null; agencia: string | null; conta: string | null;
  endereco: string | null; telefone: string | null; website: string | null;
}
interface Payment { payment_date: string | null; value: number; notes: string | null; is_confirmed: boolean }
interface Additional { description: string | null; value: number }
interface EventData {
  event_name: string | null; event_date: string | null;
  guest_count: number | null; children_50_pct: number | null;
  price_per_person: number | null; professional_count: number | null;
  professional_meal_value: number | null; pricing_mode: string | null;
  contract_value: number | null;
  clients: { name: string | null } | null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
export async function generateFechamentoPDF(
  event: EventData,
  payments: Payment[],
  additionals: Additional[],
  company: CompanySettings | null,
) {
  const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW   = 210;
  const M    = 15;                      // margem lateral
  const CW   = PW - M * 2;             // largura útil: 180mm
  let y      = 0;

  // ── Cálculos financeiros ──────────────────────────────────────────────────
  const isPpx    = event.pricing_mode !== 'fixed';
  const guests   = event.guest_count ?? 0;
  const children = event.children_50_pct ?? 0;
  const ppx      = event.price_per_person ?? 0;
  const profN    = event.professional_count ?? 0;
  const profV    = event.professional_meal_value ?? 0;
  const contV    = event.contract_value ?? 0;
  const paying   = guests - children;

  const base  = isPpx
    ? paying * ppx + children * ppx * 0.5 + profN * profV
    : contV;
  const grand = base + additionals.reduce((s, a) => s + a.value, 0);

  const confirmed  = payments.filter(p => p.is_confirmed);
  const totalPaid  = confirmed.reduce((s, p) => s + p.value, 0);
  const balance    = grand - totalPaid;
  const isQuitado  = balance <= 0;

  const clientTitle = event.event_name ?? event.clients?.name ?? 'Evento';

  // ── HEADER ────────────────────────────────────────────────────────────────
  y = 13;

  // Logo
  if (company?.logo_base64) {
    try { doc.addImage(company.logo_base64, 'PNG', M, y - 4, 0, 14); }
    catch (_) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...NAVY);
      doc.text(company?.name ?? 'Rondello Buffet', M, y + 6);
    }
  } else {
    // Fallback: nome em navy
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(company?.name ?? 'Rondello Buffet', M, y + 6);
  }

  // Canto superior direito: etiqueta + data
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MIST);
  doc.setCharSpace(1.2);
  doc.text('FECHAMENTO DE EVENTO', PW - M, y, { align: 'right' });
  doc.setCharSpace(0);
  y += 4.5;
  doc.setFontSize(7);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, PW - M, y, { align: 'right' });

  y = 28;
  hline(doc, M, y, PW - M);

  // ── TÍTULO (centralizado) ──────────────────────────────────────────────────
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.setCharSpace(3.5);
  doc.text('FECHAMENTO', PW / 2, y, { align: 'center' });
  doc.setCharSpace(0);

  y += 6;
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...NAVY);
  doc.text(clientTitle, PW / 2, y, { align: 'center' });

  // ── STATS STRIP ───────────────────────────────────────────────────────────
  y += 9;
  hline(doc, M, y, PW - M);
  const statsH = 18;
  const colW   = CW / 3;

  // Célula 1: Data
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...MIST);
  doc.setCharSpace(1);
  doc.text('DATA DO EVENTO', M + colW * 0 + colW / 2, y + 6, { align: 'center' });
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(fmtDate(event.event_date), M + colW * 0 + colW / 2, y + 13, { align: 'center' });

  // Separadores verticais
  vline(doc, M + colW,     y + 2, y + statsH - 1);
  vline(doc, M + colW * 2, y + 2, y + statsH - 1);

  // Célula 2: Convidados
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...MIST);
  doc.setCharSpace(1);
  doc.text('CONVIDADOS', M + colW * 1 + colW / 2, y + 6, { align: 'center' });
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(String(guests || '—'), M + colW * 1 + colW / 2, y + 13, { align: 'center' });

  // Célula 3: Valor/pax ou contrato
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...MIST);
  doc.setCharSpace(1);
  doc.text(isPpx ? 'VALOR POR CONVIDADO' : 'VALOR DO CONTRATO', M + colW * 2 + colW / 2, y + 6, { align: 'center' });
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(fmtBRL(isPpx ? ppx : contV), M + colW * 2 + colW / 2, y + 13, { align: 'center' });

  y += statsH;
  hline(doc, M, y, PW - M);

  // ── SEÇÃO: RESUMO ──────────────────────────────────────────────────────────
  y += 9;

  // Título da seção
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.setCharSpace(1.2);
  doc.text('RESUMO', M, y);
  doc.setCharSpace(0);
  // linha dourada à direita do título
  const resumoTitleW = doc.getTextWidth('RESUMO') + 2;
  hline(doc, M + resumoTitleW + 3, y - 0.5, PW - M, 0.3, RULE);

  y += 4;

  // Linhas da tabela
  const resumoRows: [string, string, string, string][] = [];
  if (isPpx) {
    if (paying > 0) resumoRows.push(['Convidados pagantes', String(paying), fmtBRL(ppx), fmtBRL(paying * ppx)]);
    if (children > 0) resumoRows.push([`Crianças (50%)`, String(children), fmtBRL(ppx * 0.5), fmtBRL(children * ppx * 0.5)]);
    if (profN > 0) resumoRows.push(['Staff', String(profN), fmtBRL(profV), fmtBRL(profN * profV)]);
  } else {
    resumoRows.push(['Valor do contrato', '—', '—', fmtBRL(contV)]);
  }
  additionals.forEach(a => resumoRows.push([a.description ?? 'Adicional', '—', '—', fmtBRL(a.value)]));

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Item', 'Qtd.', 'Valor unit.', 'Total']],
    body: resumoRows,
    headStyles: {
      fillColor: WHITE,
      textColor: MIST,
      fontSize: 6.5,
      fontStyle: 'bold',
      cellPadding: { top: 2, bottom: 5, left: 2, right: 2 },
    },
    bodyStyles: {
      fontSize: 9,
      textColor: INK,
      cellPadding: { top: 3.5, bottom: 3.5, left: 2, right: 2 },
      lineColor: EFEC,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 22, halign: 'right', textColor: SMOKE },
      2: { cellWidth: 34, halign: 'right', textColor: SMOKE },
      3: { cellWidth: 36, halign: 'right', fontStyle: 'bold', textColor: NAVY },
    },
    theme: 'plain',
    tableLineColor: EFEC,
    tableLineWidth: 0.2,
  });

  y = (doc as any).lastAutoTable.finalY;

  // Card total (mesmo estilo do card "Total Pago")
  const barH = 11;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, barH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...MIST);
  doc.setCharSpace(0.8);
  doc.text('TOTAL DO EVENTO', M + 4, y + 4.5);
  doc.setCharSpace(0);
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(fmtBRL(grand), PW - M - 4, y + 7.5, { align: 'right' });

  y += barH + 10;

  // ── SEÇÃO: PAGAMENTOS ──────────────────────────────────────────────────────
  if (y > 215) { doc.addPage(); y = 18; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.setCharSpace(1.2);
  doc.text('PAGAMENTOS EFETUADOS', M, y);
  doc.setCharSpace(0);
  const pagTitleW = doc.getTextWidth('PAGAMENTOS EFETUADOS') + 2;
  hline(doc, M + pagTitleW + 3, y - 0.5, PW - M, 0.3, RULE);

  y += 5;

  if (confirmed.length > 0) {
    // Cabeçalho — mesmo estilo do head da tabela resumo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...MIST);
    doc.setCharSpace(0.8);
    doc.text('DATA', M + 2, y);
    doc.text('VALOR', PW - M - 2, y, { align: 'right' });
    doc.setCharSpace(0);
    y += 5;
    hline(doc, M, y, PW - M, 0.2, EFEC);

    confirmed.forEach((p) => {
      y += 7; // mesmo cellPadding top+bottom da tabela resumo (~3.5+3.5)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...SMOKE);
      doc.text(fmtDate(p.payment_date), M + 2, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(fmtBRL(p.value), PW - M - 2, y, { align: 'right' });
      hline(doc, M, y + 3, PW - M, 0.2, EFEC);
    });
    y += 3;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MIST);
    doc.text('Nenhum pagamento registrado.', M, y + 5);
    y += 8;
  }

  y += 8;

  // Cards resumo (dois lado a lado)
  const cardH = 11;
  const cardW = (CW - 5) / 2;

  // Card: Total pago
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.rect(M, y, cardW, cardH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...MIST);
  doc.setCharSpace(0.8);
  doc.text('TOTAL PAGO', M + 4, y + 4.5);
  doc.setCharSpace(0);
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(fmtBRL(totalPaid), M + cardW - 4, y + 7.5, { align: 'right' });

  // Card: A pagar / Quitado
  const cx = M + cardW + 5;
  doc.setFillColor(...(isQuitado ? GRNFG : AMBFG));
  doc.rect(cx, y, cardW, cardH, 'F');
  doc.setDrawColor(...(isQuitado ? GRNBR : AMBBR));
  doc.setLineWidth(0.3);
  doc.rect(cx, y, cardW, cardH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...(isQuitado ? GRNTX : AMBTX));
  doc.setCharSpace(0.8);
  doc.text(isQuitado ? 'QUITADO' : 'A PAGAR', cx + 4, y + 4.5);
  doc.setCharSpace(0);
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(fmtBRL(Math.abs(balance)), cx + cardW - 4, y + 7.5, { align: 'right' });

  y += cardH + 12;

  // ── RODAPÉ ────────────────────────────────────────────────────────────────
  if (y > 255) { doc.addPage(); y = 18; }

  hline(doc, M, y, PW - M, 0.3, RULE);
  y += 6;

  // Dados bancários (esquerda)
  const hasBilling = company?.razao_social || company?.cnpj || company?.banco;
  if (hasBilling) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...MIST);
    doc.setCharSpace(0.8);
    doc.text('DADOS PARA FATURAMENTO', M, y);
    doc.setCharSpace(0);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...SMOKE);
    if (company?.razao_social) { doc.text(`Razão social · ${company.razao_social}`, M, y); y += 4.5; }
    if (company?.cnpj) { doc.text(`CNPJ / PIX · ${company.cnpj}`, M, y); y += 4.5; }
    const bankParts = [
      company?.banco && `Banco ${company.banco}`,
      company?.agencia && `Ag. ${company.agencia}`,
      company?.conta && `Conta ${company.conta}`,
    ].filter(Boolean);
    if (bankParts.length) doc.text(bankParts.join(' · '), M, y);
  }

  // Assinatura Rondello (direita)
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(16);
  doc.setTextColor(...GOLD);
  doc.text('Rondello Buffet', PW - M, hasBilling ? y - 4 : y, { align: 'right' });

  // Linha de endereço (centro inferior)
  const footerParts = [company?.endereco, company?.telefone, company?.website].filter(Boolean);
  if (footerParts.length) {
    const footY = 282;
    hline(doc, M, footY - 3, PW - M, 0.2, RULE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MIST);
    doc.setCharSpace(0.3);
    doc.text(footerParts.join(' · '), PW / 2, footY + 2, { align: 'center' });
    doc.setCharSpace(0);
  }

  const safe = (clientTitle).replace(/[^a-zA-Z0-9\s]/g, '').trim();
  doc.save(`Fechamento_${safe}.pdf`);
}
