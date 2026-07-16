-- ============================================================
-- Migration 006: Financials, Brief Classification, Core Functions
-- Phase 1 of the Performance & Financials Blueprint
-- Run in Supabase SQL Editor AFTER migrations 001-005
-- ============================================================

-- ── 1. Brand Financials ───────────────────────────────────────
-- One row per brand: retainer terms + documented scope
CREATE TABLE IF NOT EXISTS brand_financials (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id         UUID        NOT NULL UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
  retainer_amount  DECIMAL(12,2) DEFAULT 0,
  billing_cycle    VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','quarterly')),
  billing_day      SMALLINT    DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  currency         VARCHAR(3)  DEFAULT 'NGN',
  retainer_scope   TEXT,        -- documented BAU scope — what the retainer includes
  scope_agreed_date DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_financials_brand ON brand_financials(brand_id);

-- ── 2. Invoices ────────────────────────────────────────────────
-- Every expected and actual payment, retainer or project
CREATE TABLE IF NOT EXISTS invoices (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id     UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN ('retainer','project')),
  brief_id     UUID        REFERENCES client_briefs(id) ON DELETE SET NULL,
  strategy_id  UUID        REFERENCES strategies(id) ON DELETE SET NULL,
  amount       DECIMAL(12,2) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'expected'
    CHECK (status IN ('expected','invoiced','paid','overdue','cancelled')),
  due_date     DATE        NOT NULL,
  paid_date    DATE,
  reference    TEXT,
  created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_brand_id    ON invoices(brand_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status       ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date      ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_brief_id       ON invoices(brief_id);

-- ── 3. Brief Classification (BAU vs New Project) ──────────────
ALTER TABLE client_briefs
  ADD COLUMN IF NOT EXISTS work_type      VARCHAR(20) DEFAULT 'unclassified'
    CHECK (work_type IN ('unclassified','retainer','new_project')),
  ADD COLUMN IF NOT EXISTS classified_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classified_at  TIMESTAMPTZ;

-- ── 4. Strategy P&L (attached to non-BAU briefs) ──────────────
ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS expected_revenue DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS estimated_cost   DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS pnl_status       VARCHAR(20) DEFAULT 'not_applicable'
    CHECK (pnl_status IN ('not_applicable','pending','completed'));
  -- not_applicable = retainer work, never needs P&L
  -- pending         = new_project strategy approved, P&L not yet filled
  -- completed       = P&L filled, invoice auto-created

-- gross_margin is computed on read (expected_revenue - estimated_cost), not stored,
-- to avoid stale data if either field is edited later.

-- ── 5. Agency Settings (single row config) ────────────────────
CREATE TABLE IF NOT EXISTS agency_settings (
  id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- enforces single row
  average_hourly_rate   DECIMAL(10,2) DEFAULT 5000,  -- ₦ — used for cost auto-suggest
  updated_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO agency_settings (id, average_hourly_rate) VALUES (1, 5000)
  ON CONFLICT (id) DO NOTHING;

-- ── 6. Core Functions per Role ─────────────────────────────────
CREATE TABLE IF NOT EXISTS role_core_functions (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  role           VARCHAR(50) NOT NULL,   -- matches system role values e.g. 'copywriter'
  function_text  TEXT        NOT NULL,
  is_measurable  BOOLEAN     DEFAULT FALSE,
  sort_order     SMALLINT    DEFAULT 0,
  created_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_core_functions_role ON role_core_functions(role);

-- Per-person overrides (optional — for special arrangements)
CREATE TABLE IF NOT EXISTS staff_function_overrides (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  function_text  TEXT        NOT NULL,
  reason         TEXT,                    -- why this override exists
  created_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_function_overrides_staff ON staff_function_overrides(staff_id);

-- ── 7. Leave marking (needed for score edge case in Phase 2, ──
--     but the admin control belongs in Phase 1 alongside people-ops)
CREATE TABLE IF NOT EXISTS staff_leave (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start  DATE        NOT NULL,   -- Monday of the leave week (Africa/Lagos)
  reason      VARCHAR(30) DEFAULT 'leave' CHECK (reason IN ('leave','sick','other')),
  marked_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id, week_start)
);

-- ── Permissions ───────────────────────────────────────────────
GRANT ALL PRIVILEGES ON TABLE
  brand_financials, invoices, agency_settings,
  role_core_functions, staff_function_overrides, staff_leave
TO postgres, anon, authenticated, service_role;

ALTER TABLE brand_financials         DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE agency_settings          DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_core_functions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_function_overrides DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leave              DISABLE ROW LEVEL SECURITY;

-- ── Seed: sensible default core functions (editable after) ────
INSERT INTO role_core_functions (role, function_text, is_measurable, sort_order) VALUES
  ('account_manager',      'Respond to client briefs within 1 business day',              TRUE,  1),
  ('account_manager',      'Host a check-in call with the client at least twice monthly', FALSE, 2),
  ('social_media_manager', 'Publish a minimum of 5 posts per week per assigned brand',     TRUE,  1),
  ('social_media_manager', 'Respond to comments and DMs within 24 hours',                  FALSE, 2),
  ('copywriter',           'Deliver all copy requests within the agreed turnaround time',  TRUE,  1),
  ('graphic_designer',     'Deliver all design requests within the agreed turnaround time',TRUE,  1),
  ('graphic_designer',     'Maintain brand guideline consistency across all assets',       FALSE, 2),
  ('content_creator',      'Deliver video/content assets within the agreed turnaround',    TRUE,  1),
  ('analytics_specialist', 'Publish monthly performance report by the 5th of each month',  TRUE,  1),
  ('community_manager',    'Respond to community engagement within 24 hours',              FALSE, 1),
  ('strategist',           'Ensure every active brand has a current strategy on file',     TRUE,  1)
ON CONFLICT DO NOTHING;

-- ── Verify ────────────────────────────────────────────────────
SELECT 'brand_financials' AS tbl, COUNT(*) FROM brand_financials UNION ALL
SELECT 'invoices',                COUNT(*) FROM invoices UNION ALL
SELECT 'agency_settings',         COUNT(*) FROM agency_settings UNION ALL
SELECT 'role_core_functions',     COUNT(*) FROM role_core_functions UNION ALL
SELECT 'staff_leave',             COUNT(*) FROM staff_leave;
