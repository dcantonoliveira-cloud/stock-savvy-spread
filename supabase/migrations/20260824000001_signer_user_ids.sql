-- Link each ZapSign signer slot to a system user
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS signer_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS witness_1_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
