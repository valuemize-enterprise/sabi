-- ============================================================
-- Migration 004: Major Platform Features
-- Run in Supabase SQL Editor AFTER migrations 001-003
-- ============================================================

-- ── 1. Multiple roles per staff per brand ────────────────────
-- Replace single role_on_brand with an array of roles
ALTER TABLE staff_brand_assignments
  ADD COLUMN IF NOT EXISTS roles_on_brand  TEXT[] NOT NULL DEFAULT ARRAY['contributor'],
  ADD COLUMN IF NOT EXISTS primary_role    TEXT   NOT NULL DEFAULT 'contributor';

-- Migrate existing data
UPDATE staff_brand_assignments
  SET roles_on_brand = ARRAY[role_on_brand],
      primary_role   = role_on_brand
  WHERE array_length(roles_on_brand, 1) = 0
     OR roles_on_brand = ARRAY['contributor'];

-- Keep role_on_brand for backward compat (reads primary_role)
-- We'll phase it out gradually

-- ── 2. Client Briefs ─────────────────────────────────────────
-- Clients submit briefs from their portal
CREATE TABLE IF NOT EXISTS client_briefs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand_id     UUID        NOT NULL REFERENCES brands(id)  ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT        NOT NULL,
  brief_type   VARCHAR(50) NOT NULL DEFAULT 'general'
    CHECK (brief_type IN ('campaign','content','design','strategy','social_media','ads','event','general','other')),
  attachments  JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- [{url, name, type}]
  status       VARCHAR(30) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','acknowledged','in_review','accepted','rejected','completed')),
  priority     VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  deadline     DATE,
  admin_notes  TEXT,
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefs_brand_id   ON client_briefs(brand_id);
CREATE INDEX IF NOT EXISTS idx_briefs_client_id  ON client_briefs(client_id);
CREATE INDEX IF NOT EXISTS idx_briefs_status     ON client_briefs(status);
CREATE INDEX IF NOT EXISTS idx_briefs_created_at ON client_briefs(created_at DESC);

-- ── 3. Enhanced Tasks ────────────────────────────────────────
-- Add missing columns to existing tasks table
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assignee_id    UUID    REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority       VARCHAR(20) DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  ADD COLUMN IF NOT EXISTS description    TEXT,
  ADD COLUMN IF NOT EXISTS attachments    JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS proof_links    JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS strategy_id    UUID    REFERENCES strategies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brief_id       UUID    REFERENCES client_briefs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,1),
  ADD COLUMN IF NOT EXISTS actual_hours   DECIMAL(5,1),
  ADD COLUMN IF NOT EXISTS tags           TEXT[],
  ADD COLUMN IF NOT EXISTS created_by     UUID    REFERENCES users(id) ON DELETE SET NULL;

-- Task comments for PM collaboration
CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id    UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);

-- ── 4. Social Media Reports ───────────────────────────────────
-- Account managers upload platform reports, AI analyses them
CREATE TABLE IF NOT EXISTS social_reports (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  uploaded_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  platform        VARCHAR(50) NOT NULL
    CHECK (platform IN ('instagram','facebook','twitter_x','tiktok','linkedin','youtube','google_analytics','meta_ads','google_ads','whatsapp','threads','other')),
  report_period   VARCHAR(30),    -- e.g. 'June 2026', 'Q2 2026'
  report_date     DATE,
  file_url        TEXT,           -- URL to uploaded PDF/image in storage
  file_name       TEXT,
  file_type       VARCHAR(20),    -- 'pdf', 'image', 'csv'
  raw_data        JSONB DEFAULT '{}'::jsonb,  -- extracted data points
  ai_summary      TEXT,           -- ARIA's generated narrative
  ai_metrics      JSONB DEFAULT '{}'::jsonb,  -- structured metrics from AI
  ai_generated_at TIMESTAMPTZ,
  published_to_client BOOLEAN DEFAULT FALSE,
  status          VARCHAR(20) DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','analysing','analysed','published')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_reports_brand_id  ON social_reports(brand_id);
CREATE INDEX IF NOT EXISTS idx_social_reports_platform  ON social_reports(platform);

-- ── 5. Invitation System ──────────────────────────────────────
-- Proper invite-based onboarding (replaces temp passwords sent by email)
CREATE TABLE IF NOT EXISTS invitations (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email        TEXT        NOT NULL,
  invite_type  VARCHAR(20) NOT NULL CHECK (invite_type IN ('staff','client')),
  role         TEXT,               -- system role for staff
  brand_id     UUID REFERENCES brands(id) ON DELETE CASCADE,
  token        TEXT        NOT NULL UNIQUE,
  created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at  TIMESTAMPTZ,
  metadata     JSONB DEFAULT '{}'::jsonb,  -- extra info: role_on_brand, job_title, etc.
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token   ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email   ON invitations(email);

-- ── 6. Client Strategy Reviews ───────────────────────────────
ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS sent_to_client_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_feedback    TEXT,
  ADD COLUMN IF NOT EXISTS client_status      VARCHAR(20) DEFAULT 'not_sent'
    CHECK (client_status IN ('not_sent','sent','approved','needs_revision','rejected'));

-- ── Permissions ───────────────────────────────────────────────
GRANT ALL PRIVILEGES ON TABLE
  client_briefs, task_comments, social_reports, invitations
TO postgres, anon, authenticated, service_role;

ALTER TABLE client_briefs  DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments  DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE invitations    DISABLE ROW LEVEL SECURITY;

-- ── Verify ────────────────────────────────────────────────────
SELECT 'client_briefs' AS tbl, COUNT(*) FROM client_briefs UNION ALL
SELECT 'task_comments',        COUNT(*) FROM task_comments  UNION ALL
SELECT 'social_reports',       COUNT(*) FROM social_reports UNION ALL
SELECT 'invitations',          COUNT(*) FROM invitations;
