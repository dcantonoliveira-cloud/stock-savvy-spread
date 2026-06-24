import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const NAVY  = [13, 37, 73]   as [number, number, number];
const GOLD  = [180, 142, 60] as [number, number, number];
const GRAY  = [120, 120, 120] as [number, number, number];
const LIGHT = [245, 246, 248] as [number, number, number];
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
  payment_type?: string | null;
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
  non_paying_guests: number | null;
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
  const margin = 18;
  let y = 0;

  // ── Header background ───────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 42, 'F');

  // Logo placeholder (circular)
  doc.setFillColor(...GOLD);
  doc.circle(margin + 10, 21, 11, 'F');
  doc.setFillColor(...NAVY);
  doc.circle(margin + 10, 21, 9, 'F');
  doc.setTextColor(...GOLD);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('R', margin + 7, 25);

  // Brand name
  doc.setTextColor(...WHITE);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(3);
  doc.text('RONDELLO', margin + 26, 18);
  doc.setCharSpace(0);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GOLD);
  doc.text('buffet', margin + 26, 27);

  // Document type tag (top-right)
  doc.setFillColor(...GOLD);
  doc.roundedRect(W - margin - 32, 14, 32, 14, 3, 3, 'F');
  doc.setTextColor(...NAVY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setCharSpace(1);
  doc.text('FECHAMENTO', W - margin - 16, 22.5, { align: 'center' });
  doc.setCharSpace(0);

  y = 52;

  // ── Event title ─────────────────────────────────────────────────────────────
  doc.setTextColor(...NAVY);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(event.event_name ?? 'Evento', W / 2, y, { align: 'center' });
  y += 5;

  if (event.clients?.name) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(event.clients.name, W / 2, y + 3, { align: 'center' });
    y += 6;
  }

  y += 6;

  // ── Info bar ─────────────────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.roundedRect(margin, y, W - margin * 2, 20, 3, 3, 'F');

  const cols = [
    { label: 'Data do evento', value: fmtDate(event.event_date) },
    { label: 'Local', value: event.location_text ?? '—' },
    { label: 'Convidados', value: String(event.guest_count ?? '—') },
    { label: 'Valor/pax', value: event.pricing_mode === 'fixed' ? '—' : fmtBRL(event.price_per_person ?? 0) },
  ];

  const colW = (W - margin * 2) / cols.length;
  cols.forEach((col, i) => {
    const cx = margin + colW * i + colW / 2;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(col.label.toUpperCase(), cx, y + 7, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(col.value, cx, y + 14, { align: 'center' });
  });

  y += 28;

  // ── Summary table ────────────────────────────────────────────────────────────
  const isPpx = event.pricing_mode !== 'fixed';
  const guests = event.guest_count ?? 0;
  const children = event.children_50_pct ?? 0;
  const ppx = event.price_per_person ?? 0;
  const profCount = event.professional_count ?? 0;
  const profMeal = event.professional_meal_value ?? 0;
  const contractVal = event.contract_value ?? 0;

  const summaryRows: [string, string, string, string][] = [];

  if (isPpx) {
    const payingGuests = guests - children;
    if (payingGuests > 0)
      summaryRows.push(['Convidados pagantes', String(payingGuests), fmtBRL(ppx), fmtBRL(payingGuests * ppx)]);
    if (children > 0)
      summaryRows.push(['Crianças (50%)', String(children), fmtBRL(ppx * 0.5), fmtBRL(children * ppx * 0.5)]);
    if (profCount > 0)
      summaryRows.push(['Staff / Profissionais', String(profCount), fmtBRL(profMeal), fmtBRL(profCount * profMeal)]);
  } else {
    summaryRows.push(['Valor do contrato', '1', fmtBRL(contractVal), fmtBRL(contractVal)]);
  }

  additionals.forEach(a => {
    summaryRows.push([a.description ?? 'Adicional', '1', fmtBRL(a.value), fmtBRL(a.value)]);
  });

  const baseTotal = isPpx
    ? (guests - children) * ppx + children * ppx * 0.5 + profCount * profMeal
    : contractVal;
  const addTotal = additionals.reduce((s, a) => s + a.value, 0);
  const grandTotal = baseTotal + addTotal;

  // Section title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text('Resumo do evento', margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['ITEM', 'QTD', 'VALOR UNIT.', 'TOTAL']],
    body: summaryRows,
    foot: [['', '', 'Total do evento', fmtBRL(grandTotal)]],
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: BLACK,
      cellPadding: 3.5,
    },
    footStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: 4,
    },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 38, halign: 'right' },
      3: { cellWidth: 40, halign: 'right' },
    },
    theme: 'plain',
    tableLineColor: [220, 220, 225],
    tableLineWidth: 0.2,
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Payments table ───────────────────────────────────────────────────────────
  const confirmedPayments = payments.filter(p => p.is_confirmed);
  const totalPaid = confirmedPayments.reduce((s, p) => s + p.value, 0);
  const balance = grandTotal - totalPaid;

  if (y > 220) { doc.addPage(); y = 18; }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text('Pagamentos efetuados', margin, y);
  y += 2;

  const payRows = confirmedPayments.map(p => [
    fmtDate(p.payment_date),
    p.notes ?? '—',
    fmtBRL(p.value),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['DATA', 'DESCRIÇÃO', 'VALOR']],
    body: payRows.length > 0 ? payRows : [['—', '—', '—']],
    foot: [
      ['', 'Total pago', fmtBRL(totalPaid)],
      ['', balance <= 0 ? 'Crédito do cliente' : 'A pagar', fmtBRL(Math.abs(balance))],
    ],
    headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 8, fontStyle: 'bold', cellPadding: 4 },
    bodyStyles: { fontSize: 9, textColor: BLACK, cellPadding: 3.5 },
    footStyles: { fillColor: balance <= 0 ? [22, 101, 52] : [120, 53, 15] as [number,number,number], textColor: WHITE, fontStyle: 'bold', fontSize: 9, cellPadding: 3.5 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 42, halign: 'right' },
    },
    theme: 'plain',
    tableLineColor: [220, 220, 225],
    tableLineWidth: 0.2,
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Billing info ─────────────────────────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 18; }

  doc.setFillColor(...LIGHT);
  doc.roundedRect(margin, y, W - margin * 2, 36, 3, 3, 'F');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text('Dados para faturamento', margin + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  const billing = [
    'Razão Social: Paulmaris Sorocaba LTDA',
    'CNPJ (PIX): 02.646.036/0001-72',
    'Banco: Itaú 341   Agência: 4877   Conta: 00004-4',
  ];
  billing.forEach((line, i) => {
    doc.text(line, margin + 4, y + 14 + i * 6);
  });

  // ── Footer ───────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY);
    doc.rect(0, 287, W, 10, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GOLD);
    doc.text(
      'R. Dep. Ranieri Mazilli, 55  •  Campolim  •  CEP 18046-682  •  Sorocaba/SP  •  (15) 3327.2853  •  rondellobuffet.com.br',
      W / 2, 293,
      { align: 'center' }
    );
    if (pageCount > 1) {
      doc.setTextColor(...WHITE);
      doc.text(`${i} / ${pageCount}`, W - margin, 293, { align: 'right' });
    }
  }

  const safeName = (event.event_name ?? 'Evento').replace(/[^a-zA-Z0-9\s]/g, '').trim();
  doc.save(`Fechamento_${safeName}.pdf`);
}
