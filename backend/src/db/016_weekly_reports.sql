-- ═══════════════════════════════════════════════════════════════════
-- Migration 016: Weekly Intelligence Report — Phase 1
-- Sabi Intelligence Suite · Cerebre Media Africa
-- ═══════════════════════════════════════════════════════════════════
--
-- NEW TABLES:
--   weekly_reports         → one record per ISO week (the container)
--   weekly_report_entries  → one record per brand per weekly report
--   report_comments        → MD/SA comments on individual sections
--
-- DESIGN NOTES:
--   • weekly_reports is the outer envelope — keyed by week_start (Monday)
--   • weekly_report_entries is where the actual content lives (per brand)
--   • Each entry stores both the ARIA draft and the edited final copy
--     separately, so the BA can always see what ARIA wrote and compare
--   • report_comments allow the MD to comment on any section of any entry
--     without email/WhatsApp — everything stays in Sabi
--   • Pipeline section added in Phase 1 as a sixth section alongside
--     the five client report sections
--   • No changes to existing tables — purely additive
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. WEEKLY REPORTS ─────────────────────────────────────────────
-- One record per ISO week. Created automatically when any BA opens
-- the weekly report page for the first time in a given week.

CREATE TABLE IF NOT EXISTS weekly_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start   DATE NOT NULL UNIQUE,      -- Monday of the week (ISO: Mon–Sun)
  week_end     DATE NOT NULL,             -- Sunday of the week
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. WEEKLY REPORT ENTRIES ──────────────────────────────────────
-- One record per brand per weekly report.
-- Stores ARIA drafts and the BA's edited final copy side-by-side.

CREATE TABLE IF NOT EXISTS weekly_report_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id               UUID NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  brand_id                UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  brand_admin_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Section 1: Payment & Briefs
  -- Pulled from invoices/payments tables by ARIA; BA adds context
  aria_draft_payment      TEXT,           -- ARIA-generated payment table narrative
  edited_payment          TEXT,           -- BA's edited version

  -- Section 2: Achievements
  -- ARIA pulls from verified tasks this week; BA refines
  aria_draft_achievements TEXT,
  edited_achievements     TEXT,

  -- Section 3: To-dos
  -- ARIA pulls from open tasks + pending briefs; BA refines
  aria_draft_todos        TEXT,
  edited_todos            TEXT,

  -- Section 4: Goal Status
  -- ARIA pulls from brand_goals / OKR progress; BA refines
  aria_draft_goals        TEXT,
  edited_goals            TEXT,

  -- Section 5: Social & Analytics (optional — shown when social connected)
  aria_draft_social       TEXT,
  edited_social           TEXT,

  -- Section 6: New Business Pipeline (Phase 1 addition)
  -- ARIA pulls from opportunities where this BA is lead + weekly notes
  aria_draft_pipeline     TEXT,
  edited_pipeline         TEXT,

  -- Metadata
  aria_generated_at       TIMESTAMPTZ,    -- when ARIA last generated drafts
  is_submitted            BOOLEAN DEFAULT FALSE,
  submitted_at            TIMESTAMPTZ,
  brand_admin_notes       TEXT,           -- any free-form notes the BA wants to add

  -- Prevent duplicate entries per brand per week
  UNIQUE (report_id, brand_id),

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. REPORT COMMENTS ────────────────────────────────────────────
-- MD and Super Admin can leave comments on any section of any entry.
-- Brand Admin is notified and can reply before or during the meeting.

CREATE TABLE IF NOT EXISTS report_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id     UUID NOT NULL REFERENCES weekly_report_entries(id) ON DELETE CASCADE,
  section      TEXT NOT NULL CHECK (section IN (
                 'payment', 'achievements', 'todos',
                 'goals', 'social', 'pipeline', 'general'
               )),
  author_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment      TEXT NOT NULL,
  flagged      BOOLEAN DEFAULT FALSE,    -- flagged = needs discussion at meeting
  resolved     BOOLEAN DEFAULT FALSE,
  resolved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. INDEXES ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_weekly_reports_week
  ON weekly_reports(week_start DESC);

CREATE INDEX IF NOT EXISTS idx_wre_report
  ON weekly_report_entries(report_id);

CREATE INDEX IF NOT EXISTS idx_wre_brand_admin
  ON weekly_report_entries(brand_admin_id);

CREATE INDEX IF NOT EXISTS idx_wre_brand
  ON weekly_report_entries(brand_id);

CREATE INDEX IF NOT EXISTS idx_wre_submitted
  ON weekly_report_entries(is_submitted);

CREATE INDEX IF NOT EXISTS idx_report_comments_entry
  ON report_comments(entry_id);

CREATE INDEX IF NOT EXISTS idx_report_comments_author
  ON report_comments(author_id);

-- ── 5. UPDATED_AT TRIGGERS ────────────────────────────────────────

-- update_updated_at_column() should already exist from migration 015.
-- If not, it's safe to CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_weekly_reports_updated_at ON weekly_reports;
CREATE TRIGGER trg_weekly_reports_updated_at
  BEFORE UPDATE ON weekly_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_wre_updated_at ON weekly_report_entries;
CREATE TRIGGER trg_wre_updated_at
  BEFORE UPDATE ON weekly_report_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_report_comments_updated_at ON report_comments;
CREATE TRIGGER trg_report_comments_updated_at
  BEFORE UPDATE ON report_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 6. ROW LEVEL SECURITY ─────────────────────────────────────────

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_report_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_comments ENABLE ROW LEVEL SECURITY;

-- Service role bypasses all (backend uses service key)
CREATE POLICY "service_role_bypass_weekly_reports"
  ON weekly_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_wre"
  ON weekly_report_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_report_comments"
  ON report_comments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 7. HELPER VIEW — SUBMISSION STATUS ────────────────────────────
-- Makes it easy to query "how many BAs have submitted for this week"
-- Used by the MD's submission status panel.

CREATE OR REPLACE VIEW weekly_submission_status AS
SELECT
  wr.id            AS report_id,
  wr.week_start,
  wr.week_end,
  u.id             AS brand_admin_id,
  u.name           AS brand_admin_name,
  b.id             AS brand_id,
  b.name           AS brand_name,
  wre.id           AS entry_id,
  wre.is_submitted,
  wre.submitted_at,
  wre.aria_generated_at,
  CASE
    WHEN wre.id IS NULL         THEN 'not_started'
    WHEN wre.is_submitted       THEN 'submitted'
    WHEN wre.aria_generated_at IS NOT NULL THEN 'draft'
    ELSE 'not_started'
  END              AS status
FROM weekly_reports wr
CROSS JOIN (
  SELECT DISTINCT u.id, u.name
  FROM users u
  WHERE u.role IN ('brand_admin', 'admin')
) u
JOIN brand_users bu ON bu.user_id = u.id
JOIN brands b ON b.id = bu.brand_id
LEFT JOIN weekly_report_entries wre
  ON wre.report_id = wr.id
 AND wre.brand_id = b.id
 AND wre.brand_admin_id = u.id
ORDER BY u.name, b.name;

-- ═══════════════════════════════════════════════════════════════════
-- INTEGRATION CHECKLIST
-- ═══════════════════════════════════════════════════════════════════
-- 1. Run AFTER migration 015 (pipeline_phase0)
-- 2. Mount weekly-report.routes.js in server.js:
--    const weeklyReportRouter = require('./routes/weekly-report.routes');
--    app.use('/api/weekly-report', requireAuth, weeklyReportRouter);
-- 3. Add '/weekly-report' to the sidebar nav
--    (Brand Admin, Admin, MD, Super Admin only — NOT Staff or Client)
-- 4. NOTE: The ARIA generation queries tasks, invoices, briefs, brand_goals.
--    Check the table/column names in weekly-report-aria.service.js against
--    your actual schema and adjust the SQL if needed.
-- ═══════════════════════════════════════════════════════════════════
