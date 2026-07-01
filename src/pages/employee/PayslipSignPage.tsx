import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CheckCircle2, Download, ArrowLeft, Shield, Loader2, AlertCircle } from 'lucide-react';
import SignaturePad from '@/components/payslips/SignaturePad';
import { sha256Hex, generateSignedPdf, AuditData } from '@/lib/payslipPdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Payslip {
  id: string; title: string; status: string; reference_month: string;
  company_id: string; current_version: number;
}
interface Version { id: string; storage_path: string; sha256_hash: string; version_number: number }
interface Signature { id: string; signed_at_utc: string; signature_hash: string; signed_pdf_path: string | null }

export default function PayslipSignPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [version, setVersion] = useState<Version | null>(null);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const [viewed, setViewed] = useState(false);

  useEffect(() => {
    if (id && user) load();
  }, [id, user]);

  const load = async () => {
    setLoading(true);
    const { data: ps } = await supabase
      .from('payslips' as any)
      .select('id, title, status, reference_month, company_id, current_version')
      .eq('id', id!)
      .eq('employee_id', user!.id)
      .single();
    if (!ps) { toast.error('Holerite não encontrado'); navigate('/meus-holerites'); return; }
    setPayslip(ps as unknown as Payslip);

    const { data: ver } = await supabase
      .from('payslip_versions' as any)
      .select('id, storage_path, sha256_hash, version_number')
      .eq('payslip_id', id!)
      .eq('is_current', true)
      .single();
    if (!ver) { toast.error('Versão não encontrada'); return; }
    setVersion(ver as unknown as Version);

    // Signed URL for viewing
    const { data: urlData } = await supabase.storage
      .from('payslips')
      .createSignedUrl((ver as any).storage_path, 3600);
    if (urlData?.signedUrl) setPdfUrl(urlData.signedUrl);

    // Check if already signed
    const { data: sig } = await supabase
      .from('electronic_signatures' as any)
      .select('id, signed_at_utc, signature_hash, signed_pdf_path')
      .eq('payslip_id', id!)
      .eq('employee_id', user!.id)
      .maybeSingle();
    if (sig) setSignature(sig as unknown as Signature);

    // Audit: viewed
    await supabase.from('payslip_audit_logs' as any).insert({
      payslip_id: id,
      company_id: (ps as any).company_id,
      user_id: user!.id,
      action: 'payslip_viewed',
      details: { title: (ps as any).title },
    });

    setLoading(false);
  };

  const handleSign = async (method: 'drawn' | 'typed', sigData: string) => {
    if (!payslip || !version || !user) return;
    setPadOpen(false);
    setSigning(true);
    try {
      // 1. Download original PDF
      const { data: pdfBlob, error: dlErr } = await supabase.storage
        .from('payslips')
        .download(version.storage_path);
      if (dlErr || !pdfBlob) throw new Error('Erro ao baixar PDF');

      const pdfBytes = await pdfBlob.arrayBuffer();

      // 2. Verify hash integrity
      const computedHash = await sha256Hex(pdfBytes);
      if (computedHash !== version.sha256_hash) {
        throw new Error('Integridade do documento comprometida — hash não corresponde');
      }

      // 3. Build audit data (partial — signature_id and hash will come from edge function)
      const signedAt = new Date();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const signedAtLocal = format(signedAt, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });

      // 4. Generate signed PDF client-side
      const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .eq('id', payslip.company_id)
        .single();

      const tempAuditData: AuditData = {
        signature_id: '(pendente)',
        signature_hash: '(pendente)',
        document_hash: computedHash,
        employee_name: profile?.display_name ?? user.email ?? '',
        company_name: (companyData as any)?.name ?? 'Empresa',
        payslip_title: payslip.title,
        signed_at_utc: signedAt.toISOString(),
        signed_at_local: signedAtLocal,
        timezone: tz,
        ip_address: '(registrado pelo servidor)',
        browser: getBrowser(),
        os: getOS(),
        device_type: /Mobile/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        document_version: version.version_number,
        sig_method: method,
        sig_data: sigData,
      };

      const signedPdfBytes = await generateSignedPdf(pdfBytes, tempAuditData);

      // 5. Upload signed PDF (temp path; will be confirmed after we get signature_id)
      const tempPath = `${payslip.company_id}/${payslip.id}/signed_temp_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('payslips')
        .upload(tempPath, signedPdfBytes, { contentType: 'application/pdf' });
      if (upErr) throw upErr;

      // 6. Call edge function to record signature
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payslip-sign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            payslip_id: payslip.id,
            payslip_version_id: version.id,
            document_hash: computedHash,
            sig_method: method,
            sig_data: sigData,
            signed_pdf_path: tempPath,
            timezone: tz,
            signed_at_local: signedAtLocal,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        // Cleanup temp upload
        await supabase.storage.from('payslips').remove([tempPath]);
        throw new Error(err.error ?? 'Erro ao registrar assinatura');
      }

      const result = await res.json();

      // 7. Rename to final path with real signature_id
      const finalPath = `${payslip.company_id}/${payslip.id}/signed_${result.signature_id}.pdf`;
      await supabase.storage.from('payslips').move(tempPath, finalPath);

      // 8. Update signed_pdf_path on signature record
      await supabase
        .from('electronic_signatures' as any)
        .update({ signed_pdf_path: finalPath })
        .eq('id', result.signature_id);

      setSignature({
        id: result.signature_id,
        signed_at_utc: result.signed_at,
        signature_hash: result.signature_hash,
        signed_pdf_path: finalPath,
      });
      setPayslip(p => p ? { ...p, status: 'signed' } : p);
      toast.success('Holerite assinado com sucesso!');
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao assinar');
    } finally {
      setSigning(false);
    }
  };

  const downloadSigned = async () => {
    // Fallback: se não tiver PDF assinado, baixa o original
    const path = signature?.signed_pdf_path ?? version?.storage_path;
    if (!path) { toast.error('PDF não disponível'); return; }

    const { data, error } = await supabase.storage
      .from('payslips')
      .createSignedUrl(path, 300);

    if (error || !data?.signedUrl) {
      toast.error('Erro ao gerar link de download');
      return;
    }

    // Cria link <a> para forçar download sem depender de popup
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = `${payslip?.title ?? 'holerite'}.pdf`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    await supabase.from('payslip_audit_logs' as any).insert({
      payslip_id: payslip?.id,
      company_id: payslip?.company_id,
      user_id: user?.id,
      action: 'payslip_downloaded',
      details: { path },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!payslip) return null;

  const isSigned = payslip.status === 'signed' || !!signature;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => navigate('/meus-holerites')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Meus Holerites
      </button>

      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{payslip.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSigned ? 'Assinado ✓' : 'Aguardando sua assinatura'}
          </p>
        </div>
        {isSigned && signature && (
          <button onClick={downloadSigned}
            className="flex items-center gap-2 text-sm border border-border px-3 py-2 rounded-xl hover:bg-muted transition-colors">
            <Download className="w-4 h-4" />
            Baixar PDF assinado
          </button>
        )}
      </div>

      {/* PDF viewer */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20 text-xs font-medium text-muted-foreground">
          Visualizador de documento
        </div>
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full"
            style={{ height: '60vh' }}
            onLoad={() => setViewed(true)}
            title="Holerite"
          />
        ) : (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Carregando documento...
          </div>
        )}
      </div>

      {/* Sign or success */}
      {!isSigned ? (
        <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-foreground">Assinatura eletrônica com trilha de auditoria</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sua assinatura registra IP, navegador, horário e hash SHA-256 do documento.
              </p>
            </div>
          </div>
          <button
            onClick={() => { if (!viewed) { toast('Role o documento antes de assinar', { icon: '👀' }); } setPadOpen(true); }}
            disabled={signing}
            className="w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {signing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando assinatura...</>
              : 'Assinar holerite'}
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-3 w-full">
              <div>
                <p className="font-semibold text-emerald-800">Holerite assinado</p>
                {signature && (
                  <p className="text-sm text-emerald-700 mt-0.5">
                    {format(new Date(signature.signed_at_utc), "dd 'de' MMMM 'de' yyyy 'às' HH:mm:ss", { locale: ptBR })} (UTC)
                  </p>
                )}
              </div>
              {signature && (
                <div className="bg-white/60 rounded-xl p-4 space-y-1.5 text-xs font-mono text-emerald-900 break-all">
                  <p><span className="text-emerald-600 font-sans font-semibold not-italic">Código:</span> {signature.id}</p>
                  <p><span className="text-emerald-600 font-sans font-semibold not-italic">Hash:</span> {signature.signature_hash}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {padOpen && (
        <SignaturePad
          onConfirm={handleSign}
          onCancel={() => setPadOpen(false)}
          employeeName={profile?.display_name ?? ''}
        />
      )}
    </div>
  );
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  if (/Chrome\//.test(ua)) return 'Google Chrome';
  if (/Firefox\//.test(ua)) return 'Mozilla Firefox';
  if (/Safari\//.test(ua)) return 'Apple Safari';
  return 'Desconhecido';
}
function getOS(): string {
  const ua = navigator.userAgent;
  if (/Windows NT 10/.test(ua)) return 'Windows 10';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Desconhecido';
}
