-- Coluna para guardar quais itens do checklist foram marcados como feitos
ALTER TABLE public.client_portal_access
  ADD COLUMN IF NOT EXISTS checklist_done integer[] DEFAULT '{}';
