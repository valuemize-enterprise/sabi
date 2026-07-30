-- ═══════════════════════════════════════════════════════════════════
-- Migration 013: Finance Module — Phase 2
-- Sabi Intelligence Suite · Cerebre Media Africa
-- ═══════════════════════════════════════════════════════════════════
--
-- Tables:
--   finance_targets          → annual/quarterly revenue targets
--   brand_payment_risk       → ARIA-computed payment risk scores
--   scheduled_invoice_log    → audit trail for auto-generated invoices
--
-- Extensions:
--   brands → retainer_billing_day (which day of month retainer falls)
--
-- Views:
--   v_invoice_aging          → aging buckets per brand (live computed)
--   v_revenue_actuals        → MTD / QTD / YTD actuals from payments
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Revenue targets ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_targets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  year          INT         NOT NULL,
  quarter       INT         CHECK (quarter BETWEEN 1 AND 4),
  -- quarter = NULL means the full-year target
  target_type   TEXT        NOT NULL DEFAULT 'total'
                            CHECK (target_type IN ('retainer','project','total')),
  target_amount NUMERIC(15,2) NOT NULL,
  currency      TEXT        NOT NULL DEFAULT 'NGN',
  notes         TEXT,
  created_by    UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (year, quarter, target_type)
);

-- Seed Cerebre's stated targets from the company confession:
-- 2026: ₦5 Billion total
-- 2027: ₦10.6 Billion total (₦6.6B retainer + ₦4B project)
INSERT INTO finance_targets (year, quarter, target_type, target_amount, notes)
VALUES
  (2026, NULL, 'retainer', 3000000000, 'Annual retainer target 2026 — ₦250M/month × 12'),
  (2026, NULL, 'project',  2000000000, 'Annual project target 2026 — ₦500M/quarter × 4'),
  (2026, NULL, 'total',    5000000000, '2026 Collective target — from company declaration'),
  (2026,    1, 'total',    1250000000, 'Q1 2026 implied quarterly target'),
  (2026,    2, 'total',    1250000000, 'Q2 2026 implied quarterly target'),
  (2026,    3, 'total',    1250000000, 'Q3 2026 implied quarterly target'),
  (2026,    4, 'total',    1250000000, 'Q4 2026 implied quarterly target'),
  (2027, NULL, 'retainer', 6600000000, '2027 Annual retainer target — ₦550M/month × 12'),
  (2027, NULL, 'project',  4000000000, '2027 Annual project target — ₦1B/quarter × 4'),
  (2027, NULL, 'total',   10600000000, '2027 Collective target — 112% growth from 2026')
ON CONFLICT (year, quarter, target_type) DO NOTHING;

-- ── 2. Payment risk scores (ARIA-computed) ────────────────────────────
CREATE TABLE IF NOT EXISTS brand_payment_risk (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  risk_level       TEXT        NOT NULL DEFAULT 'unknown'
                               CHECK (risk_level IN ('low','medium','high','unknown')),
  risk_score       INT         CHECK (risk_score BETWEEN 0 AND 100),
  avg_days_to_pay  NUMERIC(6,1),   -- average days from due_date to paid_date
  times_on_time    INT         DEFAULT 0,
  times_late       INT         DEFAULT 0,
  largest_delay    INT,            -- worst single invoice (days late)
  total_paid       NUMERIC(15,2),
  aria_summary     TEXT,           -- 2-sentence ARIA narrative
  computed_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id)
);

-- ── 3. Scheduled invoice log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_invoice_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     UUID        NOT NULL REFERENCES brands(id),
  invoice_id   UUID        REFERENCES invoices(id),
  trigger_type TEXT        NOT NULL CHECK (trigger_type IN ('retainer_schedule','brief_completion','manual')),
  status       TEXT        NOT NULL CHECK (status IN ('success','skipped','error')),
  skip_reason  TEXT,
  error_msg    TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sil_brand ON scheduled_invoice_log (brand_id, triggered_at DESC);

-- ── 4. Extend brands: retainer billing day ────────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS retainer_billing_day INT DEFAULT 1
    CHECK (retainer_billing_day BETWEEN 1 AND 28);
  -- Day of month when retainer invoice is auto-generated (max 28 to handle Feb)

-- ── 5. Aging report VIEW ──────────────────────────────────────────────
-- Shows outstanding amounts grouped by aging bucket per brand.
-- Overdue is computed live from due_date vs NOW().
CREATE OR REPLACE VIEW v_invoice_aging AS
SELECT
  i.brand_id,
  b.name                                                AS brand_name,
  -- Current: due in future
  COALESCE(SUM(CASE WHEN i.due_date >= CURRENT_DATE THEN i.total_amount - i.amount_paid END), 0)      AS current_outstanding,
  -- 0-7 days overdue
  COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE AND CURRENT_DATE - i.due_date BETWEEN 1 AND 7
                    THEN i.total_amount - i.amount_paid END), 0)                                       AS overdue_0_7,
  -- 8-30 days overdue
  COALESCE(SUM(CASE WHEN CURRENT_DATE - i.due_date BETWEEN 8 AND 30
                    THEN i.total_amount - i.amount_paid END), 0)                                       AS overdue_8_30,
  -- 31-60 days overdue
  COALESCE(SUM(CASE WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND 60
                    THEN i.total_amount - i.amount_paid END), 0)                                       AS overdue_31_60,
  -- 60+ days overdue
  COALESCE(SUM(CASE WHEN CURRENT_DATE - i.due_date > 60
                    THEN i.total_amount - i.amount_paid END), 0)                                       AS overdue_60_plus,
  -- Total outstanding
  COALESCE(SUM(i.total_amount - i.amount_paid), 0)                                                    AS total_outstanding,
  COUNT(*) FILTER (WHERE i.status NOT IN ('paid','cancelled'))                                         AS open_invoice_count
FROM invoices i
JOIN brands b ON b.id = i.brand_id
WHERE i.status NOT IN ('paid','cancelled','draft')
GROUP BY i.brand_id, b.name;

-- ── 6. Revenue actuals VIEW ───────────────────────────────────────────
-- Computes MTD / QTD / YTD actual revenue from the payments table.
CREATE OR REPLACE VIEW v_revenue_actuals AS
SELECT
  EXTRACT(YEAR FROM p.payment_date)::INT    AS year,
  EXTRACT(QUARTER FROM p.payment_date)::INT AS quarter,
  EXTRACT(MONTH FROM p.payment_date)::INT   AS month,
  i.type                                    AS invoice_type,
  SUM(p.amount)                             AS amount
FROM payments p
JOIN invoices i ON i.id = p.invoice_id
GROUP BY
  EXTRACT(YEAR FROM p.payment_date),
  EXTRACT(QUARTER FROM p.payment_date),
  EXTRACT(MONTH FROM p.payment_date),
  i.type;

-- ── 7. RLS on new tables ──────────────────────────────────────────────
ALTER TABLE finance_targets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_payment_risk  ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_invoice_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ft_auth"   ON finance_targets      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bpr_auth"  ON brand_payment_risk   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sil_auth"  ON scheduled_invoice_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
