import { supabase } from '@/integrations/supabase/client';

export interface CompanyData {
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
  witness_1_name: string | null;
  witness_1_cpf: string | null;
  witness_1_email: string | null;
  signer_name: string | null;
  signer_email: string | null;
}

let cache: CompanyData | null = null;
let pending: Promise<CompanyData | null> | null = null;

export async function getCompany(): Promise<CompanyData | null> {
  if (cache) return cache;
  if (pending) return pending;
  pending = supabase
    .from('companies')
    .select('id,name,logo_base64,razao_social,cnpj,banco,agencia,conta,endereco,telefone,website,witness_1_name,witness_1_cpf,witness_1_email,signer_name,signer_email')
    .limit(1)
    .single()
    .then(({ data }) => {
      cache = data as CompanyData | null;
      pending = null;
      return cache;
    });
  return pending;
}

export function invalidateCompanyCache() {
  cache = null;
  pending = null;
}
