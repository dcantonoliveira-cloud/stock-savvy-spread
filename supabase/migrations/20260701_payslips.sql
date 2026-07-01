-- ============================================================
-- Holerites / Assinatura Eletrônica
-- ============================================================

-- Status enum
CREATE TYPE payslip_status AS ENUM ('draft', 'published', 'signed');
CREATE TYPE signature_method AS ENUM ('drawn', 'typed');
CREATE TYPE audit_action AS ENUM (
  'payslip_created', 'payslip_published', 'payslip_viewed',
  'payslip_downloaded', 'signature_started', 'signature_completed',
  'alteration_attempt', 'new_version_created'
);

-- ── payslips ────────────────────────────────────────────────
CREATE TABLE public.payslips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reference_month DATE NOT NULL,            -- sempre dia 01 do mês
  title           TEXT NOT NULL,
  status          payslip_status NOT NULL DEFAULT 'draft',
  current_version INT NOT NULL DEFAULT 1,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, employee_id, reference_month)
);
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors manage payslips"
  ON public.payslips FOR ALL TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
         AND public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Employees view own payslips"
  ON public.payslips FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- ── payslip_versions ────────────────────────────────────────
CREATE TABLE public.payslip_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id     UUID NOT NULL REFERENCES public.payslips(id) ON DELETE RESTRICT,
  version_number INT NOT NULL,
  storage_path   TEXT NOT NULL,
  file_size      BIGINT,
  sha256_hash    TEXT NOT NULL,
  uploaded_by    UUID NOT NULL REFERENCES auth.users(id),
  is_current     BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payslip_id, version_number)
);
ALTER TABLE public.payslip_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors manage versions"
  ON public.payslip_versions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payslips p
    WHERE p.id = payslip_id
      AND p.company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
      AND public.has_role(auth.uid(), 'supervisor')
  ));

CREATE POLICY "Employees view own versions"
  ON public.payslip_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payslips p
    WHERE p.id = payslip_id AND p.employee_id = auth.uid()
  ));

-- ── electronic_signatures ───────────────────────────────────
CREATE TABLE public.electronic_signatures (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id          UUID NOT NULL REFERENCES public.payslips(id) ON DELETE RESTRICT,
  payslip_version_id  UUID NOT NULL REFERENCES public.payslip_versions(id) ON DELETE RESTRICT,
  employee_id         UUID NOT NULL REFERENCES auth.users(id),
  company_id          UUID NOT NULL REFERENCES public.companies(id),
  employee_name       TEXT NOT NULL,
  declaration_text    TEXT NOT NULL,

  -- timing
  signed_at_utc       TIMESTAMPTZ NOT NULL DEFAULT now(),
  timezone            TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  signed_at_local     TEXT NOT NULL,

  -- device / network
  ip_address          TEXT NOT NULL,
  user_agent          TEXT NOT NULL,
  browser             TEXT NOT NULL,
  os                  TEXT NOT NULL,
  device_type         TEXT NOT NULL DEFAULT 'desktop',

  -- session
  auth_method         TEXT NOT NULL DEFAULT 'email/password',
  session_id          TEXT,

  -- document integrity
  document_hash       TEXT NOT NULL,     -- SHA-256 do PDF original
  signature_hash      TEXT NOT NULL,     -- SHA-256 do registro completo
  document_version    INT NOT NULL,

  -- signature artifact
  sig_method          signature_method NOT NULL,
  sig_data            TEXT NOT NULL,     -- base64 do desenho ou nome digitado
  signed_pdf_path     TEXT,              -- caminho do PDF com página de auditoria

  status              TEXT NOT NULL DEFAULT 'signed',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.electronic_signatures ENABLE ROW LEVEL SECURITY;

-- Nenhum cliente insere diretamente — apenas via service role (Edge Function)
CREATE POLICY "Supervisors view signatures"
  ON public.electronic_signatures FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
         AND public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Employees view own signatures"
  ON public.electronic_signatures FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- ── document_hashes ─────────────────────────────────────────
CREATE TABLE public.document_hashes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id      UUID NOT NULL REFERENCES public.payslips(id) ON DELETE RESTRICT,
  version_id      UUID NOT NULL REFERENCES public.payslip_versions(id) ON DELETE RESTRICT,
  sha256_hash     TEXT NOT NULL,
  verified_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(version_id)
);
ALTER TABLE public.document_hashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view hashes"
  ON public.document_hashes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payslips p
    JOIN public.profiles pr ON pr.company_id = p.company_id
    WHERE p.id = payslip_id AND pr.user_id = auth.uid()
  ));

-- ── payslip_audit_logs ──────────────────────────────────────
CREATE TABLE public.payslip_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id  UUID REFERENCES public.payslips(id) ON DELETE SET NULL,
  company_id  UUID NOT NULL REFERENCES public.companies(id),
  user_id     UUID REFERENCES auth.users(id),
  action      audit_action NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payslip_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors view audit logs"
  ON public.payslip_audit_logs FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
         AND public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Employees view own audit logs"
  ON public.payslip_audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users insert own audit logs"
  ON public.payslip_audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ── Índices ─────────────────────────────────────────────────
CREATE INDEX idx_payslips_employee   ON public.payslips(employee_id);
CREATE INDEX idx_payslips_company    ON public.payslips(company_id);
CREATE INDEX idx_payslips_status     ON public.payslips(status);
CREATE INDEX idx_payslips_month      ON public.payslips(reference_month);
CREATE INDEX idx_sigs_payslip        ON public.electronic_signatures(payslip_id);
CREATE INDEX idx_sigs_employee       ON public.electronic_signatures(employee_id);
CREATE INDEX idx_audit_payslip       ON public.payslip_audit_logs(payslip_id);
CREATE INDEX idx_audit_company       ON public.payslip_audit_logs(company_id);

-- ── updated_at trigger ──────────────────────────────────────
CREATE TRIGGER update_payslips_updated_at
  BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Storage bucket ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('payslips', 'payslips', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Supervisors upload payslips"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payslips'
    AND public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Employees and supervisors read payslips"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payslips');

CREATE POLICY "Service role manages payslips storage"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'payslips');
