-- ============================================================
-- Expansão do sistema de permissões
-- ============================================================

-- Adiciona colunas que já existem em outros lugares
ALTER TABLE public.employee_permissions
  ADD COLUMN IF NOT EXISTS access_stock       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_materials   BOOLEAN NOT NULL DEFAULT false,
  -- Novos módulos
  ADD COLUMN IF NOT EXISTS access_comercial   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_financeiro  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_estoque     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_cadastros   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_estatisticas BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_administracao BOOLEAN NOT NULL DEFAULT false,
  -- Flag ADM: pode gerenciar permissões de outros usuários
  ADD COLUMN IF NOT EXISTS is_admin           BOOLEAN NOT NULL DEFAULT false;

-- RLS: supervisors can manage permissions of employees in their company
-- (existing policy may already exist — use CREATE POLICY IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employee_permissions'
      AND policyname = 'Admins manage all permissions'
  ) THEN
    CREATE POLICY "Admins manage all permissions"
      ON public.employee_permissions FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.employee_permissions ep
          WHERE ep.user_id = auth.uid() AND ep.is_admin = true
        )
      );
  END IF;
END $$;

-- Garante que supervisores sempre vejam suas próprias permissões
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employee_permissions'
      AND policyname = 'Users view own permissions'
  ) THEN
    CREATE POLICY "Users view own permissions"
      ON public.employee_permissions FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
