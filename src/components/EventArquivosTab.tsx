import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  FileText, RefreshCw, ExternalLink, Copy, Plus, Trash2,
  Loader2, Download, Upload, File, X, AlertTriangle,
} from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import jsPDF from 'jspdf';

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Tasting {
  id: string;
  session_id: string;
  scheduled_date: string | null;
  type: string | null;
  situation_snapshot: string | null;
  paid_amount: number | null;
}
interface AnnexModel { id: string; name: string; content: string | null }
interface EventFile { id: string; name: string; url: string; created_at: string }

interface EventData {
  event_name: string | null; event_date: string | null; event_type: string | null;
  ceremony_time: string | null; duration_hours: number | null; location_text: string | null;
  guest_count: number | null; price_per_person: number | null; total_value: number | null;
  product_name: string | null; pricing_mode: string | null; contract_value: number | null;
  witness_name: string | null; witness_cpf: string | null;
  clients: { name: string | null; cpf: string | null; rg: string | null; address: string | null } | null;
}

interface Props { eventId: string; event: EventData }

// ── tag replacement ────────────────────────────────────────────────────────────
const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

// Campos obrigatórios para gerar o contrato
const REQUIRED_FIELDS: { key: string; label: string; getValue: (e: EventData) => string | null | undefined }[] = [
  { key: 'client_name',   label: 'Nome do cliente',     getValue: e => e.clients?.name },
  { key: 'client_cpf',    label: 'CPF do cliente',      getValue: e => e.clients?.cpf },
  { key: 'client_rg',     label: 'RG do cliente',       getValue: e => e.clients?.rg },
  { key: 'client_addr',   label: 'Endereço do cliente', getValue: e => e.clients?.address },
  { key: 'event_date',    label: 'Data do evento',      getValue: e => e.event_date },
  { key: 'event_type',    label: 'Tipo do evento',      getValue: e => e.event_type },
  { key: 'location',      label: 'Local do evento',     getValue: e => e.location_text },
  { key: 'guest_count',   label: 'Qtd. de convidados',  getValue: e => e.guest_count != null ? String(e.guest_count) : null },
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
  for (const [tag, value] of Object.entries(map)) {
    result = result.replaceAll(tag, `<strong>${value}</strong>`);
  }
  return result;
}

// ── PDF ────────────────────────────────────────────────────────────────────────
async function downloadContractPDF(html: string, eventName: string, logoBase64: string | null) {
  const MX = 12; // margem horizontal mm
  const MY_TOP = 38; // espaço para cabeçalho
  const MY_BOT = 18; // espaço para rodapé
  const PW = 210;
  const contentW = PW - MX * 2; // 186mm

  // Monta conteúdo HTML estilizado para jsPDF.html()
  const bodyHtml = `
    <div style="
      font-family:'Times New Roman',Times,serif;
      font-size:11.5pt;
      line-height:1.75;
      color:#111;
      width:${contentW * 3.7795}px;
      word-break:break-word;
    ">
      ${html}
    </div>
  `;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;background:white;';
  container.innerHTML = bodyHtml;
  document.body.appendChild(container);
  await new Promise(r => setTimeout(r, 100));

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const PH = pdf.internal.pageSize.getHeight();

  const addHeaderFooter = (pageNum: number, totalPages: number) => {
    // Linha topo
    pdf.setDrawColor(180, 160, 120);
    pdf.setLineWidth(0.4);
    pdf.line(MX, 28, PW - MX, 28);

    // Logo ou nome da empresa
    if (logoBase64) {
      try { pdf.addImage(logoBase64, 'PNG', MX, 6, 0, 18); } catch {}
    }

    // Nome do evento à direita no cabeçalho
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120, 110, 90);
    pdf.text(eventName, PW - MX, 14, { align: 'right' });

    // Linha rodapé
    pdf.line(MX, PH - 14, PW - MX, PH - 14);

    // Texto rodapé
    pdf.setFontSize(7.5);
    pdf.setTextColor(150, 140, 120);
    pdf.text('Paulmaris Sorocaba Ltda · CNPJ 02.646.036/0001-72', MX, PH - 9);
    pdf.text(`Página ${pageNum} de ${totalPages}`, PW - MX, PH - 9, { align: 'right' });

    pdf.setTextColor(17, 17, 17);
  };

  await new Promise<void>((resolve) => {
    pdf.html(container, {
      callback: (doc) => {
        const total = doc.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
          doc.setPage(i);
          addHeaderFooter(i, total);
        }
        doc.save(`CONTRATO RONDELLO BUFFET - ${(eventName ?? 'Evento').trim()}.pdf`);
        resolve();
      },
      x: MX,
      y: MY_TOP,
      width: contentW,
      windowWidth: Math.round(contentW * 3.7795),
      autoPaging: 'text',
      margin: [MY_TOP, MX, MY_BOT, MX],
    });
  });

  document.body.removeChild(container);
}

// ── estilos compartilhados ─────────────────────────────────────────────────────
const inputCls = 'w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1.5';

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── componente ─────────────────────────────────────────────────────────────────
export default function EventArquivosTab({ eventId, event }: Props) {
  const navigate = useNavigate();
  const [tastings, setTastings]           = useState<Tasting[]>([]);
  const [contractTemplate, setContractTemplate] = useState('');
  const [contractText, setContractText]   = useState('');
  const [contractGenerated, setContractGenerated] = useState(false);
  const [signedUrl, setSignedUrl]         = useState('');
  const [annex1, setAnnex1]               = useState('');
  const [annex2, setAnnex2]               = useState('');
  const [showAnnex1, setShowAnnex1]       = useState(false);
  const [showAnnex2, setShowAnnex2]       = useState(false);
  const [annexModels, setAnnexModels]     = useState<AnnexModel[]>([]);
  const [witness1Name, setWitness1Name]   = useState('');
  const [witness1Cpf, setWitness1Cpf]     = useState('');
  const [files, setFiles]                 = useState<EventFile[]>([]);
  const [uploading, setUploading]         = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [companyLogo, setCompanyLogo]     = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const load = async () => {
      const [{ data: tData }, { data: evData }, { data: compData }, { data: axData }, { data: fData }] = await Promise.all([
        supabase.from('tasting_session_events' as any)
          .select('id, session_id, situation_snapshot, paid_amount, tasting_sessions(id, scheduled_date, type)')
          .eq('event_id', eventId),
        supabase.from('events').select('contract_text,contract_signed_url,annex_1_text,annex_2_text').eq('id', eventId).single(),
        supabase.from('companies').select('witness_1_name,witness_1_cpf,logo_base64').limit(1).single(),
        supabase.from('annex_models' as any).select('id,name,content').order('name'),
        supabase.from('event_files' as any).select('id,name,url,created_at').eq('event_id', eventId).order('created_at'),
      ]);
      setTastings(((tData ?? []) as any[]).map(r => ({
        id: r.id,
        session_id: r.session_id,
        scheduled_date: (r.tasting_sessions as any)?.scheduled_date ?? null,
        type: (r.tasting_sessions as any)?.type ?? null,
        situation_snapshot: r.situation_snapshot,
        paid_amount: r.paid_amount,
      })));
      if (evData) {
        const d = evData as any;
        if (d.contract_text) { setContractText(d.contract_text); setContractGenerated(true); }
        setSignedUrl(d.contract_signed_url ?? '');
        if (d.annex_1_text) { setAnnex1(d.annex_1_text); setShowAnnex1(true); }
        if (d.annex_2_text) { setAnnex2(d.annex_2_text); setShowAnnex2(true); }
      }
      if (compData) {
        const c = compData as any;
        setWitness1Name(c.witness_1_name ?? '');
        setWitness1Cpf(c.witness_1_cpf ?? '');
        if (c.logo_base64) setCompanyLogo(c.logo_base64);
      }

      // buscar contract_template do modelo padrão
      const { data: tplData } = await supabase.from('contract_templates' as any)
        .select('content').eq('is_default', true).limit(1).single();
      if (tplData) setContractTemplate((tplData as any).content ?? '');
      else {
        // fallback: primeiro modelo disponível
        const { data: anyTpl } = await supabase.from('contract_templates' as any).select('content').limit(1).single();
        if (anyTpl) setContractTemplate((anyTpl as any).content ?? '');
      }

      setAnnexModels((axData ?? []) as AnnexModel[]);
      setFiles((fData ?? []) as EventFile[]);
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
      toast.error('Nenhum modelo de contrato configurado. Vá em Cadastros → Contratos para criar um modelo padrão.');
      return;
    }
    // Validação de campos obrigatórios
    const missing = REQUIRED_FIELDS.filter(f => !f.getValue(event));
    if (missing.length > 0) {
      toast.error(
        <div>
          <p className="font-semibold mb-1">Campos obrigatórios faltando:</p>
          <ul className="list-disc list-inside text-sm space-y-0.5">
            {missing.map(f => <li key={f.key}>{f.label}</li>)}
          </ul>
        </div>,
        { duration: 6000 }
      );
      return;
    }
    const generated = replaceTags(contractTemplate, event, witness1Name, witness1Cpf);
    setContractText(generated);
    setContractGenerated(true);
    // Reset annexes ao gerar novo contrato
    setAnnex1(''); setAnnex2(''); setShowAnnex1(false); setShowAnnex2(false);
    supabase.from('events').update({ contract_text: generated, annex_1_text: null, annex_2_text: null }).eq('id', eventId);
    toast.success('Contrato gerado com sucesso');
  };

  const handleAnnex = (n: 1 | 2, html: string) => {
    if (n === 1) { setAnnex1(html); autoSave('annex_1_text', html); }
    else { setAnnex2(html); autoSave('annex_2_text', html); }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `event-docs/${eventId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('event-files').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Erro no upload'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('event-files').getPublicUrl(path);
    const { data: newFile, error: dbErr } = await supabase.from('event_files' as any)
      .insert({ event_id: eventId, name: file.name, url: publicUrl }).select('id,name,url,created_at').single();
    if (dbErr) { toast.error('Erro ao salvar'); setUploading(false); return; }
    setFiles(prev => [...prev, newFile as EventFile]);
    toast.success('Arquivo enviado');
    setUploading(false);
  };

  const deleteFile = async (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    await supabase.from('event_files' as any).delete().eq('id', id);
    toast.success('Removido');
  };

  const saveAnnexAsModel = async (content: string) => {
    const name = window.prompt('Nome para salvar como modelo de anexo:');
    if (!name?.trim()) return;
    const COMPANY_ID = 'c56c2ccd-2c35-4ebb-b868-e153727e5d89';
    const { data, error } = await supabase.from('annex_models' as any)
      .insert({ name: name.trim(), company_id: COMPANY_ID, content })
      .select('id,name,content').single();
    if (error) { toast.error('Erro ao salvar modelo'); return; }
    setAnnexModels(prev => [...prev, data as AnnexModel]);
    toast.success(`Modelo "${name.trim()}" salvo`);
  };

  const AnnexBlock = ({ n, content, show, onRemove }: { n: 1 | 2; content: string; show: boolean; onRemove: () => void }) => {
    if (!show) return null;
    return (
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Anexo {n}</span>
          <div className="flex items-center gap-2">
            {annexModels.length > 0 && (
              <select className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background"
                defaultValue=""
                onChange={e => { const m = annexModels.find(x => x.id === e.target.value); if (m) handleAnnex(n, m.content ?? ''); e.currentTarget.value = ''; }}>
                <option value="" disabled>Usar modelo...</option>
                {annexModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            {content && (
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
        <RichTextEditor content={content} onChange={html => handleAnnex(n, html)} placeholder="Conteúdo do anexo..." />
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
                {['Data', 'Tipo', 'Situação', 'Valor pago', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60 pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tastings.map(t => (
                <tr key={t.id} className="border-b border-border/40 last:border-0">
                  <td className="py-2.5 pr-4 font-medium">
                    {t.scheduled_date ? new Date(t.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{t.type ?? '—'}</td>
                  <td className="py-2.5 pr-4">
                    {t.situation_snapshot === 'confirmed'
                      ? <span className="text-[11px] px-2 py-0.5 rounded-full font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">Evento fechado</span>
                      : <span className="text-xs text-muted-foreground">Cliente novo</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {t.paid_amount ? `R$ ${t.paid_amount.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—'}
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => navigate(`/tastings/${t.session_id}`, { state: { from: `/events/${eventId}`, fromLabel: event.event_name ?? 'Evento' } })}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver sessão
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
        <div className="flex items-start justify-between mb-5">
          <div>
            <SectionDivider title="Contrato do evento" />
            <p className="text-xs text-muted-foreground -mt-3">
              As tags são substituídas pelos dados do evento e do cliente automaticamente
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {contractGenerated && (
              <>
                <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
                  Contrato gerado
                </span>
                <button onClick={async () => {
                  setGeneratingPdf(true);
                  try { await downloadContractPDF(contractText, event.event_name ?? 'Contrato', companyLogo); }
                  catch (e) { console.error(e); toast.error('Erro ao gerar PDF'); }
                  finally { setGeneratingPdf(false); }
                }} disabled={generatingPdf}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors disabled:opacity-50"
                  title="Baixar PDF do contrato">
                  {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                </button>
              </>
            )}
            <button onClick={generateContract}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
              <RefreshCw className="w-3 h-3" />
              {contractGenerated ? 'Gerar novo contrato' : 'Gerar contrato'}
            </button>
          </div>
        </div>

        {contractGenerated && contractText ? (
          <>
            <RichTextEditor content={contractText}
              onChange={html => { setContractText(html); autoSave('contract_text', html); }}
              placeholder="" />

            {/* Anexos — somente após contrato gerado */}
            <div className="mt-5 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Anexos contratuais</span>
                <div className="flex gap-2">
                  {!showAnnex1 && (
                    <button onClick={() => setShowAnnex1(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
                      <Plus className="w-3 h-3" />Adicionar anexo
                    </button>
                  )}
                  {showAnnex1 && !showAnnex2 && (
                    <button onClick={() => setShowAnnex2(true)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
                      <Plus className="w-3 h-3" />2º anexo
                    </button>
                  )}
                </div>
              </div>
              <AnnexBlock n={1} content={annex1} show={showAnnex1}
                onRemove={() => { setShowAnnex1(false); handleAnnex(1, ''); }} />
              <AnnexBlock n={2} content={annex2} show={showAnnex2}
                onRemove={() => { setShowAnnex2(false); handleAnnex(2, ''); }} />
              {!showAnnex1 && <p className="text-xs text-muted-foreground mt-1">Nenhum anexo adicionado</p>}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3 border-2 border-dashed border-border rounded-xl text-muted-foreground">
            <FileText className="w-8 h-8 opacity-30" />
            <p className="text-sm">Clique em <strong>"Gerar contrato"</strong> para preencher automaticamente</p>
            {!contractTemplate && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Nenhum modelo configurado — vá em Cadastros → Contratos e marque um como padrão (⭐)
              </p>
            )}
          </div>
        )}
      </div>

      {/* 4. ARQUIVOS DO EVENTO */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <SectionDivider title="Arquivos do evento" />
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors shrink-0 -mt-4 ml-4">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Enviando...' : 'Adicionar arquivo'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Contratos assinados, propostas, fotos, cronogramas ou qualquer documento do evento</p>
        <input ref={fileInputRef} type="file" className="hidden" multiple
          onChange={e => { Array.from(e.target.files ?? []).forEach(handleFileUpload); e.target.value = ''; }} />

        {files.length === 0 ? (
          <div onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 py-10 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/30 hover:bg-muted/20 transition-colors text-muted-foreground">
            <Upload className="w-6 h-6 opacity-40" />
            <p className="text-sm">Clique ou arraste arquivos aqui</p>
            <p className="text-xs opacity-60">PDF, Word, imagens, planilhas...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map(f => (
              <div key={f.id} className="group flex items-center gap-3 px-3 py-2.5 border border-border rounded-xl hover:border-border/80 transition-colors">
                <File className="w-4 h-4 text-primary shrink-0" />
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-sm font-medium text-primary hover:underline truncate">
                  {f.name}
                </a>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(f.created_at).toLocaleDateString('pt-BR')}
                </span>
                <button onClick={() => deleteFile(f.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
