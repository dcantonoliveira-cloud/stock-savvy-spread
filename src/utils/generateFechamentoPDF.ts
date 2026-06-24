import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const NAVY  = [13, 37, 73]   as [number, number, number];
const GOLD  = [180, 142, 60] as [number, number, number];
const DGRAY = [80, 80, 80]   as [number, number, number];
const LGRAY = [150, 150, 150] as [number, number, number];
const THEAD = [240, 241, 243] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const BLACK = [30, 30, 30]   as [number, number, number];

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

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
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 20;
  let y = 18;

  // ── Logo: círculo navy + R dourado ──────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.circle(margin + 9, y + 9, 9, 'F');
  doc.setFillColor(...GOLD);
  doc.circle(margin + 9, y + 9, 7, 'F');
  doc.setFillColor(...NAVY);
  doc.circle(margin + 9, y + 9, 5.5, 'F');
  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('R', margin + 6.5, y + 12.5);

  // Nome da marca
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setCharSpace(4);
  doc.text('RONDELLO', margin + 23, y + 9);
  doc.setCharSpace(0);

  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(13);
  doc.text('buffet', margin + 23, y + 16);

  y += 30;

  // ── Linha separadora ─────────────────────────────────────────────────────────
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W - margin, y);
  y += 10;

  // ── Título ───────────────────────────────────────────────────────────────────
  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Fechamento - ${event.event_name ?? 'Evento'}`, W / 2, y, { align: 'center' });
  y += 12;

  // ── Info row: 3 colunas ──────────────────────────────────────────────────────
  const isPpx = event.pricing_mode !== 'fixed';
  const infoItems = [
    { label: 'Data do evento', value: fmtDate(event.event_date) },
    { label: 'Quantidade de convidados', value: String(event.guest_count ?? '—') },
    isPpx
      ? { label: 'Valor por convidado', value: fmtBRL(event.price_per_person ?? 0) }
      : { label: 'Valor do contrato', value: fmtBRL(event.contract_value ?? 0) },
  ];

  const colW = (W - margin * 2) / 3;
  infoItems.forEach((item, i) => {
    const cx = margin + colW * i + colW / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...LGRAY);
    doc.text(item.label, cx, y, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text(item.value, cx, y + 6, { align: 'center' });
  });

  y += 14;

  // Linha fina abaixo das infos
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.2);
  doc.line(margin, y, W - margin, y);
  y += 10;

  // ── Resumo ───────────────────────────────────────────────────────────────────
  const guests    = event.guest_count ?? 0;
  const children  = event.children_50_pct ?? 0;
  const ppx       = event.price_per_person ?? 0;
  const profCount = event.professional_count ?? 0;
  const profMeal  = event.professional_meal_value ?? 0;
  const contractV = event.contract_value ?? 0;

  const rows: [string, string, string, string][] = [];

  if (isPpx) {
    const paying = guests - children;
    if (paying > 0) rows.push(['Convidados pagantes', String(paying), fmtBRL(ppx), fmtBRL(paying * ppx)]);
    if (children > 0) rows.push(['Crianças (50%)', String(children), fmtBRL(ppx * 0.5), fmtBRL(children * ppx * 0.5)]);
    if (profCount > 0) rows.push(['Staff', String(profCount), fmtBRL(profMeal), fmtBRL(profCount * profMeal)]);
  } else {
    rows.push(['Valor do contrato', '1', fmtBRL(contractV), fmtBRL(contractV)]);
  }

  additionals.forEach(a => {
    rows.push([a.description ?? 'Adicional', '1', fmtBRL(a.value), fmtBRL(a.value)]);
  });

  const baseTotal = isPpx
    ? (guests - children) * ppx + children * ppx * 0.5 + profCount * profMeal
    : contractV;
  const grandTotal = baseTotal + additionals.reduce((s, a) => s + a.value, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text('Resumo', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['ITEM', 'QUANTIDADE', 'VALOR', 'TOTAL']],
    body: rows,
    foot: [['', '', 'Total do Evento', fmtBRL(grandTotal)]],
    headStyles: {
      fillColor: THEAD,
      textColor: DGRAY,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: BLACK,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
    },
    footStyles: {
      fillColor: WHITE,
      textColor: BLACK,
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 32, halign: 'center' },
      2: { cellWidth: 38, halign: 'right' },
      3: { cellWidth: 40, halign: 'right' },
    },
    theme: 'plain',
    tableLineColor: [220, 221, 224],
    tableLineWidth: 0.25,
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Pagamentos ───────────────────────────────────────────────────────────────
  const confirmed = payments.filter(p => p.is_confirmed);
  const totalPaid = confirmed.reduce((s, p) => s + p.value, 0);
  const balance   = grandTotal - totalPaid;

  if (y > 220) { doc.addPage(); y = 18; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text('Pagamentos efetuados', margin, y);
  y += 4;

  const payRows = confirmed.map(p => [fmtDate(p.payment_date), fmtBRL(p.value)]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['DATA DO PAGAMENTO', 'TOTAL']],
    body: payRows.length > 0 ? payRows : [['—', '—']],
    foot: [
      ['Total pago', fmtBRL(totalPaid)],
      [balance > 0 ? 'A pagar' : 'Crédito do cliente', fmtBRL(Math.abs(balance))],
    ],
    headStyles: {
      fillColor: THEAD,
      textColor: DGRAY,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: BLACK,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
    },
    footStyles: {
      fillColor: WHITE,
      textColor: BLACK,
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 50, halign: 'right' },
    },
    theme: 'plain',
    tableLineColor: [220, 221, 224],
    tableLineWidth: 0.25,
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Dados para faturamento ───────────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = 18; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text('Dados para faturamento', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DGRAY);
  const billing = [
    'Razão Social: Paulmaris Sorocaba LTDA',
    'CNPJ (PIX): 02.646.036/0001-72',
    'Banco: Itaú 341',
    'Agencia: 4877',
    'Conta: 00004-4',
  ];
  billing.forEach((line, i) => {
    doc.text(line, margin, y + 6 + i * 5);
  });

  // ── Rodapé ───────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.line(margin, 285, W - margin, 285);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...LGRAY);
    doc.text(
      'R. Dep. Ranieri Mazilli, 55  •  Campolim  •  CEP 18046-682  •  Sorocaba/SP  •  (15) 3327.2853  •  rondellobuffet.com.br',
      W / 2, 291, { align: 'center' }
    );
  }

  const safeName = (event.event_name ?? 'Evento').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  doc.save(`Fechamento_${safeName}.pdf`);
}
