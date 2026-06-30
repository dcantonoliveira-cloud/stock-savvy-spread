import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2 } from 'lucide-react';

interface Company { name: string | null; logo_base64: string | null }

interface FormData {
  name: string;
  cpf: string;
  rg: string;
  address: string;
  zip_code: string;
  phone: string;
  email: string;
  witness_name: string;
  witness_cpf: string;
  witness_email: string;
  source: string;
}

const inputCls =
  'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors bg-white';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5';

const maskCpfCnpj = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_,a,b,c,e) => [a,b,c].filter(Boolean).join('.') + (e ? '-'+e : ''));
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_,a,b,c,e,f) => `${a}.${b}.${c}/${e}` + (f ? '-'+f : ''));
};

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, (_,a,b,c) => `(${a}) ${b}` + (c ? '-'+c : ''));
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, (_,a,b,c) => `(${a}) ${b}` + (c ? '-'+c : ''));
};

const maskCep = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})/, (_,a,b) => a + (b ? '-'+b : ''));
};

const maskRg = (v: string) => {
  const d = v.replace(/[^\dXx]/g, '').slice(0, 9);
  return d.replace(/(\d{2})(\d{3})(\d{3})([0-9Xx]{0,1})/, (_,a,b,c,e) => `${a}.${b}.${c}` + (e ? '-'+e : ''));
};

const BLANK: FormData = {
  name: '', cpf: '', rg: '', address: '', zip_code: '',
  phone: '', email: '', witness_name: '', witness_cpf: '', witness_email: '', source: '',
};

function CompanyHeader({ company }: { company: Company | null }) {
  return (
    <div className="text-center mb-8">
      {company?.logo_base64 ? (
        <img src={company.logo_base64} alt={company.name ?? 'Logo'} className="h-16 mx-auto mb-3 object-contain" />
      ) : (
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mx-auto mb-3">
          <span className="text-white font-bold text-xl">{(company?.name ?? 'R')[0]}</span>
        </div>
      )}
      {company?.name && <h1 className="text-xl font-bold text-gray-800">{company.name}</h1>}
      <p className="text-gray-500 text-sm mt-1">Dados para elaboração de contrato</p>
    </div>
  );
}

export default function ContractFormPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'form' | 'submitted' | 'invalid' | 'done'>('loading');
  const [eventId, setEventId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<FormData>(BLANK);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }

    // Fetch company logo (public, no auth needed)
    supabase.from('companies').select('name, logo_base64').limit(1).single()
      .then(({ data }) => { if (data) setCompany(data as Company); });

    (supabase.from as any)('events')
      .select('id, contract_form_submitted, client_id, clients(id)')
      .eq('contract_form_token', token)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!data) { setState('invalid'); return; }
        if (data.contract_form_submitted) { setState('submitted'); return; }
        setEventId(data.id);
        setClientId(data.clients?.id ?? null);
        setState('form');
      });
  }, [token]);

  const set = (k: keyof FormData, mask?: (v: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [k]: mask ? mask(e.target.value) : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    setSaving(true);

    if (clientId) {
      await (supabase.from as any)('clients').update({
        name:     form.name     || undefined,
        cpf:      form.cpf      || undefined,
        rg:       form.rg       || undefined,
        address:  form.address  || undefined,
        zip_code: form.zip_code || undefined,
        phone:    form.phone    || undefined,
        email:    form.email    || undefined,
        source:   form.source   || undefined,
      }).eq('id', clientId);
    }

    await (supabase.from as any)('events').update({
      witness_name:            form.witness_name  || null,
      witness_cpf:             form.witness_cpf   || null,
      witness_email:           form.witness_email || null,
      contract_form_submitted: true,
    }).eq('id', eventId);

    setSaving(false);
    setState('done');
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <CompanyHeader company={company} />
          <p className="text-gray-500 font-medium">Link inválido ou expirado.</p>
          <p className="text-sm text-gray-400 mt-1">Entre em contato com o buffet.</p>
        </div>
      </div>
    );
  }

  if (state === 'submitted') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <CompanyHeader company={company} />
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-1">Dados já enviados</h2>
          <p className="text-sm text-gray-500">Este formulário já foi preenchido. Obrigado!</p>
        </div>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 max-w-md w-full text-center">
          <CompanyHeader company={company} />
          <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <p className="text-gray-500 text-sm mt-2">Informações salvas com sucesso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <CompanyHeader company={company} />

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">

          {/* Contratante */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Dados do contratante</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Nome completo do contratante</label>
                <input className={inputCls} value={form.name} onChange={set('name')} required placeholder="Nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>CPF / CNPJ</label>
                  <input className={inputCls} value={form.cpf} onChange={set('cpf', maskCpfCnpj)} placeholder="000.000.000-00" inputMode="numeric" />
                </div>
                <div>
                  <label className={labelCls}>RG</label>
                  <input className={inputCls} value={form.rg} onChange={set('rg', maskRg)} placeholder="00.000.000-0" inputMode="numeric" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Endereço completo</label>
                <input className={inputCls} value={form.address} onChange={set('address')} placeholder="Rua, número, complemento, bairro, cidade" />
              </div>
              <div>
                <label className={labelCls}>CEP</label>
                <input className={inputCls} value={form.zip_code} onChange={set('zip_code', maskCep)} placeholder="00000-000" inputMode="numeric" />
              </div>
              <div>
                <label className={labelCls}>Telefone com DDD (Whatsapp)</label>
                <input className={inputCls} value={form.phone} onChange={set('phone', maskPhone)} placeholder="(11) 99999-9999" inputMode="numeric" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={form.email} onChange={set('email')} placeholder="email@exemplo.com" />
              </div>
              <div>
                <label className={labelCls}>Como nos conheceu?</label>
                <input className={inputCls} value={form.source} onChange={set('source')} placeholder="Instagram, indicação, Google..." />
              </div>
            </div>
          </div>

          {/* Testemunha */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 mt-4">Testemunha</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Nome completo</label>
                <input className={inputCls} value={form.witness_name} onChange={set('witness_name')} placeholder="Nome da testemunha" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>CPF</label>
                  <input className={inputCls} value={form.witness_cpf} onChange={set('witness_cpf', maskCpfCnpj)} placeholder="000.000.000-00" inputMode="numeric" />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input className={inputCls} type="email" value={form.witness_email} onChange={set('witness_email')} placeholder="email@exemplo.com" />
                </div>
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 mt-2">
            {saving ? 'Salvando...' : 'Enviar dados'}
          </button>
        </form>
      </div>
    </div>
  );
}
