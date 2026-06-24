import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const NAVY  = [13, 37, 73]    as [number, number, number];
const DGRAY = [60, 60, 60]    as [number, number, number];
const LGRAY = [160, 160, 160] as [number, number, number];
const THEAD = [235, 236, 238] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const BLACK = [20, 20, 20]    as [number, number, number];

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export interface CompanySettings {
  name: string | null;
  logo_base64: string | null;
  razao_social: string | null;
  cnpj: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  endereco: string | null;
  telefone: string | null;
  website: string | null;
}

interface Payment {
  payment_date: string | null;
  value: number;
  notes: string | null;
  is_confirmed: boolean;
}

interface Additional {
  description: string | null;
  value: number;
}

interface EventData {
  event_name: string | null;
  event_date: string | null;
  guest_count: number | null;
  children_50_pct: number | null;
  price_per_person: number | null;
  professional_count: number | null;
  professional_meal_value: number | null;
  pricing_mode: string | null;
  contract_value: number | null;
  location_text: string | null;
  clients: { name: string | null } | null;
}

export async function generateFechamentoPDF(
  event: EventData,
  payments: Payment[],
  additionals: Additional[],
  company: CompanySettings | null,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 18;
  let y = 14;

  // ── Cabeçalho ────────────────────────────────────────────────────────────────
  if (company?.logo_base64) {
    try {
      doc.addImage(company.logo_base64, 'PNG', M, y, 28, 14);
    } catch (_) {}
    // Nome da empresa ao lado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...NAVY);
    doc.text(company.name ?? '', M + 32, y + 6);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.text(company?.name ?? '', M, y + 6);
  }

  // Data de emissão (direita)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...LGRAY);
  const hoje = new Date().toLocaleDateString('pt-BR');
  doc.text(`Emitido em ${hoje}`, W - M, y + 6, { align: 'right' });

  y += 18;

  // Linha divisória
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 7;

  // ── Título ───────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text(`Fechamento — ${event.event_name ?? 'Evento'}`, W / 2, y, { align: 'center' });
  if (event.clients?.name) {
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...LGRAY);
    doc.text(event.clients.name, W / 2, y, { align: 'center' });
  }
  y += 8;

  // ── Info compacta: 3 colunas em linha ────────────────────────────────────────
  const isPpx = event.pricing_mode !== 'fixed';
  const infoItems = [
    { label: 'Data do evento', value: fmtDate(event.event_date) },
    { label: 'Convidados', value: String(event.guest_count ?? '—') },
    isPpx
      ? { label: 'Valor por convidado', value: fmtBRL(event.price_per_person ?? 0) }
      : { label: 'Valor do contrato', value: fmtBRL(event.contract_value ?? 0) },
  ];

  const colW = (W - M * 2) / 3;
  infoItems.forEach((item, i) => {
    const cx = M + colW * i + colW / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...LGRAY);
    doc.text(item.label, cx, y, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...BLACK);
    doc.text(item.value, cx, y + 4.5, { align: 'center' });
  });

  y += 11;
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);
  y += 6;

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const guests    = event.guest_count ?? 0;
  const children  = event.children_50_pct ?? 0;
  const ppx       = event.price_per_person ?? 0;
  const profCount = event.professional_count ?? 0;
  const profMeal  = event.professional_meal_value ?? 0;
  const contractV = event.contract_value ?? 0;

  const rows: [string, string, string, string][] = [];

  if (isPpx) {
    const paying = guests - children;
    if (paying > 0)   rows.push(['Convidados pagantes', String(paying), fmtBRL(ppx), fmtBRL(paying * ppx)]);
    if (children > 0) rows.push(['Crianças (50%)', String(children), fmtBRL(ppx * 0.5), fmtBRL(children * ppx * 0.5)]);
    if (profCount > 0) rows.push(['Staff', String(profCount), fmtBRL(profMeal), fmtBRL(profCount * profMeal)]);
  } else {
    rows.push(['Valor do contrato', '1', fmtBRL(contractV), fmtBRL(contractV)]);
  }
  additionals.forEach(a => rows.push([a.description ?? 'Adicional', '1', fmtBRL(a.value), fmtBRL(a.value)]));

  const baseTotal  = isPpx
    ? (guests - children) * ppx + children * ppx * 0.5 + profCount * profMeal
    : contractV;
  const grandTotal = baseTotal + additionals.reduce((s, a) => s + a.value, 0);

  // ── Tabela Resumo ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('Resumo', M, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['ITEM', 'QUANTIDADE', 'VALOR', 'TOTAL']],
    body: rows,
    foot: [['', '', 'Total do Evento', fmtBRL(grandTotal)]],
    headStyles: {
      fillColor: THEAD,
      textColor: DGRAY,
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: BLACK,
      cellPadding: 2.5,
    },
    footStyles: {
      fillColor: WHITE,
      textColor: BLACK,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 36, halign: 'right' },
      3: { cellWidth: 38, halign: 'right' },
    },
    theme: 'plain',
    tableLineColor: [210, 212, 215],
    tableLineWidth: 0.2,
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // ── Tabela Pagamentos ─────────────────────────────────────────────────────────
  const confirmed = payments.filter(p => p.is_confirmed);
  const totalPaid = confirmed.reduce((s, p) => s + p.value, 0);
  const balance   = grandTotal - totalPaid;

  if (y > 230) { doc.addPage(); y = 14; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('Pagamentos efetuados', M, y);
  y += 2;

  const payRows = confirmed.map(p => [fmtDate(p.payment_date), p.notes ?? '', fmtBRL(p.value)]);

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['DATA', 'DESCRIÇÃO', 'VALOR']],
    body: payRows.length > 0 ? payRows : [['—', '—', '—']],
    foot: [
      ['', 'Total pago', fmtBRL(totalPaid)],
      ['', balance > 0 ? 'A pagar' : 'Crédito do cliente', fmtBRL(Math.abs(balance))],
    ],
    headStyles: {
      fillColor: THEAD,
      textColor: DGRAY,
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2.5,
    },
    bodyStyles: { fontSize: 8.5, textColor: BLACK, cellPadding: 2.5 },
    footStyles: { fillColor: WHITE, textColor: BLACK, fontStyle: 'bold', fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 40, halign: 'right' },
    },
    theme: 'plain',
    tableLineColor: [210, 212, 215],
    tableLineWidth: 0.2,
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // ── Dados bancários ───────────────────────────────────────────────────────────
  const hasBilling = company?.razao_social || company?.cnpj || company?.banco;
  if (hasBilling) {
    if (y > 240) { doc.addPage(); y = 14; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text('Dados para faturamento', M, y);
    y += 4;

    const lines: string[] = [];
    if (company?.razao_social) lines.push(`Razão Social: ${company.razao_social}`);
    if (company?.cnpj)         lines.push(`CNPJ: ${company.cnpj}`);
    if (company?.banco)        lines.push(`Banco: ${company.banco}`);
    if (company?.agencia)      lines.push(`Agência: ${company.agencia}`);
    if (company?.conta)        lines.push(`Conta: ${company.conta}`);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DGRAY);
    lines.forEach((line, i) => doc.text(line, M, y + i * 4.5));
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  const footerParts = [
    company?.endereco,
    company?.telefone,
    company?.website,
  ].filter(Boolean);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (footerParts.length > 0) {
      doc.setDrawColor(...LGRAY);
      doc.setLineWidth(0.2);
      doc.line(M, 284, W - M, 284);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...LGRAY);
      doc.text(footerParts.join('  •  '), W / 2, 290, { align: 'center' });
    }
  }

  const safeName = (event.event_name ?? 'Evento').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  doc.save(`Fechamento_${safeName}.pdf`);
}
