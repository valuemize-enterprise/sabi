-- ═══════════════════════════════════════════════════════════════════
-- Migration 012: Finance Module — Phase 1 (Core Loop)
-- Sabi Intelligence Suite · Cerebre Media Africa
-- ═══════════════════════════════════════════════════════════════════
--
-- Tables:
--   invoices            → client invoices (retainer, project, adhoc)
--   invoice_line_items  → line items per invoice
--   payments            → payment records linked to invoices
--
-- Extensions:
--   brands              → payment_terms, billing_contact_name/email
--
-- After this migration:
--   GET /api/finance/brands/:brandId/summary returns live data for the
--   Command Center's financial dial (overdue_amount, invoiced_mtd etc.)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Extend brands with billing fields ─────────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS payment_terms         TEXT    DEFAULT 'net_30',
  ADD COLUMN IF NOT EXISTS billing_contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS billing_contact_email TEXT;

-- ── 2. Invoices ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  invoice_number  TEXT        NOT NULL UNIQUE,       -- INV-2026-0001
  type            TEXT        NOT NULL DEFAULT 'retainer'
                              CHECK (type IN ('retainer','project','adhoc')),
  status          TEXT        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','sent','partial','paid','overdue','cancelled')),
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_rate        NUMERIC(5,4)  NOT NULL DEFAULT 0,  -- 0.075 = 7.5%
  vat_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT        NOT NULL DEFAULT 'NGN',
  issued_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE        NOT NULL,
  paid_date       DATE,
  payment_terms   TEXT        NOT NULL DEFAULT 'net_30'
                              CHECK (payment_terms IN ('net_7','net_14','net_30','net_60')),
  notes           TEXT,
  created_by      UUID        REFERENCES users(id),
  sent_by         UUID        REFERENCES users(id),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_brand       ON invoices(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_issued      ON invoices(issued_date DESC);

-- ── 3. Invoice line items ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description     TEXT        NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(14,2) NOT NULL,
  -- amount is quantity × unit_price — computed by service, not a DB column
  -- to avoid GENERATED ALWAYS AS complications with Supabase
  sort_order      INT         DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(invoice_id);

-- ── 4. Payments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID        NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  brand_id        UUID        NOT NULL REFERENCES brands(id),
  amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  payment_method  TEXT        DEFAULT 'bank_transfer'
                              CHECK (payment_method IN ('bank_transfer','cheque','cash','card','other')),
  reference       TEXT,       -- bank transfer reference or cheque number
  notes           TEXT,
  recorded_by     UUID        REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_brand   ON payments(brand_id, payment_date DESC);

-- ── 5. Auto-update invoices.updated_at ────────────────────────────────
CREATE OR REPLACE FUNCTION touch_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION touch_invoice_updated_at();

-- ── 6. RLS ───────────────────────────────────────────────────────────
ALTER TABLE invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_auth"       ON invoices            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "line_items_auth"     ON invoice_line_items  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "payments_auth"       ON payments            FOR ALL TO authenticated USING (true) WITH CHECK (true);
