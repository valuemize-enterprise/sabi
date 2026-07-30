-- ═══════════════════════════════════════════════════════════════════
-- Migration 015: New Business Pipeline — Phase 0
-- Sabi Intelligence Suite · Cerebre Media Africa
-- ═══════════════════════════════════════════════════════════════════
--
-- NEW TABLES:
--   opportunities            → one record per deal (not per company)
--   opportunity_weekly_notes → narrative notes per opportunity per week
--   opportunity_stage_history→ audit trail of every stage change
--
-- DESIGN NOTES:
--   • opportunities is SEPARATE from brands — mixing prospects with
--     active clients would contaminate task, score, and invoice queries
--   • A company can have multiple opportunities (FiberOne pattern)
--   • stage_changed_at drives staleness tracking in ARIA
--   • converted_brand_id wires up to Phase 3 Won→Brand conversion
--   • No changes to existing tables — this is purely additive
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. OPPORTUNITIES ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS opportunities (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core identification
  company_name         TEXT NOT NULL,
  deal_title           TEXT NOT NULL,
  description          TEXT,                        -- what they asked for

  -- Classification
  service_types        TEXT[] DEFAULT '{}',         -- ['digital','pr','strategy','activation','experiential']
  source               TEXT CHECK (source IN (
                         'inbound', 'outreach', 'rfp',
                         'referral', 'existing_relationship'
                       )),

  -- Pipeline stage
  stage                TEXT NOT NULL DEFAULT 'identified'
                         CHECK (stage IN (
                           'identified',      -- 1: We know it exists
                           'in_progress',     -- 2: Pitch work underway internally (WIP)
                           'proposal_sent',   -- 3: Deck/pitch shared with client (Awaiting Feedback)
                           'under_review',    -- 4: Client acknowledged, internal discussion their side
                           'negotiating',     -- 5: SLA/NDA/scope being finalised
                           'won',             -- 6: Deal closed → triggers Brand conversion in Phase 3
                           'lost_paused'      -- 7: Didn't close or indefinitely paused
                         )),
  stage_changed_at     TIMESTAMPTZ DEFAULT NOW(),   -- when current stage was entered (drives staleness)

  -- Commercial data
  estimated_value      NUMERIC(15, 2),              -- ₦ value of the deal
  date_briefed         DATE,                        -- when Cerebre first received the brief
  client_deadline      DATE,                        -- client's stated deadline
  agency_deadline      DATE,                        -- internal deadline (pitch, response, etc.)

  -- Accountability
  lead_ba_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  accountable_team_text TEXT,                       -- simple text field, e.g. "Ada, Emeka, Tunde"

  -- Latest narrative (updated each week)
  notes                TEXT,

  -- Lost / Won metadata
  lost_reason          TEXT CHECK (lost_reason IN (
                         'budget_constraints',
                         'went_with_competitor',
                         'scope_too_broad',
                         'timing_not_right',
                         'no_budget_at_this_time',
                         'other'
                       )),
  lost_notes           TEXT,                        -- free text, especially for 'other'
  converted_brand_id   UUID REFERENCES brands(id) ON DELETE SET NULL,  -- Phase 3: set on Won

  -- Housekeeping
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. OPPORTUNITY WEEKLY NOTES ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS opportunity_weekly_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id   UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  week_start       DATE NOT NULL,                   -- Monday of the week this note covers
  notes            TEXT,                            -- what the BA wrote (edited)
  aria_draft       TEXT,                            -- ARIA's auto-generated first attempt
  added_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  -- One note entry per opportunity per week
  UNIQUE (opportunity_id, week_start)
);

-- ── 3. OPPORTUNITY STAGE HISTORY ─────────────────────────────────────
-- Every stage transition is logged here for analytics + audit trail

CREATE TABLE IF NOT EXISTS opportunity_stage_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id   UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  from_stage       TEXT,                            -- NULL on first log
  to_stage         TEXT NOT NULL,
  changed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at       TIMESTAMPTZ DEFAULT NOW(),
  change_notes     TEXT                             -- optional reason for the move
);

-- ── 4. INDEXES ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_opportunities_stage
  ON opportunities(stage);

CREATE INDEX IF NOT EXISTS idx_opportunities_lead_ba
  ON opportunities(lead_ba_id);

CREATE INDEX IF NOT EXISTS idx_opportunities_stage_changed
  ON opportunities(stage_changed_at);

CREATE INDEX IF NOT EXISTS idx_opportunities_created
  ON opportunities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opp_weekly_notes_opp
  ON opportunity_weekly_notes(opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opp_weekly_notes_week
  ON opportunity_weekly_notes(week_start DESC);

CREATE INDEX IF NOT EXISTS idx_opp_stage_history_opp
  ON opportunity_stage_history(opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opp_stage_history_changed
  ON opportunity_stage_history(changed_at DESC);

-- ── 5. UPDATED_AT TRIGGERS ───────────────────────────────────────────

-- Reuse existing function if it already exists in Supabase from prior migrations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_opportunities_updated_at ON opportunities;
CREATE TRIGGER trg_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_opp_weekly_notes_updated_at ON opportunity_weekly_notes;
CREATE TRIGGER trg_opp_weekly_notes_updated_at
  BEFORE UPDATE ON opportunity_weekly_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 6. ROW LEVEL SECURITY ────────────────────────────────────────────
-- Staff cannot see pipeline. Brand Admins see only their opportunities.
-- Admin / MD / Super Admin see all.

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_weekly_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_stage_history ENABLE ROW LEVEL SECURITY;

-- Bypass RLS for service role (backend uses service key)
CREATE POLICY "service_role_bypass_opportunities"
  ON opportunities FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_opp_notes"
  ON opportunity_weekly_notes FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_bypass_opp_history"
  ON opportunity_stage_history FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── 7. SEED DATA (DEMO) ──────────────────────────────────────────────
-- Remove this section before production deployment.
-- Shows the existing spreadsheet entries from the blueprint for demo purposes.

/*
INSERT INTO opportunities (
  company_name, deal_title, service_types, stage,
  estimated_value, source, notes, stage_changed_at
) VALUES
  ('FiberOne', 'Digital Strategy Campaign', ARRAY['digital'], 'in_progress',
   NULL, 'outreach', 'Active pitch work underway. Deck in final review.', NOW() - INTERVAL '5 days'),
  ('FiberOne', 'Project Giga', ARRAY['digital', 'strategy'], 'proposal_sent',
   NULL, 'existing_relationship', 'Deck shared. Awaiting client feedback.', NOW() - INTERVAL '10 days'),
  ('BuyOps', 'Digital Retainer', ARRAY['digital'], 'negotiating',
   NULL, 'inbound', 'NDA under review by their legal team.', NOW() - INTERVAL '7 days'),
  ('Sentinel', 'PR & Digital', ARRAY['pr', 'digital'], 'negotiating',
   NULL, 'outreach', 'Finalising SLA terms. Expected sign by month end.', NOW() - INTERVAL '3 days'),
  ('FSDH Merchant Bank', 'Social Media Management', ARRAY['digital'], 'negotiating',
   NULL, 'rfp', 'Back-and-forth on SLA terms. Two rounds of revisions.', NOW() - INTERVAL '14 days'),
  ('Stanbic IBTC', 'Content & Digital Strategy', ARRAY['digital', 'strategy'], 'negotiating',
   4500000, 'rfp', 'Onboarding forms sent to Procurement. Effectively won — awaiting paperwork.', NOW() - INTERVAL '2 days'),
  ('Finwerd', 'Digital Marketing Retainer', ARRAY['digital'], 'in_progress',
   3000000, 'existing_relationship', '₦3M payment expected. Work ongoing but engagement not formally closed.', NOW() - INTERVAL '18 days');
*/

-- ═══════════════════════════════════════════════════════════════════
-- INTEGRATION CHECKLIST
-- ═══════════════════════════════════════════════════════════════════
-- 1. Run this in Supabase SQL Editor AFTER migrations 001-014
-- 2. Uncomment the seed data block above for demo purposes only
-- 3. Mount pipeline.routes.js in server.js:
--    const pipelineRouter = require('./routes/pipeline.routes');
--    app.use('/api/pipeline', requireAuth, pipelineRouter);
-- 4. Add '/pipeline' to the sidebar nav (MD, Admin, Brand Admin roles only)
-- ═══════════════════════════════════════════════════════════════════
