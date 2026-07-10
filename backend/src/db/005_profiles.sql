-- ============================================================
-- Migration 005: Profiles, Brand Identity Vault
-- Run in Supabase SQL Editor AFTER migrations 001-004
-- ============================================================

-- ── Staff profile fields ──────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url        TEXT,
  ADD COLUMN IF NOT EXISTS display_title     TEXT,          -- "Senior Strategist & Content Director"
  ADD COLUMN IF NOT EXISTS bio               TEXT,          -- Free-text professional bio
  ADD COLUMN IF NOT EXISTS skills            TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS experience_years  SMALLINT,
  ADD COLUMN IF NOT EXISTS certifications    TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS portfolio_links   JSONB   DEFAULT '[]'::jsonb,
  -- [{"url":"https://...","label":"FiberOne Campaign Case Study","platform":"behance"}]
  ADD COLUMN IF NOT EXISTS linkedin_url      TEXT,
  ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN DEFAULT TRUE;
  -- If false, profile is hidden from clients

-- ── Brand identity vault ──────────────────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS logo_url              TEXT,
  ADD COLUMN IF NOT EXISTS tagline               TEXT,
  ADD COLUMN IF NOT EXISTS mission_statement     TEXT,
  ADD COLUMN IF NOT EXISTS brand_story           TEXT,      -- Full brand history/narrative
  ADD COLUMN IF NOT EXISTS brand_archetype       VARCHAR(30),
  -- One of: ruler, creator, sage, innocent, explorer, rebel,
  --        magician, hero, lover, jester, everyman, caregiver
  ADD COLUMN IF NOT EXISTS brand_voice           JSONB DEFAULT '{}'::jsonb,
  -- {"formal_casual": 40, "serious_playful": 60, "conservative_bold": 70}
  ADD COLUMN IF NOT EXISTS target_audience       TEXT,
  ADD COLUMN IF NOT EXISTS brand_colors          JSONB DEFAULT '[]'::jsonb,
  -- [{"name":"Primary","hex":"#6d28d9","usage":"CTAs and headings"}]
  ADD COLUMN IF NOT EXISTS brand_fonts           JSONB DEFAULT '[]'::jsonb,
  -- [{"name":"Heading","font":"Sora","weight":"700"}]
  ADD COLUMN IF NOT EXISTS dos_and_donts         JSONB DEFAULT '{"dos":[],"donts":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_guidelines_url  TEXT,      -- PDF upload URL
  ADD COLUMN IF NOT EXISTS brand_assets          JSONB DEFAULT '[]'::jsonb,
  -- [{"name":"Primary Logo","url":"...","category":"logo","format":"PNG"}]
  ADD COLUMN IF NOT EXISTS social_handles        JSONB DEFAULT '{}'::jsonb;
  -- {"instagram":"@brand","twitter":"@brand","facebook":"brand"}

-- ── Client profile fields ─────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS avatar_url       TEXT,
  ADD COLUMN IF NOT EXISTS bio              TEXT,
  ADD COLUMN IF NOT EXISTS company_website  TEXT,
  ADD COLUMN IF NOT EXISTS phone            TEXT;

-- ── Permissions ───────────────────────────────────────────────
GRANT ALL ON TABLE users, brands, clients TO postgres, anon, authenticated, service_role;

-- ── Verify ────────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name IN ('avatar_url','bio','skills','display_title')
UNION ALL
SELECT column_name FROM information_schema.columns
WHERE table_name = 'brands' AND column_name IN ('logo_url','brand_story','brand_archetype','brand_colors');
