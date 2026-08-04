-- ═══════════════════════════════════════════════════════════════
-- Migration 012 — brand_users (ROLLBACK)
-- Drops brand_users and all associated objects in reverse order.
-- ⚠  This is destructive — all brand assignment records will be lost.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Drop trigger first (depends on function)
DROP TRIGGER  IF EXISTS trg_brand_users_updated_at ON brand_users;
DROP FUNCTION IF EXISTS set_brand_users_updated_at();

-- Drop table (cascades RLS policies and indexes automatically)
DROP TABLE IF EXISTS brand_users CASCADE;

RAISE NOTICE 'Migration 012 (brand_users): rolled back';

COMMIT;
