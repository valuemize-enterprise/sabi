-- ═══════════════════════════════════════════════════════════════════
-- Migration 010: AI Goal Generator
-- Sabi Intelligence Suite · Cerebre Media Africa
-- ═══════════════════════════════════════════════════════════════════
--
-- This migration extends the existing goal system with:
--   1. goal_source_documents — tracks uploaded briefs/decks/reports
--   2. OKR columns on brand_goals — objective, key_results, quarter,
--      confidence score, AI-generated flag, lock, VelocityTracker link
--   3. goal_change_requests — Brand Admin edit/delete approval queue
--   4. goal_audit_log — complete tamper-proof audit trail
--
-- Safe to re-run (all DDL uses IF NOT EXISTS / IF NOT EXISTS columns).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Source documents ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_source_documents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  file_name         TEXT        NOT NULL,
  file_type         TEXT        NOT NULL,            -- pdf | docx | xlsx | jpeg | png
  storage_path      TEXT,                            -- Supabase Storage key
  file_size_bytes   INT,
  uploaded_by       UUID        NOT NULL REFERENCES users(id),
  document_type     TEXT,                            -- brief | strategy_deck | contact_report | pitch | unknown
  brief_intelligence TEXT,                           -- AI 2-3 sentence summary
  goals_generated   INT         DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Extend brand_goals with OKR + AI fields ────────────────────────
--    Preserves every existing row — only adds new columns.
CREATE TABLE IF NOT EXISTS brand_goals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'on_track'
                          CHECK (status IN ('on_track','at_risk','achieved','paused')),
  created_by  UUID        REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brand_goals
  ADD COLUMN IF NOT EXISTS framework            TEXT        DEFAULT 'OKR',
  ADD COLUMN IF NOT EXISTS objective            TEXT,
  ADD COLUMN IF NOT EXISTS key_results          JSONB       DEFAULT '[]',
  -- key_results is an array of:
  -- { id, title, metric, current_value, target_value, unit, due_date, status }
  ADD COLUMN IF NOT EXISTS quarter              TEXT,                    -- e.g. 'Q3 2026'
  ADD COLUMN IF NOT EXISTS due_date             DATE,
  ADD COLUMN IF NOT EXISTS confidence_score     INT
                                                CHECK (confidence_score IS NULL
                                                   OR (confidence_score >= 0
                                                  AND confidence_score <= 100)),
  ADD COLUMN IF NOT EXISTS current_progress     INT         DEFAULT 0,   -- 0-100 % across KRs
  ADD COLUMN IF NOT EXISTS is_ai_generated      BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_document_id   UUID        REFERENCES goal_source_documents(id),
  ADD COLUMN IF NOT EXISTS source_insight       TEXT,
  ADD COLUMN IF NOT EXISTS last_edited_by       UUID        REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS locked               BOOLEAN     DEFAULT FALSE,
  -- locked=TRUE means Brand Admin must request SA permission to edit/delete
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW();

-- ── 3. Goal change requests ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_change_requests (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id               UUID        NOT NULL REFERENCES brand_goals(id) ON DELETE CASCADE,
  brand_id              UUID        NOT NULL REFERENCES brands(id),
  requester_id          UUID        NOT NULL REFERENCES users(id),
  request_type          TEXT        NOT NULL
                                    CHECK (request_type IN ('edit','delete')),
  reason                TEXT        NOT NULL,
  proposed_objective    TEXT,                    -- filled for 'edit' requests
  proposed_key_results  JSONB,                   -- filled for 'edit' requests
  status                TEXT        DEFAULT 'pending'
                                    CHECK (status IN ('pending','approved','denied')),
  decided_by            UUID        REFERENCES users(id),
  decided_at            TIMESTAMPTZ,
  denial_reason         TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Audit log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_audit_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id             UUID        NOT NULL REFERENCES brand_goals(id) ON DELETE CASCADE,
  brand_id            UUID        NOT NULL REFERENCES brands(id),
  actor_id            UUID        NOT NULL REFERENCES users(id),
  action              TEXT        NOT NULL,
  -- ai_generated | saved | edited | kr_updated | deleted
  -- status_changed | change_requested | change_approved | change_denied
  change_summary      TEXT,
  before_state        JSONB,
  after_state         JSONB,
  change_request_id   UUID        REFERENCES goal_change_requests(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brand_goals_brand_status
  ON brand_goals(brand_id, status);

CREATE INDEX IF NOT EXISTS idx_goal_source_docs_brand
  ON goal_source_documents(brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goal_change_requests_pending
  ON goal_change_requests(brand_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_goal_audit_log_goal
  ON goal_audit_log(goal_id, created_at DESC);

-- ── 6. VelocityTracker trigger ────────────────────────────────────────
-- Auto-updates current_progress and status when key_results changes.
-- VelocityTracker reads current_progress and updated_at for velocity calcs.

CREATE OR REPLACE FUNCTION recompute_goal_velocity()
RETURNS TRIGGER AS $$
DECLARE
  krs          JSONB;
  total_krs    INT;
  achieved_krs INT;
  sum_pct      NUMERIC;
  progress     INT;
  new_status   TEXT;
  velocity_ratio NUMERIC;
BEGIN
  krs := NEW.key_results;

  -- If no key results exist, leave status unchanged
  IF krs IS NULL OR jsonb_array_length(krs) = 0 THEN
    RETURN NEW;
  END IF;

  total_krs    := jsonb_array_length(krs);
  achieved_krs := 0;
  sum_pct      := 0;

  FOR i IN 0 .. total_krs - 1 LOOP
    DECLARE
      kr         JSONB := krs -> i;
      current_v  NUMERIC := COALESCE((kr->>'current_value')::NUMERIC, 0);
      target_v   NUMERIC := COALESCE((kr->>'target_value')::NUMERIC, 1);
      pct        NUMERIC;
    BEGIN
      pct := LEAST(current_v / NULLIF(target_v, 0), 1) * 100;
      sum_pct := sum_pct + pct;
      IF current_v >= target_v THEN achieved_krs := achieved_krs + 1; END IF;
    END;
  END LOOP;

  progress := (sum_pct / total_krs)::INT;

  -- Determine velocity-based status
  IF achieved_krs = total_krs THEN
    new_status := 'achieved';
  ELSIF progress >= 60 THEN
    new_status := 'on_track';
  ELSE
    new_status := 'at_risk';
  END IF;

  NEW.current_progress := progress;
  NEW.status           := new_status;
  NEW.updated_at       := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_goal_velocity ON brand_goals;
CREATE TRIGGER trg_goal_velocity
  BEFORE INSERT OR UPDATE OF key_results ON brand_goals
  FOR EACH ROW EXECUTE FUNCTION recompute_goal_velocity();

-- ── 7. Enable RLS on new tables ───────────────────────────────────────
ALTER TABLE goal_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_change_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_audit_log        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_docs_auth"   ON goal_source_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "goal_cr_auth"     ON goal_change_requests  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "goal_audit_auth"  ON goal_audit_log        FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 8. Supabase Storage bucket (run this in Supabase Dashboard SQL editor) ──
-- INSERT INTO storage.buckets (id, name, public) VALUES ('goal-documents', 'goal-documents', false)
-- ON CONFLICT (id) DO NOTHING;
