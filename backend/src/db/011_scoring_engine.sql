-- ============================================================
-- Migration 007: Task Verification, Contribution Claims,
--                 Weekly Ratings, Score Engine
-- Phase 2 of the Performance & Financials Blueprint
-- Run in Supabase SQL Editor AFTER migration 006
-- ============================================================

-- ── 1. Task Verification ──────────────────────────────────────
-- Everything in this phase rests on this. Unverified tasks score nothing.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Status check constraint update: allow 'verified' as a terminal status
-- (tasks.status is VARCHAR with app-level validation, no DB CHECK to alter)

CREATE INDEX IF NOT EXISTS idx_tasks_verified ON tasks(verified_by, verified_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status_brand ON tasks(brand_id, status);

-- ── 2. Contribution Claims ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS contribution_claims (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id       UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  description    TEXT        NOT NULL,
  proof_links    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','rejected')),
  reviewed_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  review_note    TEXT,
  points_awarded SMALLINT    CHECK (points_awarded IN (5,10,15)),
  week_start     DATE        NOT NULL,  -- Monday, Africa/Lagos, of the week it counts toward
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_staff_week ON contribution_claims(staff_id, week_start);
CREATE INDEX IF NOT EXISTS idx_claims_status ON contribution_claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_brand ON contribution_claims(brand_id);

-- ── 3. Weekly Manager Ratings ───────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_ratings (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  rater_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id   UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  week_start DATE        NOT NULL,
  score      SMALLINT    NOT NULL CHECK (score BETWEEN 1 AND 5),
  note       TEXT,        -- required at app level if score <= 2
  is_creative_of_week BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rater_id, staff_id, brand_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_ratings_staff_week ON weekly_ratings(staff_id, week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_ratings_brand_week ON weekly_ratings(brand_id, week_start);

-- ── 4. Scoring Config (private weights — Super Admin only) ─────
CREATE TABLE IF NOT EXISTS scoring_config (
  id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Staff weights (must sum to 100)
  staff_satisfaction_weight   SMALLINT DEFAULT 35,
  staff_task_weight           SMALLINT DEFAULT 30,
  staff_manager_rating_weight SMALLINT DEFAULT 20,
  staff_contribution_weight   SMALLINT DEFAULT 15,
  -- Brand Admin weights (must sum to 100)
  ba_satisfaction_weight      SMALLINT DEFAULT 30,
  ba_goal_achievement_weight  SMALLINT DEFAULT 25,
  ba_team_completion_weight   SMALLINT DEFAULT 25,
  ba_revenue_weight           SMALLINT DEFAULT 20,
  -- Supporting figures
  monthly_revenue_target_per_brand DECIMAL(12,2) DEFAULT 500000,
  unverified_task_grace_days       SMALLINT DEFAULT 5,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO scoring_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── 5. Weekly Scores (computed, stored, auditable) ──────────────
CREATE TABLE IF NOT EXISTS weekly_scores (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score_type  VARCHAR(20) NOT NULL CHECK (score_type IN ('staff','brand_admin')),
  week_start  DATE        NOT NULL,
  components  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- components stores: raw inputs + computed points per category + weights used
  -- e.g. {"satisfaction":{"raw":4.2,"points":29.4,"weight":35}, "tasks":{...}, ...}
  total       DECIMAL(5,2) NOT NULL,
  excluded    BOOLEAN     DEFAULT FALSE,  -- true if staff was on leave that week
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, score_type, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_scores_user ON weekly_scores(user_id, score_type);
CREATE INDEX IF NOT EXISTS idx_weekly_scores_week ON weekly_scores(week_start);

-- ── 6. Score Disputes (simple flag-and-review queue) ────────────
CREATE TABLE IF NOT EXISTS score_disputes (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  weekly_score_id UUID     NOT NULL REFERENCES weekly_scores(id) ON DELETE CASCADE,
  raised_by    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note         TEXT        NOT NULL,
  status       VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_disputes_status ON score_disputes(status);

-- ── Permissions ───────────────────────────────────────────────
GRANT ALL PRIVILEGES ON TABLE
  contribution_claims, weekly_ratings, scoring_config, weekly_scores, score_disputes
TO postgres, anon, authenticated, service_role;

ALTER TABLE contribution_claims DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_ratings      DISABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_config      DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_scores       DISABLE ROW LEVEL SECURITY;
ALTER TABLE score_disputes      DISABLE ROW LEVEL SECURITY;

-- ── Verify ────────────────────────────────────────────────────
SELECT 'contribution_claims' AS tbl, COUNT(*) FROM contribution_claims UNION ALL
SELECT 'weekly_ratings',            COUNT(*) FROM weekly_ratings UNION ALL
SELECT 'scoring_config',            COUNT(*) FROM scoring_config UNION ALL
SELECT 'weekly_scores',             COUNT(*) FROM weekly_scores UNION ALL
SELECT 'score_disputes',            COUNT(*) FROM score_disputes;
