-- ============================================================
-- Migration 009: Add brief_id to strategies
-- Links strategies back to the client brief they were created from
-- ============================================================

ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS brief_id UUID REFERENCES client_briefs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_strategies_brief_id ON strategies(brief_id);
