-- ══════════════════════════════════════════════════════════════════
--  FICHA TÉCNICA — campos extras de evento
--  Aplique via Supabase SQL Editor em:
--  https://supabase.com/dashboard/project/vfrtvnzptaazhzfirflm/sql
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ceremony_time         TEXT,
  ADD COLUMN IF NOT EXISTS professional_count    INTEGER,
  ADD COLUMN IF NOT EXISTS professional_meal_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS professional_meal_type TEXT,
  ADD COLUMN IF NOT EXISTS additional_hours      NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS organizer             TEXT,
  ADD COLUMN IF NOT EXISTS decorator             TEXT,
  ADD COLUMN IF NOT EXISTS pastry_chef           TEXT,
  ADD COLUMN IF NOT EXISTS band_dj               TEXT,
  ADD COLUMN IF NOT EXISTS photo_video           TEXT,
  ADD COLUMN IF NOT EXISTS bartender             TEXT,
  ADD COLUMN IF NOT EXISTS other_professionals   TEXT,
  ADD COLUMN IF NOT EXISTS extra_attractions     TEXT,
  ADD COLUMN IF NOT EXISTS welcome_cocktail      TEXT,
  ADD COLUMN IF NOT EXISTS wine                  TEXT,
  ADD COLUMN IF NOT EXISTS whisky                TEXT,
  ADD COLUMN IF NOT EXISTS napkin_holder         TEXT,
  ADD COLUMN IF NOT EXISTS tablecloth            TEXT,
  ADD COLUMN IF NOT EXISTS rechaud               TEXT,
  ADD COLUMN IF NOT EXISTS sousplat              TEXT,
  ADD COLUMN IF NOT EXISTS sideboard             TEXT,
  ADD COLUMN IF NOT EXISTS glass_type            TEXT,
  ADD COLUMN IF NOT EXISTS bridal_suite          TEXT,
  ADD COLUMN IF NOT EXISTS kids_area             TEXT,
  ADD COLUMN IF NOT EXISTS table_count           INTEGER,
  ADD COLUMN IF NOT EXISTS guests_per_table      INTEGER,
  ADD COLUMN IF NOT EXISTS cake_table_location   TEXT,
  ADD COLUMN IF NOT EXISTS band_dj_time          TEXT,
  ADD COLUMN IF NOT EXISTS beer                  TEXT;
