-- Make client_id nullable in events (many Bubble events have no linked client)
ALTER TABLE events ALTER COLUMN client_id DROP NOT NULL;

-- Add bubble_id to track origin and enable idempotent re-runs
ALTER TABLE clients ADD COLUMN IF NOT EXISTS bubble_id text UNIQUE;
ALTER TABLE events  ADD COLUMN IF NOT EXISTS bubble_id text UNIQUE;
ALTER TABLE tastings ADD COLUMN IF NOT EXISTS bubble_id text UNIQUE;
