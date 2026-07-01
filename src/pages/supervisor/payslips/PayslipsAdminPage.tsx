import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Upload, FileText, CheckCircle2, Clock, Eye, Download,
  Plus, Loader2, X, ArrowLeft,
} from 'lucide-react';
import { sha256Hex } from '@/lib/payslipPdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

interface Employee { id: string; display_name: string; email: string }
interface Payslip {
  id: string; title: string; status: string; reference_month: string;
  employee_id: string; published_at: string | null; created_at: string;
  profiles?: { display_name: string; email: string };
  electronic_signatures?: { id: string; signed_at_utc: string; signature_hash: string }[];
}

const STATUS_MAP = {
  draft:     { label: 'Rascunho',   cls: 'bg-slate-100 text-slate-600' },
  published: { label: 'Pendente',   cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  signed:    { label: 'Assinado',   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};

export default function PayslipsAdminPage() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const employeeFilter = searchParams.get('employee');

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [form, setForm] = useState({
    employee_id: employeeFilter ?? '',
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    file: null as File | null,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [psRes, empRes] = await Promise.all([
      supabase
        .from('payslips' as any)
        .select('id, title, status, reference_month, employee_id, published_at, created_at, profiles(display_name, email), electronic_signatures(id, signed_at_utc, signature_hash)')
        .order('reference_month', { ascending: false }),
      supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .eq('company_id', profile?.company_id ?? ''),
    ]);
    setPayslips((psRes.data ?? []) as unknown as Payslip[]);
    setEmployees((empRes.data ?? []).map((p: any) => ({ id: p.user_id, display_name: p.display_name, email: p.email })));
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!form.employee_id || !form.file) return toast.error('Selecione o funcionário e o PDF');
    if (form.file.type !== 'application/pdf') return toast.error('Apenas arquivos PDF são aceitos');
    setUploading(true);
    try {
      const refMonth = `${form.year}-${String(form.month + 1).padStart(2, '0')}-01`;
      const monthLabel = `${MONTHS[form.month]}/${form.year}`;
      const title = `Holerite ${monthLabel}`;
      const emp = employees.find(e => e.id === form.employee_id);

      // Compute SHA-256
      const fileBytes = await form.file.arrayBuffer();
      const hash = await sha256Hex(fileBytes);

      // Check if payslip already exists for this employee/month
      const { data: existing } = await supabase
        .from('payslips' as any)
        .select('id, status, current_version')
        .eq('employee_id', form.employee_id)
        .eq('reference_month', refMonth)
        .maybeSingle();

      let payslipId: string;
      let version: number;

      if (existing) {
        if ((existing as any).status === 'signed') {
          toast.error('Este holerite já foi assinado. Não é possível substituí-lo.');
          return;
        }
        payslipId = (existing as any).id;
        version = ((existing as any).current_version ?? 1) + 1;
        // Mark old versions as not current
        await supabase
          .from('payslip_versions' as any)
          .update({ is_current: false })
          .eq('payslip_id', payslipId);
      } else {
        const { data: ps, error } = await supabase
          .from('payslips' as any)
          .insert({
            company_id: profile?.company_id,
            employee_id: form.employee_id,
            reference_month: refMonth,
            title,
            status: 'draft',
            current_version: 1,
            created_by: (await supabase.auth.getUser()).data.user?.id,
          })
          .select('id')
          .single();
        if (error) throw error;
        payslipId = (ps as any).id;
        version = 1;
      }

      // Upload PDF to Storage
      const path = `${profile?.company_id}/${payslipId}/v${version}.pdf`;
      const { error: storageErr } = await supabase.storage
        .from('payslips')
        .upload(path, form.file, { contentType: 'application/pdf', upsert: true });
      if (storageErr) throw storageErr;

      // Insert version record
      const { error: vErr } = await supabase
        .from('payslip_versions' as any)
        .insert({
          payslip_id: payslipId,
          version_number: version,
          storage_path: path,
          file_size: form.file.size,
          sha256_hash: hash,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
          is_current: true,
        });
      if (vErr) throw vErr;

      // Update payslip current_version
      await supabase
        .from('payslips' as any)
        .update({ current_version: version, status: 'published', published_at: new Date().toISOString() })
        .eq('id', payslipId);

      // Audit log
      await supabase.from('payslip_audit_logs' as any).insert({
        payslip_id: payslipId,
        company_id: profile?.company_id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: version === 1 ? 'payslip_created' : 'new_version_created',
        details: { version, hash, employee: emp?.display_name },
      });

      toast.success(`Holerite publicado para ${emp?.display_name ?? 'funcionário'}`);
      setModalOpen(false);
      setForm({ employee_id: '', month: new Date().getMonth(), year: new Date().getFullYear(), file: null });
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao publicar holerite');
    } finally {
      setUploading(false);
    }
  };

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from('payslips').createSignedUrl(path, 60);
    return data?.signedUrl;
  };

  const viewPdf = async (payslipId: string) => {
    const { data: ver } = await supabase
      .from('payslip_versions' as any)
      .select('storage_path')
      .eq('payslip_id', payslipId)
      .eq('is_current', true)
      .single();
    if (!ver) return;
    const url = await getSignedUrl((ver as any).storage_path);
    if (url) window.open(url, '_blank');
  };

  const viewSignedPdf = async (sigId: string) => {
    const { data: sig } = await supabase
      .from('electronic_signatures' as any)
      .select('signed_pdf_path')
      .eq('id', sigId)
      .single();
    if (!sig || !(sig as any).signed_pdf_path) return toast.error('PDF assinado não disponível');
    const url = await getSignedUrl((sig as any).signed_pdf_path);
    if (url) window.open(url, '_blank');
  };

  const filteredEmployee = employeeFilter
    ? payslips.filter(p => p.employee_id === employeeFilter)
    : payslips;
  const filtered = filterStatus === 'all'
    ? filteredEmployee
    : filteredEmployee.filter(p => p.status === filterStatus);

  const source = employeeFilter ? filteredEmployee : payslips;
  const counts = { all: source.length, draft: 0, published: 0, signed: 0 };
  source.forEach(p => { if (p.status in counts) counts[p.status as keyof typeof counts]++; });

  const focusedEmployee = employeeFilter
    ? employees.find(e => e.id === employeeFilter)
    : null;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb when filtering by employee */}
      {employeeFilter && (
        <button
          onClick={() => navigate('/users')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Funcionários
        </button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {focusedEmployee ? `Holerites — ${focusedEmployee.display_name}` : 'Holerites'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {focusedEmployee
              ? focusedEmployee.email
              : 'Gerencie e publique holerites para os funcionários'}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Publicar holerite
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pendentes', count: counts.published, color: 'text-amber-600' },
          { label: 'Assinados', count: counts.signed, color: 'text-emerald-600' },
          { label: 'Total',     count: counts.all,      color: 'text-primary' },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground/60 font-semibold uppercase tracking-widest">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: 'all', label: `Todos (${counts.all})` },
          { key: 'published', label: `Pendentes (${counts.published})` },
          { key: 'signed', label: `Assinados (${counts.signed})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filterStatus === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <th className="text-left px-5 py-3">Funcionário</th>
              <th className="text-left px-4 py-3">Holerite</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Data assinatura</th>
              <th className="text-right px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[30, 25, 15, 20, 10].map((w, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 bg-muted/40 rounded animate-pulse" style={{ width: `${w}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  Nenhum holerite encontrado.
                </td>
              </tr>
            ) : filtered.map(p => {
              const sig = p.electronic_signatures?.[0];
              const status = STATUS_MAP[p.status as keyof typeof STATUS_MAP] ?? { label: p.status, cls: 'bg-muted text-muted-foreground' };
              return (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{(p as any).profiles?.display_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{(p as any).profiles?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {sig
                      ? format(new Date(sig.signed_at_utc), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => viewPdf(p.id)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title="Ver PDF original">
                        <Eye className="w-4 h-4" />
                      </button>
                      {sig && (
                        <button onClick={() => viewSignedPdf(sig.id)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors" title="Ver PDF assinado">
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Upload modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Publicar Holerite</h2>
              <button onClick={() => setModalOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Employee */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Funcionário</label>
                <select
                  value={form.employee_id}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">Selecione...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.display_name} ({e.email})</option>
                  ))}
                </select>
              </div>
              {/* Month/Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês</label>
                  <select
                    value={form.month}
                    onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Ano</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    min={2020} max={2099}
                  />
                </div>
              </div>
              {/* PDF upload */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Arquivo PDF</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
                  {form.file ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-foreground">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="font-medium">{form.file.name}</span>
                      <span className="text-muted-foreground">({(form.file.size / 1024).toFixed(0)} KB)</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">Clique para selecionar o PDF</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button onClick={handleUpload} disabled={uploading || !form.employee_id || !form.file}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Publicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
