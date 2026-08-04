-- ═══════════════════════════════════════════════════════════════════
-- Migration 011: Platform Connections + Analytics
-- Sabi Intelligence Suite · Cerebre Media Africa
-- ═══════════════════════════════════════════════════════════════════
--
-- Tables:
--   brand_platform_connections  → OAuth tokens per brand per platform
--   platform_analytics          → daily metric snapshots (ClarityScore feed)
--   platform_sync_log           → audit trail of every sync attempt
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Platform connections (stores encrypted OAuth tokens) ──────────
CREATE TABLE IF NOT EXISTS brand_platform_connections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform        TEXT        NOT NULL
                              CHECK (platform IN (
                                'instagram', 'facebook', 'google_analytics',
                                'tiktok', 'linkedin', 'twitter', 'youtube'
                              )),
  account_id      TEXT        NOT NULL,   -- Meta page ID or IG business account ID
  account_name    TEXT,                   -- Human-readable: "First Bank Nigeria"
  account_picture TEXT,                   -- Profile picture URL
  access_token    TEXT        NOT NULL,   -- AES-256-GCM encrypted at rest
  token_expiry    TIMESTAMPTZ,            -- Long-lived tokens expire after ~60 days
  scopes          TEXT[]      DEFAULT '{}',
  metadata        JSONB       DEFAULT '{}',
  -- metadata stores platform-specific extras:
  -- instagram: { ig_user_id, page_id, page_name }
  -- facebook:  { page_id, page_name, category }
  is_active       BOOLEAN     DEFAULT TRUE,
  connected_by    UUID        REFERENCES users(id),
  connected_at    TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at  TIMESTAMPTZ,
  sync_error      TEXT,                   -- Last sync error message if any
  UNIQUE (brand_id, platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_bpc_brand    ON brand_platform_connections (brand_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bpc_expiry   ON brand_platform_connections (token_expiry) WHERE is_active = TRUE;

-- ── 2. Daily analytics snapshots ────────────────────────────────────
-- One row per brand per platform per day.
-- metrics JSONB shape per platform:
--
--   instagram: {
--     followers, impressions, reach, profile_views,
--     engagement_rate, website_clicks, posts_count
--   }
--   facebook: {
--     page_fans, page_impressions, page_reach,
--     page_engaged_users, page_views_total
--   }
--
CREATE TABLE IF NOT EXISTS platform_analytics (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  connection_id   UUID        REFERENCES brand_platform_connections(id) ON DELETE SET NULL,
  platform        TEXT        NOT NULL,
  metric_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  metrics         JSONB       NOT NULL DEFAULT '{}',
  raw_response    JSONB,                  -- Optional: store raw API response for debugging
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, platform, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_pa_brand_date
  ON platform_analytics (brand_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_pa_platform
  ON platform_analytics (platform, metric_date DESC);

-- ── 3. Sync audit log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_sync_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  connection_id   UUID        REFERENCES brand_platform_connections(id) ON DELETE SET NULL,
  platform        TEXT        NOT NULL,
  status          TEXT        NOT NULL CHECK (status IN ('success', 'error', 'token_expired', 'rate_limited')),
  metrics_count   INT         DEFAULT 0,
  error_message   TEXT,
  duration_ms     INT,
  triggered_by    TEXT        DEFAULT 'scheduled', -- 'scheduled' | 'manual' | 'post_connect'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psl_brand ON platform_sync_log (brand_id, created_at DESC);

-- ── 4. Enable RLS ────────────────────────────────────────────────────
ALTER TABLE brand_platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_analytics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_sync_log          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bpc_auth" ON brand_platform_connections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pa_auth"  ON platform_analytics         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "psl_auth" ON platform_sync_log          FOR ALL TO authenticated USING (true) WITH CHECK (true);
