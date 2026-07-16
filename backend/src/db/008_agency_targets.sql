-- ============================================================
-- Migration 008: Agency-Level Yearly Targets
-- Phase 3 of the Performance & Financials Blueprint
-- Run in Supabase SQL Editor AFTER migration 007
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_targets (
  id                                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  year                              SMALLINT    NOT NULL UNIQUE,
  monthly_retainer_revenue_target   DECIMAL(14,2) DEFAULT 0,
  quarterly_project_revenue_target  DECIMAL(14,2) DEFAULT 0,
  active_brands_target              SMALLINT    DEFAULT 0,
  avg_client_satisfaction_target    DECIMAL(3,2) DEFAULT 4.0,
  goal_achievement_rate_target      SMALLINT    DEFAULT 70,  -- percentage
  staff_retention_target            SMALLINT    DEFAULT 85,  -- percentage
  set_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  set_at            TIMESTAMPTZ DEFAULT NOW(),
  midyear_reviewed_at TIMESTAMPTZ,
  midyear_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_targets_year ON agency_targets(year);

-- Staff count snapshot for retention calculation
-- (retention = active staff who were active 12 months ago / staff count 12 months ago)
-- No new table needed — computed from users.created_at + users.is_active on read.

GRANT ALL PRIVILEGES ON TABLE agency_targets TO postgres, anon, authenticated, service_role;
ALTER TABLE agency_targets DISABLE ROW LEVEL SECURITY;

-- Seed current year with defaults so the Pulse dashboard has something to compare against
INSERT INTO agency_targets (year, monthly_retainer_revenue_target, quarterly_project_revenue_target, active_brands_target)
VALUES (EXTRACT(YEAR FROM NOW())::SMALLINT, 3000000, 2000000, 15)
ON CONFLICT (year) DO NOTHING;

SELECT * FROM agency_targets;
