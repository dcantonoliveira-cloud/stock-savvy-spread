import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import WhatsAppConfirmModal, { WhatsAppTrigger } from '@/components/WhatsAppConfirmModal';
import { buildMessage } from '@/lib/whatsapp';
import {
  FileText, RefreshCw, ExternalLink, Copy, Plus, Trash2,
  Loader2, Download, Upload, File, X, AlertTriangle,
  ChevronDown, ChevronRight, Send, Check, Clock, XCircle,
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import jsPDF from 'jspdf';
import { getCompany } from '@/lib/companyCache';

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Tasting {
  id: string; session_id: string; scheduled_date: string | null;
  type: string | null; situation_snapshot: string | null; paid_amount: number | null;
}
interface AnnexModel { id: string; name: string; content: string | null }
interface EventFile { id: string; name: string; url: string; created_at: string }
interface EventData {
  event_name: string | null; event_date: string | null; event_type: string | null;
  ceremony_time: string | null; duration_hours: number | null; location_text: string | null;
  guest_count: number | null; price_per_person: number | null; total_value: number | null;
  product_name: string | null; pricing_mode: string | null; contract_value: number | null;
  witness_name: string | null; witness_cpf: string | null; witness_email: string | null;
  witness_2_name: string | null; witness_2_email: string | null;
  clients: { name: string | null; cpf: string | null; rg: string | null; address: string | null; email: string | null } | null;
}
interface ZapSigner { token: string; name: string; email: string; status: string; sign_url: string }
interface ZapData { doc_token: string; open_id: number; signers: ZapSigner[]; sent_at: string }
interface Props { eventId: string; event: EventData; clientPhone?: string | null }

// ── tag replacement ────────────────────────────────────────────────────────────
const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | null) => { if (!d) return '—'; const [y,m,day]=d.split('-'); return `${day}/${m}/${y}`; };

const REQUIRED_FIELDS: { key: string; label: string; getValue: (e: EventData) => string | null | undefined }[] = [
  { key: 'client_name',   label: 'Nome do cliente',        getValue: e => e.clients?.name },
  { key: 'client_cpf',    label: 'CPF do cliente',         getValue: e => e.clients?.cpf },
  { key: 'client_rg',     label: 'RG do cliente',          getValue: e => e.clients?.rg },
  { key: 'client_addr',   label: 'Endereço do cliente',    getValue: e => e.clients?.address },
  { key: 'event_date',    label: 'Data do evento',         getValue: e => e.event_date },
  { key: 'event_type',    label: 'Tipo do evento',         getValue: e => e.event_type },
  { key: 'location',      label: 'Local do evento',        getValue: e => e.location_text },
  { key: 'guest_count',   label: 'Qtd. de convidados',     getValue: e => e.guest_count != null ? String(e.guest_count) : null },
  { key: 'duration',      label: 'Tempo de festa (horas)', getValue: e => e.duration_hours != null ? String(e.duration_hours) : null },
];

function replaceTags(template: string, event: EventData, w1Name: string, w1Cpf: string): string {
  const today = new Date();
  const isPpx = event.pricing_mode !== 'fixed';
  const map: Record<string, string> = {
    '[NOME DO CLIENTE]':          event.clients?.name ?? '—',
    '[CPF DO CLIENTE]':           event.clients?.cpf ?? '—',
    '[RG DO CLIENTE]':            event.clients?.rg ?? '—',
    '[ENDEREÇO DO CLIENTE]':      event.clients?.address ?? '—',
    '[QTD DE CONVIDADOS]':        String(event.guest_count ?? '—'),
    '[TIPO DO CARDÁPIO]':         event.product_name ?? '—',
    '[TIPO DO EVENTO]':           event.event_type ?? '—',
    '[DATA DO EVENTO]':           fmtDate(event.event_date),
    '[HORA CERIMONIA]':           event.ceremony_time ?? '—',
    '[LOCAL DO EVENTO]':          event.location_text ?? '—',
    '[TEMPO DE FESTA]':           event.duration_hours ? `${event.duration_hours} horas` : '—',
    '[VALOR POR CONVIDADO]':      isPpx ? fmtBRL(event.price_per_person ?? 0) : '—',
    '[VALOR TOTAL DO EVENTO]':    fmtBRL(isPpx ? (event.total_value ?? 0) : (event.contract_value ?? 0)),
    '[VALOR DO FRETE]':           '0,00',
    '[DIA DE HOJE]':              String(today.getDate()),
    '[MÊS DE HOJE POR EXTENSO]': MONTHS_PT[today.getMonth()],
    '[ANO DE HOJE]':              String(today.getFullYear()),
    '[NOME DA TESTEMUNHA 1]':     w1Name || '—',
    '[CPF DA TESTEMUNHA 1]':      w1Cpf || '—',
    '[NOME DA TESTEMUNHA 2]':     event.witness_name ?? '—',
    '[CPF DA TESTEMUNHA 2]':      event.witness_cpf ?? '—',
  };
  let result = template;
  for (const [tag, value] of Object.entries(map)) result = result.replaceAll(tag, `<strong>${value}</strong>`);
  return result;
}

// ── PDF helpers ────────────────────────────────────────────────────────────────
function isRowBlank(data: Uint8ClampedArray, width: number, y: number): boolean {
  for (let x = 0; x < width; x++) { const i=(y*width+x)*4; if(data[i]<245||data[i+1]<245||data[i+2]<245) return false; }
  return true;
}
function findSafeCut(data: Uint8ClampedArray, width: number, idealY: number, searchPx = 120): number {
  for (let dy=0; dy<=searchPx; dy++) { const y=idealY-dy; if(y>=0 && isRowBlank(data,width,y)) return y; }
  return idealY;
}
async function renderSection(innerHtml: string, widthPx: number, scale: number) {
  const { default: html2canvas } = await import('html2canvas');
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:-9999px;top:0;width:${widthPx}px;background:white;padding:0;margin:0;`;
  el.innerHTML = `<style>
    /* Defaults — inline styles do editor têm prioridade */
    * { box-sizing:border-box; font-family:'Times New Roman',Times,serif !important; }
    body, div { font-size:11.5pt; color:#111; }
    p { margin:0 0 0.45em 0; line-height:1.55; word-break:break-word; }
    p:empty { margin:0; min-height:0.7em; }
    p br:only-child { display:block; height:0.7em; }
    h1,h2,h3 { margin:0.5em 0 0.2em 0; }
    ul,ol { margin:0.3em 0 0.3em 1.5em; padding:0; }
    li { margin-bottom:0.1em; }
    strong { font-weight:bold; }
    em { font-style:italic; }
    /* Alinhamentos do TipTap */
    [style*="text-align:center"], [style*="text-align: center"] { text-align:center !important; }
    [style*="text-align:right"], [style*="text-align: right"] { text-align:right !important; }
    [style*="text-align:justify"], [style*="text-align: justify"] { text-align:justify !important; }
  </style>
  <div>${DOMPurify.sanitize(innerHtml)}</div>`;
  document.body.appendChild(el);
  await new Promise(r => setTimeout(r, 200));
  const canvas = await html2canvas(el, { scale, useCORS: true, backgroundColor: '#fff' });
  document.body.removeChild(el);
  return canvas;
}

async function buildPDF(html: string, eventName: string, logoBase64: string | null, companyName?: string, annexes: string[] = [], eventDate?: string | null, eventLocation?: string | null): Promise<jsPDF> {
  const SCALE=2, PW_MM=210, PH_MM=297, MX_MM=12, HEADER_MM=38, FOOTER_MM=20;
  const CONTENT_W_MM=PW_MM-MX_MM*2, CONTENT_H_MM=PH_MM-HEADER_MM-FOOTER_MM;
  const PX_PER_MM=3.7795, CONTAINER_W_PX=Math.round(CONTENT_W_MM*PX_PER_MM);
  const pageHeightPx=Math.round(CONTENT_H_MM*PX_PER_MM*SCALE);
  const sections=[html, ...annexes.filter(Boolean).map((a,i)=>`<h2 style="text-align:center;font-size:13pt;margin-bottom:20px;">ANEXO ${i+1}</h2>${a}`)];
  const canvases=await Promise.all(sections.map(s=>renderSection(s,CONTAINER_W_PX,SCALE)));
  const pdf=new jsPDF({unit:'mm',format:'a4'});
  const sectionPages=canvases.map(canvas=>{
    const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
    const pages: {srcY:number;srcH:number}[]=[]; let srcY=0;
    while(srcY<canvas.height){const ideal=srcY+pageHeightPx;const cut=ideal>=canvas.height?canvas.height:findSafeCut(data,canvas.width,ideal,100*SCALE);pages.push({srcY,srcH:cut-srcY});srcY=cut;}
    return pages;
  });
  const totalPages=sectionPages.reduce((s,p)=>s+p.length,0);
  const fmtD=(d:string|null|undefined)=>{if(!d)return'';const[y,m,day]=d.split('-');return`${day}/${m}/${y}`;};
  const addHeaderFooter=(pageNum:number)=>{
    if(logoBase64){try{pdf.addImage(logoBase64,'PNG',MX_MM,6,0,18);}catch{}}
    pdf.setDrawColor(160,140,100);pdf.setLineWidth(0.35);pdf.line(MX_MM,HEADER_MM-4,PW_MM-MX_MM,HEADER_MM-4);
    pdf.setFont('helvetica','normal');pdf.setFontSize(6.5);pdf.setTextColor(150,130,90);
    pdf.text('CONTRATO',PW_MM-MX_MM,9,{align:'right'});
    pdf.setFont('helvetica','bold');pdf.setFontSize(8);pdf.setTextColor(80,70,55);
    pdf.text(eventName,PW_MM-MX_MM,14,{align:'right'});
    pdf.setFont('helvetica','normal');pdf.setFontSize(7.5);pdf.setTextColor(120,110,90);
    const sub=[fmtD(eventDate),eventLocation].filter(Boolean).join('  ·  ');
    if(sub) pdf.text(sub,PW_MM-MX_MM,19,{align:'right'});
    pdf.line(MX_MM,PH_MM-FOOTER_MM+2,PW_MM-MX_MM,PH_MM-FOOTER_MM+2);
    pdf.setFontSize(7.5);pdf.setTextColor(140,130,110);
    pdf.text((companyName??'').trim(),MX_MM,PH_MM-FOOTER_MM+7);
    pdf.text(`Página ${pageNum} de ${totalPages}`,PW_MM-MX_MM,PH_MM-FOOTER_MM+7,{align:'right'});
    pdf.setTextColor(17,17,17);
  };
  let globalPage=0;
  canvases.forEach((canvas,si)=>{
    sectionPages[si].forEach(({srcY,srcH},pi)=>{
      // Não adiciona página extra aqui quando é o início de uma nova seção —
      // a página já foi criada pelo bloco de transição entre seções abaixo.
      if(globalPage>0 && !(pi===0 && si>0))pdf.addPage();
      const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=srcH;
      slice.getContext('2d')!.drawImage(canvas,0,srcY,canvas.width,srcH,0,0,canvas.width,srcH);
      const imgH=srcH/(PX_PER_MM*SCALE);
      pdf.addImage(slice.toDataURL('image/jpeg',0.95),'JPEG',MX_MM,HEADER_MM,CONTENT_W_MM,imgH);
      addHeaderFooter(globalPage+1);globalPage++;
      if(pi===sectionPages[si].length-1&&si<canvases.length-1){pdf.addPage();addHeaderFooter(globalPage+1);globalPage++;}
    });
  });
  return pdf;
}

async function downloadContractPDF(html: string, eventName: string, logoBase64: string | null, companyName?: string, annexes: string[] = [], eventDate?: string | null, eventLocation?: string | null) {
  const pdf = await buildPDF(html, eventName, logoBase64, companyName, annexes, eventDate, eventLocation);
  const co=(companyName??'').trim().toUpperCase(), ev=(eventName??'Evento').trim();
  pdf.save(`CONTRATO ${co} - ${ev}.pdf`);
}

async function contractPDFBase64(html: string, eventName: string, logoBase64: string | null, companyName?: string, annexes: string[] = [], eventDate?: string | null, eventLocation?: string | null): Promise<string> {
  const pdf = await buildPDF(html, eventName, logoBase64, companyName, annexes, eventDate, eventLocation);
  return pdf.output('datauristring').split(',')[1];
}

// ── estilos ────────────────────────────────────────────────────────────────────
const inputCls='w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls='block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5';

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── ZapSign status badge ───────────────────────────────────────────────────────
function SignerStatusBadge({ status }: { status: string }) {
  if (status === 'signed') return <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600"><Check className="w-3 h-3" />Assinou</span>;
  if (status === 'refused') return <span className="flex items-center gap-1 text-[11px] font-medium text-red-500"><XCircle className="w-3 h-3" />Recusou</span>;
  return <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600"><Clock className="w-3 h-3" />Pendente</span>;
}

// ── componente ─────────────────────────────────────────────────────────────────
export default function EventArquivosTab({ eventId, event, clientPhone }: Props) {
  const navigate = useNavigate();
  const [tastings, setTastings]               = useState<Tasting[]>([]);
  const [contractTemplate, setContractTemplate] = useState('');
  const [contractText, setContractText]       = useState('');
  const [contractGenerated, setContractGenerated] = useState(false);
  const [contractOpen, setContractOpen]       = useState(true);
  const [editorOpen, setEditorOpen]           = useState(false);
  const [signedUrl, setSignedUrl]             = useState('');
  const [annex1, setAnnex1]                   = useState('');
  const [annex2, setAnnex2]                   = useState('');
  const [showAnnex1, setShowAnnex1]           = useState(false);
  const [showAnnex2, setShowAnnex2]           = useState(false);
  const [annexModels, setAnnexModels]         = useState<AnnexModel[]>([]);
  const [witness1Name, setWitness1Name]       = useState('');
  const [witness1Cpf, setWitness1Cpf]         = useState('');
  const [witness1Email, setWitness1Email]     = useState('');
  const [signerName, setSignerName]           = useState('');
  const [signerEmail, setSignerEmail]         = useState('');
  const [files, setFiles]                     = useState<EventFile[]>([]);
  const [uploading, setUploading]             = useState(false);
  const [generatingPdf, setGeneratingPdf]     = useState(false);
  const [companyLogo, setCompanyLogo]         = useState<string | null>(null);
  const [companyName, setCompanyName]         = useState<string>('');
  const [companyId, setCompanyId]             = useState<string | null>(null);
  const [waTrigger, setWaTrigger]             = useState<WhatsAppTrigger | null>(null);
  // ZapSign
  const [zapToken, setZapToken]               = useState<string | null>(null);
  const [zapData, setZapData]                 = useState<ZapData | null>(null);
  const [zapSigners, setZapSigners]           = useState<{ name: string; email: string; role?: string }[]>([]);
  const [showZapForm, setShowZapForm]         = useState(false);
  const [sendingZap, setSendingZap]           = useState(false);
  const [refreshingZap, setRefreshingZap]     = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const load = async () => {
      const [{ data: tData }, { data: evData }, compData, { data: fData }, { data: zapCfg }] = await Promise.all([
        supabase.from('tasting_session_events' as any)
          .select('id, session_id, situation_snapshot, paid_amount, tasting_sessions(id, scheduled_date, type)')
          .eq('event_id', eventId),
        supabase.from('events').select('contract_text,contract_signed_url,annex_1_text,annex_2_text,zapsign_data').eq('id', eventId).single(),
        getCompany(),
        supabase.from('event_files' as any).select('id,name,url,created_at').eq('event_id', eventId).order('created_at'),
        supabase.from('company_integrations' as any).select('api_key').eq('provider','zapsign').maybeSingle(),
      ]);
      setTastings(((tData ?? []) as any[]).map(r => ({
        id: r.id, session_id: r.session_id,
        scheduled_date: (r.tasting_sessions as any)?.scheduled_date ?? null,
        type: (r.tasting_sessions as any)?.type ?? null,
        situation_snapshot: r.situation_snapshot, paid_amount: r.paid_amount,
      })));
      if (evData) {
        const d = evData as any;
        if (d.contract_text) { setContractText(d.contract_text); setContractGenerated(true); }
        setSignedUrl(d.contract_signed_url ?? '');
        if (d.annex_1_text) { setAnnex1(d.annex_1_text); setShowAnnex1(true); }
        if (d.annex_2_text) { setAnnex2(d.annex_2_text); setShowAnnex2(true); }
        if (d.zapsign_data) setZapData(d.zapsign_data as ZapData);
      }
      if (compData) {
        const c = compData;
        setWitness1Name(c.witness_1_name ?? ''); setWitness1Cpf(c.witness_1_cpf ?? '');
        setWitness1Email(c.witness_1_email ?? '');
        setSignerName(c.signer_name ?? ''); setSignerEmail(c.signer_email ?? '');
        if (c.logo_base64) setCompanyLogo(c.logo_base64);
        if (c.name) setCompanyName(c.name);
        if (c.id) {
          setCompanyId(c.id);
          const { data: axData } = await supabase.from('annex_models' as any)
            .select('id,name,content').eq('company_id', c.id).order('name');
          setAnnexModels((axData ?? []) as AnnexModel[]);
        }
      }
      if (zapCfg) {
        try {
          const raw = (zapCfg as any).api_key ?? '';
          let tok: string | null = null;
          try { tok = JSON.parse(raw)?.token ?? null; } catch { tok = null; }
          if (!tok) tok = raw || null; // fallback: raw string
          setZapToken(tok);
        } catch {}
      }
      const { data: tplData } = await supabase.from('contract_templates' as any).select('content').eq('is_default', true).limit(1).single();
      if (tplData) setContractTemplate((tplData as any).content ?? '');
      else {
        const { data: anyTpl } = await supabase.from('contract_templates' as any).select('content').limit(1).single();
        if (anyTpl) setContractTemplate((anyTpl as any).content ?? '');
      }
      setFiles((fData ?? []) as EventFile[]);
    };
    load();
  }, [eventId]);

  // Pre-populate ZapSign signers when form opens
  useEffect(() => {
    if (!showZapForm) return;
    const signers: { name: string; email: string; role?: string }[] = [];
    // 1. Contratante (cliente)
    if (event.clients?.name)
      signers.push({ name: event.clients.name, email: event.clients.email ?? '', role: 'Contratante' });
    // 2. Assinante da empresa — de Configurações → Empresa
    if (signerName)
      signers.push({ name: signerName, email: signerEmail, role: 'Assinante da empresa' });
    // 3. Testemunha da empresa — de Configurações → Empresa
    if (witness1Name)
      signers.push({ name: witness1Name, email: witness1Email, role: 'Testemunha da empresa' });
    // 4. Testemunha 1 do evento (dados do cliente)
    if (event.witness_name)
      signers.push({ name: event.witness_name, email: event.witness_email ?? '', role: 'Testemunha 1' });
    // 5. Testemunha 2 do evento (dados do cliente)
    if (event.witness_2_name)
      signers.push({ name: event.witness_2_name, email: event.witness_2_email ?? '', role: 'Testemunha 2' });
    setZapSigners(signers.length > 0 ? signers : [{ name: '', email: '' }]);
  }, [showZapForm]);

  const autoSave = (field: string, value: string) => {
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(async () => {
      await supabase.from('events').update({ [field]: value || null }).eq('id', eventId);
    }, 1200);
  };

  const generateContract = () => {
    if (!contractTemplate) { toast.error('Nenhum modelo configurado. Vá em Cadastros → Contratos.'); return; }
    const missing = REQUIRED_FIELDS.filter(f => !f.getValue(event));
    if (missing.length > 0) {
      toast.error(<div><p className="font-semibold mb-1">Campos obrigatórios faltando:</p><ul className="list-disc list-inside text-sm space-y-0.5">{missing.map(f=><li key={f.key}>{f.label}</li>)}</ul></div>, { duration: 6000 });
      return;
    }
    const generated = replaceTags(contractTemplate, event, witness1Name, witness1Cpf);
    setContractText(generated); setContractGenerated(true);
    setAnnex1(''); setAnnex2(''); setShowAnnex1(false); setShowAnnex2(false);
    supabase.from('events').update({ contract_text: generated, annex_1_text: null, annex_2_text: null }).eq('id', eventId);
    toast.success('Contrato gerado com sucesso');
  };

  const handleAnnex = (n: 1 | 2, html: string) => {
    if (n === 1) { setAnnex1(html); autoSave('annex_1_text', html); }
    else { setAnnex2(html); autoSave('annex_2_text', html); }
  };

  const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
  const MAX_SIZE_MB = 15;

  const handleFileUpload = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext)) {
      toast.error(`Tipo de arquivo não permitido (.${ext}). Use PDF, imagem ou documento.`);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande (máx. ${MAX_SIZE_MB}MB).`);
      return;
    }
    setUploading(true);
    const path = `event-docs/${eventId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('event-files').upload(path, file, { upsert: true });
    if (upErr) { toast.error(`Erro no upload: ${upErr.message}`); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('event-files').getPublicUrl(path);
    const { data: newFile, error: dbErr } = await supabase.from('event_files' as any)
      .insert({ event_id: eventId, name: file.name, url: publicUrl }).select('id,name,url,created_at').single();
    if (dbErr) { toast.error('Erro ao salvar'); setUploading(false); return; }
    setFiles(prev => [...prev, newFile as EventFile]);
    toast.success('Arquivo enviado');
    setUploading(false);
    if (clientPhone) {
      const clientName = (event.clients as any)?.name ?? 'Cliente';
      buildMessage('file', { clientName, eventName: event.event_name ?? '', fileName: file.name })
        .then(text => setWaTrigger({ phone: clientPhone, clientName, message: text }));
    }
  };

  const deleteFile = async (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    await supabase.from('event_files' as any).delete().eq('id', id);
    toast.success('Removido');
  };

  const saveAnnexAsModel = async (content: string) => {
    const name = window.prompt('Nome para salvar como modelo de anexo:');
    if (!name?.trim()) return;
    if (!companyId) { toast.error('Empresa não encontrada'); return; }
    const { data, error } = await supabase.from('annex_models' as any)
      .insert({ name: name.trim(), company_id: companyId, content }).select('id,name,content').single();
    if (error) { toast.error('Erro ao salvar modelo'); return; }
    setAnnexModels(prev => [...prev, data as AnnexModel]);
    toast.success(`Modelo "${name.trim()}" salvo`);
  };

  // ── ZapSign ──────────────────────────────────────────────────────────────────
  const sendToZapSign = async () => {
    if (!zapToken) { toast.error('Configure o token do ZapSign em Configurações → Conectores'); return; }
    const validSigners = zapSigners.filter(s => s.name && s.email);
    if (validSigners.length === 0) { toast.error('Adicione ao menos um signatário com nome e email'); return; }

    setSendingZap(true);
    try {
      const base64 = await contractPDFBase64(contractText, event.event_name ?? 'Contrato', companyLogo, companyName, [annex1, annex2].filter(Boolean), event.event_date, event.location_text);
      const proxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapsign-proxy`;
      const res = await fetch(`${proxyBase}?path=/api/v1/docs/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-zapsign-token': zapToken,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          name: `Contrato - ${event.event_name ?? 'Evento'}`,
          base64_pdf: base64,
          sandbox: false,
          signers: validSigners.map(s => ({ name: s.name, email: s.email, send_automatic_email: true })),
        }),
      });
      if (!res.ok) { const e = await res.text(); throw new Error(e); }
      const data = await res.json();
      const zap: ZapData = {
        doc_token: data.token,
        open_id: data.open_id,
        sent_at: new Date().toISOString(),
        signers: (data.signers ?? []).map((s: any) => ({
          token: s.token, name: s.name, email: s.email,
          status: s.status ?? 'pending', sign_url: s.sign_url,
        })),
      };
      setZapData(zap);
      setShowZapForm(false);
      await supabase.from('events').update({ zapsign_data: zap as any }).eq('id', eventId);
      toast.success('Contrato enviado para assinatura!');
    } catch (e: any) {
      toast.error('Erro ao enviar para ZapSign: ' + (e?.message ?? ''));
    } finally {
      setSendingZap(false);
    }
  };

  const fetchZapStatus = async (silent = false) => {
    if (!zapToken || !zapData) return;
    if (!silent) setRefreshingZap(true);
    try {
      const proxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapsign-proxy`;
      const res = await fetch(`${proxyBase}?path=/api/v1/docs/${zapData.doc_token}/`, {
        headers: {
          'x-zapsign-token': zapToken,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (!res.ok) throw new Error('Erro ao buscar status');
      const data = await res.json();
      const updated: ZapData = {
        ...zapData,
        signers: (data.signers ?? []).map((s: any) => ({
          token: s.token, name: s.name, email: s.email,
          status: s.status ?? 'pending', sign_url: s.sign_url,
        })),
      };
      setZapData(updated);
      await supabase.from('events').update({ zapsign_data: updated as any }).eq('id', eventId);
      if (!silent) toast.success('Status atualizado');
    } catch {
      if (!silent) toast.error('Erro ao atualizar status');
    } finally {
      if (!silent) setRefreshingZap(false);
    }
  };
  const refreshZapStatus = () => fetchZapStatus(false);

  // Auto-refresh signature status every 30s while there are pending signers
  useEffect(() => {
    if (!zapData || zapData.signers.every(s => s.status === 'signed')) return;
    const interval = setInterval(() => fetchZapStatus(true), 30000);
    return () => clearInterval(interval);
  }, [zapData?.doc_token, zapData?.signers.map(s=>s.status).join(',')]);

  const copySignerLink = (signer: ZapSigner) => {
    const firstName = signer.name.split(' ')[0];
    navigator.clipboard.writeText(`${firstName} - ${signer.sign_url}`);
    toast.success(`Link de ${firstName} copiado!`);
  };

  const AnnexBlock = ({ n, content, show, onRemove }: { n: 1 | 2; content: string; show: boolean; onRemove: () => void }) => {
    const [collapsed, setCollapsed] = useState(true);
    if (!show) return null;
    return (
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setCollapsed(v => !v)}
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            Anexo {n}
          </button>
          <div className="flex items-center gap-2">
            {!collapsed && annexModels.length > 0 && (
              <select className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background" defaultValue=""
                onChange={e => { const m=annexModels.find(x=>x.id===e.target.value); if(m) handleAnnex(n,m.content??''); e.currentTarget.value=''; }}>
                <option value="" disabled>Usar modelo...</option>
                {annexModels.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            {!collapsed && content && (
              <button onClick={() => saveAnnexAsModel(content)}
                className="text-xs border border-border rounded-lg px-2 py-1.5 hover:bg-muted transition-colors text-muted-foreground whitespace-nowrap">
                Salvar como modelo
              </button>
            )}
            <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {!collapsed && <RichTextEditor content={content} onChange={html => handleAnnex(n, html)} placeholder="Conteúdo do anexo..." />}
      </div>
    );
  };

  return (
    <div className="space-y-5">

      {/* 1. DEGUSTAÇÕES */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <SectionDivider title="Degustações" />
        {tastings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma degustação vinculada a este evento</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Data','Tipo','Situação','Valor pago',''].map(h=>(
                  <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60 pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tastings.map(t=>(
                <tr key={t.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{t.scheduled_date?new Date(t.scheduled_date+'T12:00:00').toLocaleDateString('pt-BR'):'—'}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{t.type??'—'}</td>
                  <td className="py-2.5 pr-4">
                    {t.situation_snapshot==='confirmed'
                      ?<span className="text-[11px] px-2 py-0.5 rounded-full font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">Evento fechado</span>
                      :<span className="text-xs text-muted-foreground">Cliente novo</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{t.paid_amount?`R$ ${t.paid_amount.toLocaleString('pt-BR',{minimumFractionDigits:0})}`:'—'}</td>
                  <td className="py-2.5">
                    <button onClick={()=>navigate(`/tastings/${t.session_id}`,{state:{from:`/events/${eventId}`,fromLabel:event.event_name??'Evento'}})}
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" />Ver sessão
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 2. CONTRATO */}
      <div className="bg-white border border-border rounded-2xl p-6">
        {/* Header com toggle */}
        <div className="flex items-center justify-between">
          <button onClick={()=>setContractOpen(o=>!o)}
            className="flex items-center gap-2 text-left group flex-1">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">Contrato do evento</span>
            <div className="flex-1 h-px bg-border" />
            {contractOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground/40 shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
          </button>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {contractGenerated && (
              <>
                <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">Contrato gerado</span>
                <button onClick={async()=>{setGeneratingPdf(true);try{await downloadContractPDF(contractText,event.event_name??'Contrato',companyLogo,companyName,[annex1,annex2].filter(Boolean),event.event_date,event.location_text);}catch(e){toast.error('Erro ao gerar PDF');}finally{setGeneratingPdf(false);}}}
                  disabled={generatingPdf}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors disabled:opacity-50"
                  title="Baixar PDF">
                  {generatingPdf?<Loader2 className="w-4 h-4 animate-spin"/>:<FileText className="w-4 h-4"/>}
                </button>
                <button
                  onClick={() => {
                    if (!zapToken) { toast.error('Configure o ZapSign em Configurações → Conectores para usar esta função'); return; }
                    setShowZapForm(o => !o);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors ${
                    zapToken
                      ? 'border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10'
                      : 'border border-border text-muted-foreground/50 bg-muted/30 cursor-not-allowed'
                  }`}
                  title={zapToken ? 'Enviar para assinatura eletrônica via ZapSign' : 'Configure o ZapSign em Configurações → Conectores'}>
                  <Send className="w-3 h-3" />Enviar para assinaturas
                </button>
              </>
            )}
            <button onClick={generateContract}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
              <RefreshCw className="w-3 h-3" />
              {contractGenerated?'Gerar novo':'Gerar contrato'}
            </button>
          </div>
        </div>

        {contractOpen && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-4">As tags são substituídas pelos dados do evento e do cliente automaticamente</p>

            {/* Formulário de signatários ZapSign */}
            {showZapForm && (
              <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Signatários</p>
                  <button onClick={()=>setShowZapForm(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {zapSigners.map((s,i)=>(
                  <div key={i} className="flex gap-2 items-end">
                    <div className="w-36 shrink-0">
                      <label className={labelCls}>Papel</label>
                      <input className={inputCls} value={s.role ?? ''} onChange={e=>setZapSigners(prev=>prev.map((x,j)=>j===i?{...x,role:e.target.value}:x))} placeholder="Ex: Contratante" />
                    </div>
                    <div className="flex-1">
                      <label className={labelCls}>Nome</label>
                      <input className={inputCls} value={s.name} onChange={e=>setZapSigners(prev=>prev.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="Nome completo" />
                    </div>
                    <div className="flex-1">
                      <label className={labelCls}>E-mail</label>
                      <input className={inputCls} type="email" value={s.email} onChange={e=>setZapSigners(prev=>prev.map((x,j)=>j===i?{...x,email:e.target.value}:x))} placeholder="email@exemplo.com" />
                    </div>
                    <button onClick={()=>setZapSigners(prev=>prev.filter((_,j)=>j!==i))} className="p-2 text-muted-foreground hover:text-destructive transition-colors mb-0.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <button onClick={()=>setZapSigners(prev=>[...prev,{name:'',email:''}])}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="w-3.5 h-3.5" />Adicionar signatário
                  </button>
                  <button onClick={sendToZapSign} disabled={sendingZap}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60">
                    {sendingZap?<><Loader2 className="w-3.5 h-3.5 animate-spin"/>Enviando...</>:<><Send className="w-3.5 h-3.5"/>Confirmar e enviar</>}
                  </button>
                </div>
              </div>
            )}

            {/* Status de assinaturas ZapSign */}
            {zapData && (
              <div className="mb-4 p-4 bg-muted/30 border border-border rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Assinaturas</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      Enviado {new Date(zapData.sent_at).toLocaleDateString('pt-BR')}
                    </span>
                    <button onClick={refreshZapStatus} disabled={refreshingZap} title="Atualizar status"
                      className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingZap?'animate-spin':''}`} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {zapData.signers.map(s=>(
                    <div key={s.token} className="flex items-center justify-between py-2 px-3 bg-white border border-border rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">{s.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <SignerStatusBadge status={s.status} />
                        {s.sign_url && (
                          <button onClick={()=>copySignerLink(s)} title="Copiar link de assinatura"
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors border border-border rounded-lg px-2 py-1 hover:border-primary/30">
                            <Copy className="w-3 h-3" />
                            {s.name.split(' ')[0]} - link
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {zapData.signers.every(s=>s.status==='signed') && (
                    <p className="text-xs font-semibold text-emerald-600 text-center pt-1 flex items-center justify-center gap-1">
                      <Check className="w-3.5 h-3.5" />Todos assinaram!
                    </p>
                  )}
                </div>
              </div>
            )}

            {contractGenerated && contractText ? (
              <>
                <button onClick={()=>setEditorOpen(o=>!o)}
                  className="flex items-center gap-2 w-full text-left group mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                    {editorOpen ? 'Ocultar texto do contrato' : 'Mostrar texto do contrato'}
                  </span>
                  {editorOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
                </button>
                {editorOpen && (
                  <RichTextEditor content={contractText}
                    onChange={html=>{setContractText(html);autoSave('contract_text',html);}}
                    placeholder="" />
                )}
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Anexos contratuais</span>
                    <div className="flex gap-2">
                      {!showAnnex1&&<button onClick={()=>setShowAnnex1(true)} className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-lg hover:bg-muted transition-colors"><Plus className="w-3 h-3"/>Adicionar anexo</button>}
                      {showAnnex1&&!showAnnex2&&<button onClick={()=>setShowAnnex2(true)} className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-lg hover:bg-muted transition-colors"><Plus className="w-3 h-3"/>2º anexo</button>}
                    </div>
                  </div>
                  <AnnexBlock n={1} content={annex1} show={showAnnex1} onRemove={()=>{setShowAnnex1(false);handleAnnex(1,'');}} />
                  <AnnexBlock n={2} content={annex2} show={showAnnex2} onRemove={()=>{setShowAnnex2(false);handleAnnex(2,'');}} />
                  {!showAnnex1&&<p className="text-xs text-muted-foreground mt-1">Nenhum anexo adicionado</p>}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 border-2 border-dashed border-border rounded-xl text-muted-foreground">
                <FileText className="w-8 h-8 opacity-30" />
                <p className="text-sm">Clique em <strong>"Gerar contrato"</strong> para preencher automaticamente</p>
                {!contractTemplate && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />Nenhum modelo configurado — vá em Cadastros → Contratos e marque um como padrão (⭐)
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. ARQUIVOS DO EVENTO */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <SectionDivider title="Arquivos do evento" />
          <button onClick={()=>fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors shrink-0 -mt-4 ml-4">
            {uploading?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Upload className="w-3.5 h-3.5"/>}
            {uploading?'Enviando...':'Adicionar arquivo'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Contratos assinados, propostas, fotos, cronogramas ou qualquer documento do evento</p>
        <input ref={fileInputRef} type="file" className="hidden" multiple
          onChange={e=>{Array.from(e.target.files??[]).forEach(handleFileUpload);e.target.value='';}} />
        {files.length===0?(
          <div onClick={()=>fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 py-10 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/30 hover:bg-muted/20 transition-colors text-muted-foreground">
            <Upload className="w-6 h-6 opacity-40" />
            <p className="text-sm">Clique ou arraste arquivos aqui</p>
            <p className="text-xs opacity-60">PDF, Word, imagens, planilhas...</p>
          </div>
        ):(
          <div className="space-y-2">
            {files.map(f=>(
              <div key={f.id} className="group flex items-center gap-3 px-3 py-2.5 border border-border rounded-xl hover:border-border/80 transition-colors">
                <File className="w-4 h-4 text-primary shrink-0" />
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-sm font-medium text-primary hover:underline truncate">{f.name}</a>
                <span className="text-[11px] text-muted-foreground shrink-0">{new Date(f.created_at).toLocaleDateString('pt-BR')}</span>
                <button onClick={()=>deleteFile(f.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {waTrigger&&<WhatsAppConfirmModal trigger={waTrigger} onClose={()=>setWaTrigger(null)}/>}
    </div>
  );
}
