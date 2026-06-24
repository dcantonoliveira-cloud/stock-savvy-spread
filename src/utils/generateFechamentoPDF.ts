import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Paleta
const NAVY   = [13,  37,  73]  as [number,number,number];
const GOLD   = [180,142, 60]   as [number,number,number];
const INK    = [28,  28,  35]  as [number,number,number];
const SMOKE  = [100,100,112]   as [number,number,number];
const MIST   = [165,165,175]   as [number,number,number];
const SNOW   = [248,248,250]   as [number,number,number];
const WHITE  = [255,255,255]   as [number,number,number];
const RULE   = [220,221,226]   as [number,number,number];

const fmtBRL = (v:number) => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate = (d:string|null) => {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export interface CompanySettings {
  name:string|null; logo_base64:string|null;
  razao_social:string|null; cnpj:string|null;
  banco:string|null; agencia:string|null; conta:string|null;
  endereco:string|null; telefone:string|null; website:string|null;
}
interface Payment { payment_date:string|null; value:number; notes:string|null; is_confirmed:boolean }
interface Additional { description:string|null; value:number }
interface EventData {
  event_name:string|null; event_date:string|null;
  guest_count:number|null; children_50_pct:number|null;
  price_per_person:number|null; professional_count:number|null;
  professional_meal_value:number|null; pricing_mode:string|null;
  contract_value:number|null; location_text:string|null;
  clients:{name:string|null}|null;
}

// helpers
const rule = (doc:jsPDF, x1:number, y:number, x2:number, w=0.25, color=RULE) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
};

const pill = (doc:jsPDF, x:number, y:number, w:number, h:number, color:[number,number,number]) => {
  doc.setFillColor(...color);
  doc.roundedRect(x, y, w, h, h/2, h/2, 'F');
};

export async function generateFechamentoPDF(
  event:EventData, payments:Payment[], additionals:Additional[], company:CompanySettings|null
) {
  const doc = new jsPDF({unit:'mm', format:'a4'});
  const PW = 210, PH = 297;
  const M = 20;
  let y = 0;

  // ══════════════════════════════════════════════════════════
  // FAIXA SUPERIOR navy
  // ══════════════════════════════════════════════════════════
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, 48, 'F');

  // Logo ou nome da empresa
  if (company?.logo_base64) {
    try { doc.addImage(company.logo_base64, 'PNG', M, 10, 0, 28); } catch(_) {}
  } else {
    doc.setFont('helvetica','bold');
    doc.setFontSize(18);
    doc.setTextColor(...WHITE);
    doc.setCharSpace(2);
    doc.text((company?.name ?? '').toUpperCase(), M, 30);
    doc.setCharSpace(0);
  }

  // Badge "FECHAMENTO" — direita
  pill(doc, PW-M-30, 17, 30, 8, GOLD);
  doc.setFont('helvetica','bold');
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.setCharSpace(1.2);
  doc.text('FECHAMENTO', PW-M-15, 22.5, {align:'center'});
  doc.setCharSpace(0);

  // data de emissão
  doc.setFont('helvetica','normal');
  doc.setFontSize(7.5);
  doc.setTextColor(200,205,215);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, PW-M-15, 31, {align:'center'});

  y = 56;

  // ══════════════════════════════════════════════════════════
  // TÍTULO
  // ══════════════════════════════════════════════════════════
  doc.setFont('helvetica','bold');
  doc.setFontSize(17);
  doc.setTextColor(...INK);
  doc.text(event.event_name ?? 'Evento', M, y);

  if (event.clients?.name) {
    y += 6;
    doc.setFont('helvetica','normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...SMOKE);
    doc.text(event.clients.name, M, y);
  }

  y += 10;
  rule(doc, M, y, PW-M, 0.6, [...GOLD] as any);
  y += 8;

  // ══════════════════════════════════════════════════════════
  // KPIs — 3 blocos horizontais
  // ══════════════════════════════════════════════════════════
  const isPpx = event.pricing_mode !== 'fixed';
  const kpis = [
    { label:'DATA DO EVENTO',      value: fmtDate(event.event_date) },
    { label:'CONVIDADOS',          value: String(event.guest_count ?? '—') },
    { label: isPpx ? 'VALOR/PAX' : 'VALOR DO CONTRATO',
      value: fmtBRL(isPpx ? (event.price_per_person??0) : (event.contract_value??0)) },
  ];
  const kw = (PW - M*2) / 3;
  kpis.forEach((k,i) => {
    const kx = M + kw*i;
    if (i > 0) {
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.3);
      doc.line(kx, y-2, kx, y+13);
    }
    doc.setFont('helvetica','normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MIST);
    doc.text(k.label, kx+4, y+2);

    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(k.value, kx+4, y+10);
  });

  y += 20;
  rule(doc, M, y, PW-M);
  y += 8;

  // ══════════════════════════════════════════════════════════
  // COMPOSIÇÃO DO VALOR
  // ══════════════════════════════════════════════════════════
  const guests   = event.guest_count ?? 0;
  const children = event.children_50_pct ?? 0;
  const ppx      = event.price_per_person ?? 0;
  const profN    = event.professional_count ?? 0;
  const profV    = event.professional_meal_value ?? 0;
  const contV    = event.contract_value ?? 0;

  const composRows:[string,string,string][] = [];
  if (isPpx) {
    const paying = guests - children;
    if (paying > 0)  composRows.push([`Convidados pagantes`,  `${paying} × ${fmtBRL(ppx)}`,  fmtBRL(paying*ppx)]);
    if (children>0)  composRows.push([`Crianças (50%)`,       `${children} × ${fmtBRL(ppx*0.5)}`, fmtBRL(children*ppx*0.5)]);
    if (profN>0)     composRows.push([`Staff`,                `${profN} × ${fmtBRL(profV)}`, fmtBRL(profN*profV)]);
  } else {
    composRows.push(['Valor do contrato','—', fmtBRL(contV)]);
  }
  additionals.forEach(a => composRows.push([a.description??'Adicional','—', fmtBRL(a.value)]));

  const base  = isPpx ? (guests-children)*ppx + children*ppx*0.5 + profN*profV : contV;
  const grand = base + additionals.reduce((s,a)=>s+a.value, 0);

  // Título seção
  doc.setFont('helvetica','bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('COMPOSIÇÃO DO VALOR', M, y);
  y += 4;

  autoTable(doc,{
    startY: y,
    margin: {left:M, right:M},
    head: [['Item','Detalhamento','Total']],
    body: composRows,
    headStyles:{
      fillColor: SNOW, textColor: SMOKE, fontSize:7, fontStyle:'bold',
      cellPadding:{top:3,bottom:3,left:4,right:4},
    },
    bodyStyles:{
      fontSize:8.5, textColor:INK,
      cellPadding:{top:3.2,bottom:3.2,left:4,right:4},
    },
    alternateRowStyles:{ fillColor:WHITE },
    columnStyles:{
      0:{cellWidth:'auto'},
      1:{cellWidth:52, textColor:SMOKE as any, fontSize:8},
      2:{cellWidth:38, halign:'right', fontStyle:'bold'},
    },
    theme:'plain',
    tableLineColor: RULE,
    tableLineWidth: 0.18,
    // total row
    foot:[['','Total do evento', fmtBRL(grand)]],
    footStyles:{
      fillColor:NAVY, textColor:WHITE, fontSize:9, fontStyle:'bold',
      cellPadding:{top:4,bottom:4,left:4,right:4},
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ══════════════════════════════════════════════════════════
  // PAGAMENTOS
  // ══════════════════════════════════════════════════════════
  const confirmed = payments.filter(p=>p.is_confirmed);
  const totalPaid = confirmed.reduce((s,p)=>s+p.value,0);
  const balance   = grand - totalPaid;

  if (y > 215) { doc.addPage(); y = 18; }

  doc.setFont('helvetica','bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('PAGAMENTOS EFETUADOS', M, y);
  y += 4;

  const payRows = confirmed.map(p=>[fmtDate(p.payment_date), p.notes||'—', fmtBRL(p.value)]);

  autoTable(doc,{
    startY: y,
    margin:{left:M,right:M},
    head:[['Data','Descrição','Valor']],
    body: payRows.length>0 ? payRows : [['—','—','—']],
    headStyles:{
      fillColor:SNOW, textColor:SMOKE, fontSize:7, fontStyle:'bold',
      cellPadding:{top:3,bottom:3,left:4,right:4},
    },
    bodyStyles:{
      fontSize:8.5, textColor:INK,
      cellPadding:{top:3.2,bottom:3.2,left:4,right:4},
    },
    alternateRowStyles:{fillColor:WHITE},
    columnStyles:{
      0:{cellWidth:28},
      1:{cellWidth:'auto'},
      2:{cellWidth:38, halign:'right', fontStyle:'bold'},
    },
    theme:'plain',
    tableLineColor:RULE,
    tableLineWidth:0.18,
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Totais — bloco destacado
  const totW = 80;
  const totX = PW - M - totW;

  // Total pago
  doc.setFillColor(...SNOW);
  doc.rect(totX, y, totW, 9, 'F');
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...SMOKE);
  doc.text('Total pago', totX+4, y+6);
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...INK);
  doc.text(fmtBRL(totalPaid), PW-M-4, y+6, {align:'right'});

  y += 9;

  // Saldo / Crédito
  const isCredit = balance <= 0;
  doc.setFillColor(...(isCredit ? [220,252,231] : [254,243,199]) as [number,number,number]);
  doc.rect(totX, y, totW, 10, 'F');
  // pill colorido
  pill(doc, totX+4, y+2.5, isCredit?22:16, 5, isCredit ? [22,163,74] : [217,119,6]);
  doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...WHITE);
  doc.text(isCredit?'QUITADO':'A PAGAR', totX+6, y+6.2);
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.setTextColor(...(isCredit ? [22,101,52] : [120,53,15]) as [number,number,number]);
  doc.text(fmtBRL(Math.abs(balance)), PW-M-4, y+7, {align:'right'});

  y += 18;

  // ══════════════════════════════════════════════════════════
  // DADOS BANCÁRIOS
  // ══════════════════════════════════════════════════════════
  const hasBilling = company?.razao_social||company?.cnpj||company?.banco;
  if (hasBilling) {
    if (y > 248) { doc.addPage(); y=18; }

    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...NAVY);
    doc.text('DADOS PARA FATURAMENTO', M, y);
    y += 4;

    const lines:string[] = [];
    if (company?.razao_social) lines.push(`Razão Social: ${company.razao_social}`);
    if (company?.cnpj)         lines.push(`CNPJ: ${company.cnpj}`);
    const bankParts = [company?.banco&&`Banco: ${company.banco}`, company?.agencia&&`Agência: ${company.agencia}`, company?.conta&&`Conta: ${company.conta}`].filter(Boolean);
    if (bankParts.length) lines.push(bankParts.join('   '));

    doc.setFillColor(...SNOW);
    doc.roundedRect(M, y, PW-M*2, lines.length*5+6, 2, 2, 'F');
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...SMOKE);
    lines.forEach((l,i)=>doc.text(l, M+5, y+5+i*5));
  }

  // ══════════════════════════════════════════════════════════
  // RODAPÉ
  // ══════════════════════════════════════════════════════════
  const pages = doc.getNumberOfPages();
  const footerParts = [company?.endereco, company?.telefone, company?.website].filter(Boolean);

  for (let i=1; i<=pages; i++) {
    doc.setPage(i);
    // faixa navy fina
    doc.setFillColor(...NAVY);
    doc.rect(0, PH-12, PW, 12, 'F');
    // linha gold
    doc.setFillColor(...GOLD);
    doc.rect(0, PH-12, PW, 1, 'F');

    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(200,205,215);
    const footer = footerParts.length>0
      ? footerParts.join('  •  ')
      : (company?.name ?? '');
    doc.text(footer, PW/2, PH-4.5, {align:'center'});

    if (pages>1) {
      doc.setTextColor(200,205,215);
      doc.text(`${i}/${pages}`, PW-M, PH-4.5, {align:'right'});
    }
  }

  const safe = (event.event_name??'Evento').replace(/[^a-zA-Z0-9 ]/g,'').trim();
  doc.save(`Fechamento_${safe}.pdf`);
}
