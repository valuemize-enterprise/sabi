-- ═══════════════════════════════════════════════════════════════
-- Migration 008 — Brand Status Log
-- Sabi Intelligence Suite · Brand Command Center (D6)
--
-- Records every Healthy/Watch/At-Risk transition per brand.
-- The brand-status-watch service compares the live rule-engine
-- result against the latest row here; a change inserts a new row
-- and (if the new status is at_risk) fires the
-- brand_status_changed email. The insert IS the gate — no
-- transition row, no email, no spam.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS brand_status_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID NOT NULL,
  status      VARCHAR(16) NOT NULL,          -- healthy | watch | at_risk
  prev_status VARCHAR(16),
  reasons     JSONB DEFAULT '[]',            -- reason chips at transition time
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brand_status_log_brand_idx
  ON brand_status_log (brand_id, changed_at DESC);

COMMENT ON TABLE brand_status_log IS
  'Command Center status transitions. Latest row per brand = current recorded status. History enables future "days at risk" analytics for the Phase 4 Client Health Score.';
