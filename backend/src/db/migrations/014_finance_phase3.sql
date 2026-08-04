-- ═══════════════════════════════════════════════════════════════════
-- Migration 014: Finance Module — Phase 3
-- Sabi Intelligence Suite · Cerebre Media Africa
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Expenses ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID          REFERENCES brands(id) ON DELETE SET NULL,
  category            TEXT          NOT NULL
                                    CHECK (category IN (
                                      'software','rent','contractor','ad_spend',
                                      'travel','salaries','utilities','equipment',
                                      'marketing','legal','other'
                                    )),
  description         TEXT          NOT NULL,
  amount              NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  date                DATE          NOT NULL DEFAULT CURRENT_DATE,
  receipt_url         TEXT,
  billable_to_client  BOOLEAN       DEFAULT FALSE,
  vat_inclusive       BOOLEAN       DEFAULT FALSE,
  notes               TEXT,
  recorded_by         UUID          REFERENCES users(id),
  created_at          TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_brand    ON expenses (brand_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category, date DESC);

-- ── 2. Client portal magic-link tokens ────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  token       TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '72 hours',
  used_at     TIMESTAMPTZ,
  created_by  UUID        REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpt_token ON client_portal_tokens (token) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cpt_brand ON client_portal_tokens (brand_id, created_at DESC);

-- ── 3. Client portal sessions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cps_brand ON client_portal_sessions (brand_id, expires_at DESC);

-- ── 4. RLS ────────────────────────────────────────────────────────────
ALTER TABLE expenses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exp_auth"  ON expenses               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cpt_auth"  ON client_portal_tokens   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cps_auth"  ON client_portal_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 5. VAT summary view ───────────────────────────────────────────────
-- Output VAT charged to clients on issued invoices
CREATE OR REPLACE VIEW v_vat_summary AS
SELECT
  EXTRACT(YEAR    FROM i.issued_date)::INT    AS year,
  EXTRACT(QUARTER FROM i.issued_date)::INT    AS quarter,
  EXTRACT(MONTH   FROM i.issued_date)::INT    AS month,
  i.brand_id,
  COUNT(*)                                     AS invoice_count,
  SUM(i.subtotal)                              AS net_amount,
  SUM(i.vat_amount)                            AS vat_charged,
  SUM(i.total_amount)                          AS gross_amount
FROM invoices i
WHERE i.status NOT IN ('cancelled', 'draft')
  AND i.vat_amount > 0
GROUP BY 1, 2, 3, 4;

-- ── 6. Annual revenue summary view ────────────────────────────────────
CREATE OR REPLACE VIEW v_annual_revenue AS
SELECT
  EXTRACT(YEAR FROM p.payment_date)::INT AS year,
  i.type                                  AS invoice_type,
  i.brand_id,
  b.name                                  AS brand_name,
  COUNT(DISTINCT i.id)                    AS invoice_count,
  SUM(p.amount)                           AS total_received
FROM payments p
JOIN invoices i ON i.id = p.invoice_id
JOIN brands   b ON b.id = i.brand_id
GROUP BY 1, 2, 3, 4;
