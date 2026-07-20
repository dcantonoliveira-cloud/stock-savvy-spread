import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  X, ChevronRight, ChevronLeft, Users, Upload,
  Rocket, CheckCircle2, AlertCircle, Loader2, FileText, Search,
} from 'lucide-react';
import { sha256Hex } from '@/lib/payslipPdf';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const TIPOS = [
  { value: 'pagamento',   label: 'Pagamento' },
  { value: 'adiantamento', label: 'Adiantamento' },
  { value: 'ferias',      label: 'Férias' },
  { value: '13o',         label: '13º Salário' },
  { value: 'rescisao',    label: 'Rescisão' },
  { value: 'outros',      label: 'Outros' },
];

interface Employee { id: string; display_name: string; email: string }
interface EmployeeFile { employee: Employee; file: File | null }
type JobStatus = 'pending' | 'uploading' | 'done' | 'error';
interface Job { employee: Employee; file: File; status: JobStatus; error?: string }

interface Props { onClose: () => void; onDone: () => void }

export default function BulkPayslipUpload({ onClose, onDone }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [tipo, setTipo] = useState('pagamento');
  const [files, setFiles] = useState<Record<string, File>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    loadEmployees();
    loadCompany();
  }, []);

  const loadEmployees = async () => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'employee');
    const employeeIds = (roles ?? []).map((r: any) => r.user_id);
    if (employeeIds.length === 0) { setEmployees([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('user_id, display_name, email')
      .in('user_id', employeeIds)
      .order('display_name');
    setEmployees((data ?? []).map((p: any) => ({ id: p.user_id, display_name: p.display_name, email: p.email })));
  };

  const loadCompany = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.user.id)
      .single();
    setCompanyId((data as any)?.company_id ?? null);
  };

  const toggleAll = (visible: Employee[]) => {
    const allSelected = visible.every(e => selected.has(e.id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) visible.forEach(e => next.delete(e.id));
      else visible.forEach(e => next.add(e.id));
      return next;
    });
  };

  const visibleEmployees = employees.filter(e =>
    !search || e.display_name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase())
  );
  const selectedEmployees = employees.filter(e => selected.has(e.id));
  const allFilesUploaded = selectedEmployees.length > 0 && selectedEmployees.every(e => files[e.id]);

  const handleFileChange = (empId: string, file: File | null) => {
    if (!file) return;
    setFiles(prev => ({ ...prev, [empId]: file }));
  };

  const handlePublish = async () => {
    if (!companyId) { toast.error('Empresa não encontrada'); return; }
    const jobList: Job[] = selectedEmployees
      .filter(e => files[e.id])
      .map(e => ({ employee: e, file: files[e.id], status: 'pending' }));
    setJobs(jobList);
    setStep(3);
    setRunning(true);

    const refMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthLabel = `${MONTHS[month]}/${year}`;
    const tipoLabel = TIPOS.find(t => t.value === tipo)?.label ?? 'Holerite';
    const title = `${tipoLabel} ${monthLabel}`;
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    for (let i = 0; i < jobList.length; i++) {
      const job = jobList[i];
      setJobs(prev => prev.map((j, idx) => idx === i ? { ...j, status: 'uploading' } : j));
      try {
        const fileBytes = await job.file.arrayBuffer();
        const hash = await sha256Hex(fileBytes);

        // Upsert payslip
        const { data: ps, error: psErr } = await supabase
          .from('payslips' as any)
          .upsert({
            company_id: companyId,
            employee_id: job.employee.id,
            reference_month: refMonth,
            title,
            status: 'published',
            current_version: 1,
            created_by: userId,
            published_at: new Date().toISOString(),
          }, { onConflict: 'company_id,employee_id,reference_month', ignoreDuplicates: false })
          .select('id, current_version, status')
          .single();
        if (psErr) throw psErr;

        const payslipId = (ps as any).id;
        const version = 1;

        // Mark old versions as not current
        await supabase
          .from('payslip_versions' as any)
          .update({ is_current: false })
          .eq('payslip_id', payslipId);

        // Upload PDF
        const path = `${companyId}/${payslipId}/v${version}.pdf`;
        const { error: storageErr } = await supabase.storage
          .from('payslips')
          .upload(path, job.file, { contentType: 'application/pdf', upsert: true });
        if (storageErr) throw storageErr;

        // Insert version
        await supabase.from('payslip_versions' as any).upsert({
          payslip_id: payslipId,
          version_number: version,
          storage_path: path,
          file_size: job.file.size,
          sha256_hash: hash,
          uploaded_by: userId,
          is_current: true,
        }, { onConflict: 'payslip_id,version_number' });

        // Audit
        await supabase.from('payslip_audit_logs' as any).insert({
          payslip_id: payslipId,
          company_id: companyId,
          user_id: userId,
          action: 'payslip_created',
          details: { version, hash, employee: job.employee.display_name, bulk: true },
        });

        // Notificações em background
        const signUrl = `${window.location.origin}/meus-holerites/${payslipId}`;
        supabase.functions.invoke('send-payslip-notification', {
          body: { payslip_id: payslipId, employee_id: job.employee.id, payslip_title: title, sign_url: signUrl, channels: ['email', 'whatsapp'] },
        });

        setJobs(prev => prev.map((j, idx) => idx === i ? { ...j, status: 'done' } : j));
      } catch (e: any) {
        setJobs(prev => prev.map((j, idx) => idx === i ? { ...j, status: 'error', error: e.message ?? 'Erro desconhecido' } : j));
      }
    }

    setRunning(false);
  };

  const doneCount = jobs.filter(j => j.status === 'done').length;
  const errorCount = jobs.filter(j => j.status === 'error').length;
  const allDone = !running && jobs.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-semibold text-foreground">Upload em lote</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {TIPOS.find(t => t.value === tipo)?.label} · {MONTHS[month]}/{year} — Passo {step} de 3
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-border bg-muted/20 flex-shrink-0">
          {[
            { n: 1, label: 'Funcionários', icon: Users },
            { n: 2, label: 'Arquivos',     icon: Upload },
            { n: 3, label: 'Publicar',     icon: Rocket },
          ].map(({ n, label, icon: Icon }, i) => (
            <div key={n} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                step === n ? 'bg-primary text-white' :
                step > n  ? 'text-primary' : 'text-muted-foreground'
              }`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
              {i < 2 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 mx-1" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Step 1: Selecionar funcionários ── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Competência */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês</label>
                  <select value={month} onChange={e => setMonth(Number(e.target.value))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Ano</label>
                  <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
                    min={2020} max={2099}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTipo(t.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        tipo === t.value
                          ? 'bg-primary text-white border-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <input type="text" placeholder="Buscar funcionário..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>

              {/* Table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="px-4 py-2.5 w-10">
                        <input type="checkbox"
                          checked={visibleEmployees.length > 0 && visibleEmployees.every(e => selected.has(e.id))}
                          onChange={() => toggleAll(visibleEmployees)}
                          className="rounded" />
                      </th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">Nome</th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">E-mail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {visibleEmployees.map(e => (
                      <tr key={e.id} onClick={() => setSelected(prev => { const n = new Set(prev); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n; })}
                        className="hover:bg-muted/20 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5">
                          <input type="checkbox" checked={selected.has(e.id)} readOnly className="rounded pointer-events-none" />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-foreground">{e.display_name}</td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{e.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected.size > 0 && (
                <p className="text-xs text-primary font-medium">{selected.size} funcionário{selected.size > 1 ? 's' : ''} selecionado{selected.size > 1 ? 's' : ''}</p>
              )}
            </div>
          )}

          {/* ── Step 2: Upload de arquivos ── */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Selecione o PDF de cada funcionário para <strong>{MONTHS[month]}/{year}</strong>.
              </p>
              {selectedEmployees.map(e => {
                const isDragging = dragging === e.id;
                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-3 p-3 border rounded-xl transition-colors ${
                      isDragging
                        ? 'border-primary bg-primary/5 border-solid'
                        : files[e.id]
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : 'border-border border-dashed'
                    }`}
                    onDragOver={ev => { ev.preventDefault(); setDragging(e.id); }}
                    onDragLeave={() => setDragging(null)}
                    onDrop={ev => {
                      ev.preventDefault();
                      setDragging(null);
                      const file = ev.dataTransfer.files?.[0];
                      if (file?.type === 'application/pdf') handleFileChange(e.id, file);
                      else if (file) toast.error('Apenas arquivos PDF são aceitos');
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                      {e.display_name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{e.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.email}</p>
                    </div>
                    {files[e.id] ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate max-w-[140px]">{files[e.id].name}</span>
                        <button onClick={e2 => { e2.stopPropagation(); setFiles(prev => { const n = {...prev}; delete n[e.id]; return n; }); }}
                          className="text-emerald-600 hover:text-red-500 ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRefs.current[e.id]?.click()}
                        className={`flex items-center gap-1.5 text-xs border px-3 py-1.5 rounded-lg transition-colors ${
                          isDragging
                            ? 'border-primary text-primary bg-primary/5'
                            : 'text-muted-foreground border-dashed border-border hover:border-primary hover:text-primary'
                        }`}>
                        <Upload className="w-3.5 h-3.5" />
                        {isDragging ? 'Solte aqui' : 'Selecionar PDF'}
                      </button>
                    )}
                    <input
                      type="file" accept="application/pdf" className="hidden"
                      ref={el => { fileRefs.current[e.id] = el; }}
                      onChange={ev => handleFileChange(e.id, ev.target.files?.[0] ?? null)}
                    />
                  </div>
                );
              })}
              {!allFilesUploaded && (
                <p className="text-xs text-amber-600 font-medium">
                  {selectedEmployees.filter(e => !files[e.id]).length} arquivo{selectedEmployees.filter(e => !files[e.id]).length > 1 ? 's' : ''} pendente{selectedEmployees.filter(e => !files[e.id]).length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* ── Step 3: Progresso ── */}
          {step === 3 && (
            <div className="space-y-3">
              {jobs.length === 0 && (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
              {jobs.map((job, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 border rounded-xl transition-colors ${
                  job.status === 'done'      ? 'border-emerald-200 bg-emerald-50' :
                  job.status === 'error'     ? 'border-red-200 bg-red-50' :
                  job.status === 'uploading' ? 'border-primary/30 bg-primary/5' :
                  'border-border bg-white'
                }`}>
                  <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 border border-border/50">
                    {job.employee.display_name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{job.employee.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.file.name}</p>
                    {job.status === 'error' && <p className="text-xs text-red-600 mt-0.5">{job.error}</p>}
                  </div>
                  <div className="flex-shrink-0">
                    {job.status === 'pending'   && <div className="w-4 h-4 rounded-full border-2 border-border" />}
                    {job.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {job.status === 'done'      && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    {job.status === 'error'     && <AlertCircle className="w-4 h-4 text-red-500" />}
                  </div>
                </div>
              ))}

              {allDone && (
                <div className={`p-4 rounded-xl text-sm font-medium text-center ${errorCount === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {errorCount === 0
                    ? `✓ ${doneCount} holerite${doneCount > 1 ? 's' : ''} publicado${doneCount > 1 ? 's' : ''} com sucesso!`
                    : `${doneCount} publicado${doneCount > 1 ? 's' : ''}, ${errorCount} com erro`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={() => step === 1 ? onClose() : setStep(s => (s - 1) as 1 | 2 | 3)}
            disabled={running || (step === 3 && !allDone)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={selected.size === 0}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40">
              Próximo — {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handlePublish}
              disabled={!allFilesUploaded}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40">
              <Rocket className="w-4 h-4" />
              Publicar {selectedEmployees.filter(e => files[e.id]).length} holerite{selectedEmployees.filter(e => files[e.id]).length !== 1 ? 's' : ''}
            </button>
          )}

          {step === 3 && allDone && (
            <button
              onClick={() => { onDone(); onClose(); }}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <CheckCircle2 className="w-4 h-4" />
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
