-- SpotPack Backend — Initial Schema
-- Migration: 20260716000001_initial_schema.sql
-- Creates all tables, indexes, RLS policies, and seeds initial API key

-- ─── API Keys ────────────────────────────────────────

CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash     TEXT NOT NULL UNIQUE,       -- SHA-256 hash of the raw key
  role         TEXT NOT NULL DEFAULT 'general',  -- general | maintainer
  label        TEXT NOT NULL,              -- human-friendly name
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  is_active    BOOLEAN DEFAULT true
);

-- ─── Events ───────────────────────────────────────────

CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  location    TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Schedule Items ───────────────────────────────────

CREATE TABLE schedule_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  day_date        DATE NOT NULL,
  start_time      TEXT NOT NULL,       -- "HH:MM" in 24h format
  end_time        TEXT NOT NULL,       -- "HH:MM" in 24h format
  title           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  room            TEXT DEFAULT '',
  category        TEXT DEFAULT 'other',    -- panel | meetup | workshop | fursuit_games | dance | ceremony | other
  classification  TEXT DEFAULT 'general',  -- general | +16 | +18 | +21
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_schedule_items_event ON schedule_items(event_id);
CREATE INDEX idx_schedule_items_day   ON schedule_items(day_date);

-- ─── Processing Results (audit trail) ────────────────

CREATE TABLE processing_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,           -- path in schedule-images bucket
  raw_json      JSONB NOT NULL,          -- raw MiMo V2.5 response
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── Row Level Security ───────────────────────────────

ALTER TABLE api_keys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_results  ENABLE ROW LEVEL SECURITY;

-- No public access (anon = zero access to all tables)
CREATE POLICY "deny_anon_events" ON events
  FOR ALL TO anon
  USING (false);

CREATE POLICY "deny_anon_items" ON schedule_items
  FOR ALL TO anon
  USING (false);

-- api_keys: only service_role can read (Edge Functions use this to validate keys)
CREATE POLICY "service_read_keys" ON api_keys
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY "service_all_keys" ON api_keys
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Deny all access to api_keys for anon and authenticated
CREATE POLICY "deny_anon_keys" ON api_keys
  FOR ALL TO anon
  USING (false);

CREATE POLICY "deny_auth_keys" ON api_keys
  FOR ALL TO authenticated
  USING (false);

-- service_role full access (Edge Functions use this internally)
CREATE POLICY "service_all_events" ON events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_all_items" ON schedule_items
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_all_processing" ON processing_results
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── Seed initial maintainer key ──────────────────────
-- The raw key lives in supabase secrets (SEED_MAINTAINER_KEY).
-- This INSERT is run manually with the hash pre-computed:
--
-- INSERT INTO api_keys (key_hash, role, label)
-- VALUES ('<sha256_of_SEED_MAINTAINER_KEY>', 'maintainer', 'Initial Admin Key');
--
-- Additional keys (general for frontend, etc.) are created
-- via the create-api-key Edge Function (maintainer only).
--
-- To add keys via SQL editor:
--   SELECT create_api_key('general', 'Frontend App');
-- This function is defined in a separate migration.

-- ─── Storage Bucket (run via dashboard or API) ────────
-- Bucket: schedule-images (private, 7-day TTL)
-- Access: service_role only
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('schedule-images', 'schedule-images', false);
