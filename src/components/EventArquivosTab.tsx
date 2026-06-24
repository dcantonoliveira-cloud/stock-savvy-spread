import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, RefreshCw, ExternalLink, Copy, Plus, Trash2, ChevronDown, ChevronUp, Loader2, Download } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import jsPDF from 'jspdf';

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Tasting {
  id: string;
  scheduled_date: string | null;
  status: string | null;
  confirmed: boolean;
  guest_count: number | null;
  menu_notes: string | null;
}

interface EventData {
  event_name: string | null;
  event_date: string | null;
  event_type: string | null;
  ceremony_time: string | null;
  duration_hours: number | null;
  location_text: string | null;
  guest_count: number | null;
  price_per_person: number | null;
  total_value: number | null;
  product_name: string | null;
  pricing_mode: string | null;
  contract_value: number | null;
  witness_name: string | null;
  witness_cpf: string | null;
  clients: {
    name: string | null;
    cpf: string | null;
    rg: string | null;
    address: string | null;
  } | null;
}

interface Props {
  eventId: string;
  event: EventData;
}

// ── tag replacement ────────────────────────────────────────────────────────────
const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

function replaceTags(template: string, event: EventData, witness2Name: string, witness2Cpf: string): string {
  const today = new Date();
  const isPpx = event.pricing_mode !== 'fixed';

  const map: Record<string, string> = {
    '[NOME DO CLIENTE]':       event.clients?.name ?? '—',
    '[CPF DO CLIENTE]':        event.clients?.cpf ?? '—',
    '[RG DO CLIENTE]':         event.clients?.rg ?? '—',
    '[ENDEREÇO DO CLIENTE]':   event.clients?.address ?? '—',
    '[QTD DE CONVIDADOS]':     String(event.guest_count ?? '—'),
    '[TIPO DO CARDÁPIO]':      event.product_name ?? '—',
    '[TIPO DO EVENTO]':        event.event_type ?? '—',
    '[DATA DO EVENTO]':        fmtDate(event.event_date),
    '[HORA CERIMONIA]':        event.ceremony_time ?? '—',
    '[LOCAL DO EVENTO]':       event.location_text ?? '—',
    '[TEMPO DE FESTA]':        event.duration_hours ? `${event.duration_hours} horas` : '—',
    '[VALOR POR CONVIDADO]':   isPpx ? fmtBRL(event.price_per_person ?? 0) : '—',
    '[VALOR TOTAL DO EVENTO]': fmtBRL(isPpx ? (event.total_value ?? 0) : (event.contract_value ?? 0)),
    '[VALOR DO FRETE]':        '0,00',
    '[DIA DE HOJE]':           String(today.getDate()),
    '[MÊS DE HOJE POR EXTENSO]': MONTHS_PT[today.getMonth()],
    '[ANO DE HOJE]':           String(today.getFullYear()),
    '[NOME DA TESTEMUNHA 1]':  event.witness_name ?? '—',
    '[CPF DA TESTEMUNHA 1]':   event.witness_cpf ?? '—',
    '[NOME DA TESTEMUNHA 2]':  witness2Name || '—',
    '[CPF DA TESTEMUNHA 2]':   witness2Cpf || '—',
  };

  let result = template;
  for (const [tag, value] of Object.entries(map)) {
    result = result.replaceAll(tag, `<strong>${value}</strong>`);
  }
  return result;
}

// ── PDF do contrato ─────────────────────────────────────────────────────────
async function downloadContractPDF(html: string, eventName: string) {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;font-family:serif;font-size:13px;line-height:1.7;color:#111;padding:60px;background:white';
  container.innerHTML = html;
  document.body.appendChild(container);

  // pequena pausa para render
  await new Promise(r => setTimeout(r, 100));

  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(container, { scale: 2, useCORS: true });
  document.body.removeChild(container);

  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pdfW - margin * 2;
  const contentH = (canvas.height * contentW) / canvas.width;

  let posY = margin;
  let remaining = contentH;
  let srcY = 0;

  while (remaining > 0) {
    const pageH = Math.min(pdfH - margin * 2, remaining);
    const srcH = (pageH / contentH) * canvas.height;

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = srcH;
    const ctx = pageCanvas.getContext('2d')!;
    ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    const pageData = pageCanvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(pageData, 'JPEG', margin, margin, contentW, pageH);

    remaining -= pageH;
    srcY += srcH;
    if (remaining > 0) { pdf.addPage(); posY = margin; }
  }

  const safe = (eventName ?? 'Contrato').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  pdf.save(`Contrato_${safe}.pdf`);
}

// ── componente principal ───────────────────────────────────────────────────────
const sectionCls = 'bg-white border border-border rounded-2xl p-6';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5';
const inputCls = 'w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

export default function EventArquivosTab({ eventId, event }: Props) {
  const [tastings, setTastings] = useState<Tasting[]>([]);
  const [contractTemplate, setContractTemplate] = useState('');
  const [contractText, setContractText] = useState('');
  const [contractGenerated, setContractGenerated] = useState(false);
  const [signedUrl, setSignedUrl] = useState('');
  const [annex1, setAnnex1] = useState('');
  const [annex2, setAnnex2] = useState('');
  const [showAnnex1, setShowAnnex1] = useState(false);
  const [showAnnex2, setShowAnnex2] = useState(false);
  const [annexModels, setAnnexModels] = useState<{id:string;name:string;content:string}[]>([]);
  const [witness2Name, setWitness2Name] = useState('');
  const [witness2Cpf, setWitness2Cpf] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const load = async () => {
      const [{ data: tData }, { data: evData }, { data: compData }] = await Promise.all([
        supabase.from('tastings').select('id,scheduled_date,status,confirmed,guest_count,menu_notes').eq('event_id', eventId).order('scheduled_date'),
        supabase.from('events').select('contract_text,contract_signed_url,annex_1_text,annex_2_text,witness_name_2,witness_cpf_2').eq('id', eventId).single(),
        supabase.from('companies').select('id,contract_template,annex_models').limit(1).single(),
      ]);

      setTastings((tData ?? []) as Tasting[]);
      if (evData) {
        const d = evData as any;
        if (d.contract_text) { setContractText(d.contract_text); setContractGenerated(true); }
        setSignedUrl(d.contract_signed_url ?? '');
        setAnnex1(d.annex_1_text ?? '');
        setAnnex2(d.annex_2_text ?? '');
        setWitness2Name(d.witness_name_2 ?? '');
        setWitness2Cpf(d.witness_cpf_2 ?? '');
        if (d.annex_1_text) setShowAnnex1(true);
        if (d.annex_2_text) setShowAnnex2(true);
      }
      if (compData) {
        const c = compData as any;
        setCompanyId(c.id);
        setContractTemplate(c.contract_template ?? '');
        setAnnexModels(c.annex_models ?? []);
      }
    };
    load();
  }, [eventId]);

  const autoSave = (field: string, value: string) => {
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(async () => {
      await supabase.from('events').update({ [field]: value || null }).eq('id', eventId);
    }, 1200);
  };

  const generateContract = () => {
    if (!contractTemplate) {
      toast.error('Nenhum modelo de contrato configurado. Vá em Configurações para adicionar.');
      return;
    }
    const generated = replaceTags(contractTemplate, event, witness2Name, witness2Cpf);
    setContractText(generated);
    setContractGenerated(true);
    supabase.from('events').update({ contract_text: generated }).eq('id', eventId);
    toast.success('Contrato gerado');
  };

  const handleContractChange = (html: string) => {
    setContractText(html);
    autoSave('contract_text', html);
  };

  const handleSignedUrl = (url: string) => {
    setSignedUrl(url);
    autoSave('contract_signed_url', url);
  };

  const handleAnnex1 = (html: string) => { setAnnex1(html); autoSave('annex_1_text', html); };
  const handleAnnex2 = (html: string) => { setAnnex2(html); autoSave('annex_2_text', html); };

  const applyAnnexModel = (target: 1 | 2, modelContent: string) => {
    if (target === 1) handleAnnex1(modelContent);
    else handleAnnex2(modelContent);
    toast.success('Modelo aplicado');
  };

  const handleDownloadPdf = async () => {
    if (!contractText) { toast.error('Gere o contrato primeiro'); return; }
    setGeneratingPdf(true);
    try {
      await downloadContractPDF(contractText, event.event_name ?? 'Contrato');
    } catch (e) {
      toast.error('Erro ao gerar PDF');
    }
    setGeneratingPdf(false);
  };

  const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{title}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* 1. DEGUSTAÇÕES */}
      <div className={sectionCls}>
        <SectionTitle title="Degustações" sub="Degustações realizadas vinculadas a este evento" />
        {tastings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma degustação vinculada</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Data','Status','Confirmados','Convidados','Observações'].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60 pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tastings.map(t => (
                <tr key={t.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{t.scheduled_date ? new Date(t.scheduled_date+'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${t.confirmed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground border-border'}`}>
                      {t.confirmed ? 'Confirmada' : (t.status ?? 'Agendada')}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{t.confirmed ? 'Sim' : '—'}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{t.guest_count ?? '—'}</td>
                  <td className="py-2.5 text-muted-foreground text-xs truncate max-w-[200px]">{t.menu_notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 2. CONTRATO */}
      <div className={sectionCls}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Contrato do evento</span>
              <div className="flex-1 h-px bg-border w-20" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">As tags do modelo são substituídas automaticamente pelos dados do evento</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {contractGenerated && (
              <>
                <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
                  Contrato gerado
                </span>
                <button
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors disabled:opacity-50"
                  title="Baixar PDF"
                >
                  {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                </button>
              </>
            )}
            <button
              onClick={generateContract}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              {contractGenerated ? 'Gerar novo contrato' : 'Gerar contrato'}
            </button>
          </div>
        </div>

        {/* Testemunhas */}
        <div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-muted/30 border border-border/50 rounded-xl">
          <div>
            <label className={labelCls}>Testemunha 1 — Nome</label>
            <input className={inputCls} value={event.witness_name ?? ''} readOnly placeholder="Preencha na aba Dados do Cliente" />
          </div>
          <div>
            <label className={labelCls}>Testemunha 1 — CPF</label>
            <input className={inputCls} value={event.witness_cpf ?? ''} readOnly />
          </div>
          <div>
            <label className={labelCls}>Testemunha 2 — Nome</label>
            <input className={inputCls} value={witness2Name} onChange={e => { setWitness2Name(e.target.value); autoSave('witness_name_2', e.target.value); }} placeholder="Nome da 2ª testemunha" />
          </div>
          <div>
            <label className={labelCls}>Testemunha 2 — CPF</label>
            <input className={inputCls} value={witness2Cpf} onChange={e => { setWitness2Cpf(e.target.value); autoSave('witness_cpf_2', e.target.value); }} placeholder="CPF da 2ª testemunha" />
          </div>
        </div>

        {contractGenerated && contractText ? (
          <RichTextEditor content={contractText} onChange={handleContractChange} placeholder="" />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3 border-2 border-dashed border-border rounded-xl text-muted-foreground">
            <FileText className="w-8 h-8 opacity-30" />
            <p className="text-sm">Clique em <strong>"Gerar contrato"</strong> para preencher automaticamente</p>
            {!contractTemplate && (
              <p className="text-xs text-amber-600">⚠ Nenhum modelo configurado — vá em Administração → Configurações para adicionar o modelo base</p>
            )}
          </div>
        )}
      </div>

      {/* 3. LINK DO CONTRATO ASSINADO */}
      <div className={sectionCls}>
        <SectionTitle title="Link do contrato assinado" sub="Cole aqui o link do contrato após assinatura eletrônica (DocuSign, ClickSign, etc.)" />
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={signedUrl}
            onChange={e => handleSignedUrl(e.target.value)}
            placeholder="https://..."
          />
          {signedUrl && (
            <>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 border border-border rounded-lg text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
              <button onClick={() => { navigator.clipboard.writeText(signedUrl); toast.success('Copiado'); }}
                className="flex items-center justify-center w-9 h-9 border border-border rounded-lg text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4. ANEXOS */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle title="Anexos contratuais" sub="Até 2 anexos por contrato" />
          {!showAnnex1 && (
            <button onClick={() => setShowAnnex1(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">
              <Plus className="w-3.5 h-3.5" />Novo Anexo
            </button>
          )}
          {showAnnex1 && !showAnnex2 && (
            <button onClick={() => setShowAnnex2(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">
              <Plus className="w-3.5 h-3.5" />Novo Anexo
            </button>
          )}
        </div>

        {/* Anexo 1 */}
        {showAnnex1 && (
          <div className="border border-border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-muted-foreground">Anexo 1</span>
              <div className="flex items-center gap-2">
                {annexModels.length > 0 && (
                  <select
                    className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background"
                    defaultValue=""
                    onChange={e => { const m = annexModels.find(x => x.id === e.target.value); if (m) applyAnnexModel(1, m.content); e.target.value=''; }}
                  >
                    <option value="" disabled>Escolher modelo</option>
                    {annexModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                <button onClick={() => { setShowAnnex1(false); handleAnnex1(''); }}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <RichTextEditor content={annex1} onChange={handleAnnex1} placeholder="Digite o conteúdo do anexo..." />
          </div>
        )}

        {/* Anexo 2 */}
        {showAnnex2 && (
          <div className="border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-muted-foreground">Anexo 2</span>
              <div className="flex items-center gap-2">
                {annexModels.length > 0 && (
                  <select
                    className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background"
                    defaultValue=""
                    onChange={e => { const m = annexModels.find(x => x.id === e.target.value); if (m) applyAnnexModel(2, m.content); e.target.value=''; }}
                  >
                    <option value="" disabled>Escolher modelo</option>
                    {annexModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                <button onClick={() => { setShowAnnex2(false); handleAnnex2(''); }}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <RichTextEditor content={annex2} onChange={handleAnnex2} placeholder="Digite o conteúdo do anexo..." />
          </div>
        )}

        {!showAnnex1 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum anexo adicionado</p>
        )}
      </div>
    </div>
  );
}
