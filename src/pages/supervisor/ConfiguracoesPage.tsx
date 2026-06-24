import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, X, Loader2 } from 'lucide-react';

interface Company {
  id: string;
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

const inputCls = 'w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1';

export default function ConfiguracoesPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    supabase.from('companies').select('*').limit(1).single().then(({ data }) => {
      if (data) setCompany(data as any);
    });
  }, []);

  const save = (field: string, value: string | null) => {
    if (!company) return;
    setCompany(prev => prev ? { ...prev, [field]: value } : prev);
    clearTimeout(timers.current[field]);
    timers.current[field] = setTimeout(async () => {
      const { error } = await supabase.from('companies').update({ [field]: value }).eq('id', company.id);
      if (error) toast.error('Erro ao salvar');
      else toast.success('Salvo');
    }, 1200);
  };

  const handleLogoUpload = async (file: File) => {
    if (!company) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const { error } = await supabase.from('companies').update({ logo_base64: base64 }).eq('id', company.id);
      if (error) { toast.error('Erro ao salvar logo'); setUploading(false); return; }
      setCompany(prev => prev ? { ...prev, logo_base64: base64 } : prev);
      toast.success('Logo salva');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = async () => {
    if (!company) return;
    await supabase.from('companies').update({ logo_base64: null }).eq('id', company.id);
    setCompany(prev => prev ? { ...prev, logo_base64: null } : prev);
    toast.success('Logo removida');
  };

  if (!company) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  const Section = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      {/* Identidade */}
      <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
        <Section title="Identidade da empresa" />

        {/* Logo */}
        <div>
          <p className={labelCls}>Logo (usada nos PDFs)</p>
          {company.logo_base64 ? (
            <div className="flex items-center gap-4">
              <img src={company.logo_base64} alt="Logo" className="h-14 object-contain border border-border rounded-lg p-2" />
              <button onClick={removeLogo} className="flex items-center gap-1.5 text-xs text-destructive hover:underline">
                <X className="w-3.5 h-3.5" />Remover
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
            >
              {uploading
                ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                : <Upload className="w-5 h-5 text-muted-foreground/50" />}
              <p className="text-sm text-muted-foreground">{uploading ? 'Enviando...' : 'Clique para subir a logo'}</p>
              <p className="text-xs text-muted-foreground/60">PNG ou JPG, preferencialmente fundo transparente</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Nome da empresa</label>
            <input className={inputCls} value={company.name ?? ''} onChange={e => save('name', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Razão Social</label>
            <input className={inputCls} value={company.razao_social ?? ''} onChange={e => save('razao_social', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>CNPJ</label>
            <input className={inputCls} value={company.cnpj ?? ''} onChange={e => save('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input className={inputCls} value={company.telefone ?? ''} onChange={e => save('telefone', e.target.value)} placeholder="(15) 3327.2853" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Endereço completo</label>
            <input className={inputCls} value={company.endereco ?? ''} onChange={e => save('endereco', e.target.value)} placeholder="R. Dep. Ranieri Mazilli, 55 – Campolim – Sorocaba/SP" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Website</label>
            <input className={inputCls} value={company.website ?? ''} onChange={e => save('website', e.target.value)} placeholder="rondellobuffet.com.br" />
          </div>
        </div>
      </div>

      {/* Dados bancários */}
      <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
        <Section title="Dados bancários (exibidos nos PDFs)" />
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Banco</label>
            <input className={inputCls} value={company.banco ?? ''} onChange={e => save('banco', e.target.value)} placeholder="Itaú 341" />
          </div>
          <div>
            <label className={labelCls}>Agência</label>
            <input className={inputCls} value={company.agencia ?? ''} onChange={e => save('agencia', e.target.value)} placeholder="4877" />
          </div>
          <div>
            <label className={labelCls}>Conta</label>
            <input className={inputCls} value={company.conta ?? ''} onChange={e => save('conta', e.target.value)} placeholder="00004-4" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground/60">
          Esses dados aparecem na seção "Dados para faturamento" do PDF de fechamento.
        </p>
      </div>

      {saving && <p className="text-xs text-muted-foreground">Salvando...</p>}
    </div>
  );
}
