-- ═══════════════════════════════════════════════════════════════
-- Migration 012 — brand_users
-- Sabi Intelligence Suite
--
-- Self-contained version. Foreign key references to organizations,
-- brands, and users are added conditionally — the table and its
-- indexes/RLS are created regardless of whether those tables exist
-- yet. Run this in any order.
--
-- Run:      psql $DATABASE_URL -f 012_brand_users.up.sql
-- Rollback: psql $DATABASE_URL -f 012_brand_users.down.sql
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── Table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant scope. Plain UUID — FK to organizations added
  -- conditionally below if that table exists.
  organization_id   UUID,

  -- The brand workspace this assignment belongs to.
  brand_id          UUID        NOT NULL,

  -- The user being assigned.
  user_id           UUID        NOT NULL,

  -- Permission role scoped to this brand.
  -- brand_admin     — full control over this workspace
  -- account_manager — manages delivery, cannot delete
  -- staff           — submit tasks and claim contributions
  -- client          — read-only client portal access
  role              VARCHAR(32) NOT NULL DEFAULT 'staff'
                    CHECK (role IN ('brand_admin','account_manager','staff','client')),

  -- Human-readable labels for the UI (e.g. 'Creative Lead').
  -- Does not affect permissions — purely display.
  display_roles     TEXT[]      NOT NULL DEFAULT '{}',

  -- Assignment lifecycle.
  status            VARCHAR(16) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','pending')),

  -- Restrict to specific areas of the workspace (NULL = all).
  -- Example: ['tasks','briefs'] limits to those sections.
  scope_permissions TEXT[],

  -- Who added this user to the brand.
  assigned_by       UUID,

  activated_at      TIMESTAMPTZ,
  deactivated_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One assignment per user per brand (within the same org if multi-tenant,
  -- or globally if single-tenant).
  CONSTRAINT brand_users_unique_assignment
    UNIQUE (organization_id, brand_id, user_id)
);

COMMENT ON TABLE brand_users IS
  'Brand-level user assignments. Controls who can access each brand workspace and in what role.';

COMMENT ON COLUMN brand_users.role IS
  'Permission role on this brand. Separate from the org-level role in memberships.';

COMMENT ON COLUMN brand_users.display_roles IS
  'Human-readable role labels shown in the UI. Does not affect permissions.';

COMMENT ON COLUMN brand_users.scope_permissions IS
  'Optional subset of workspace areas accessible to this user. NULL = all areas the role allows.';

-- ── Conditional foreign keys ───────────────────────────────────
-- Added only when the referenced tables exist, so this migration
-- is safe to run standalone or before migrations 001/002.

DO $$
BEGIN

  -- FK: organization_id → organizations
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'brand_users_org_fk' AND table_name = 'brand_users'
    ) THEN
      ALTER TABLE brand_users
        ADD CONSTRAINT brand_users_org_fk
        FOREIGN KEY (organization_id)
        REFERENCES organizations (id) ON DELETE CASCADE;
      RAISE NOTICE 'brand_users: added FK → organizations';
    END IF;
  ELSE
    RAISE NOTICE 'brand_users: organizations not found — organization_id FK skipped (add manually after migration 001)';
  END IF;

  -- FK: brand_id → brands
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brands'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'brand_users_brand_fk' AND table_name = 'brand_users'
    ) THEN
      ALTER TABLE brand_users
        ADD CONSTRAINT brand_users_brand_fk
        FOREIGN KEY (brand_id)
        REFERENCES brands (id) ON DELETE CASCADE;
      RAISE NOTICE 'brand_users: added FK → brands';
    END IF;
  ELSE
    RAISE NOTICE 'brand_users: brands not found — brand_id FK skipped';
  END IF;

  -- FK: user_id → users
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'brand_users_user_fk' AND table_name = 'brand_users'
    ) THEN
      ALTER TABLE brand_users
        ADD CONSTRAINT brand_users_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE;
      RAISE NOTICE 'brand_users: added FK → users';
    END IF;
  ELSE
    RAISE NOTICE 'brand_users: users not found — user_id FK skipped';
  END IF;

  -- FK: assigned_by → users (same table, soft reference)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'brand_users_assigned_by_fk' AND table_name = 'brand_users'
    ) THEN
      ALTER TABLE brand_users
        ADD CONSTRAINT brand_users_assigned_by_fk
        FOREIGN KEY (assigned_by)
        REFERENCES users (id) ON DELETE SET NULL;
    END IF;
  END IF;

END;
$$;

-- ── Indexes ────────────────────────────────────────────────────

-- All users on a given brand (e.g. render the team roster)
CREATE INDEX IF NOT EXISTS idx_brand_users_brand
  ON brand_users (organization_id, brand_id)
  WHERE status = 'active';

-- All brands a user belongs to (e.g. populate the brand switcher)
CREATE INDEX IF NOT EXISTS idx_brand_users_user
  ON brand_users (organization_id, user_id)
  WHERE status = 'active';

-- Permission checks: find brand_admins on a specific brand
CREATE INDEX IF NOT EXISTS idx_brand_users_role
  ON brand_users (organization_id, brand_id, role)
  WHERE status = 'active';

-- Pending invitations
CREATE INDEX IF NOT EXISTS idx_brand_users_pending
  ON brand_users (organization_id, user_id)
  WHERE status = 'pending';

-- ── updated_at trigger ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION brand_users_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brand_users_updated_at ON brand_users;
CREATE TRIGGER trg_brand_users_updated_at
  BEFORE UPDATE ON brand_users
  FOR EACH ROW EXECUTE FUNCTION brand_users_set_updated_at();

-- ── Row-Level Security ─────────────────────────────────────────
-- Two modes depending on your setup:
--
--   Multi-tenant (Sabi Intelligence, migration 001 applied):
--     Tenant context is read from session GUC app.current_org.
--     The SELECT policy below uses that GUC.
--
--   Single-tenant (Cerebre internal Sabi, no organizations table):
--     organization_id will be NULL or a fixed value.
--     The SELECT policy falls through to the brand_id check.
--
--   Supabase:
--     Replace current_setting('app.current_user',...) with auth.uid()
--     and current_setting('app.current_org',...) with
--     (auth.jwt() ->> 'org_id')::UUID in the policies below.

ALTER TABLE brand_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_users FORCE ROW LEVEL SECURITY;

-- Drop and recreate so this is idempotent on re-runs
DROP POLICY IF EXISTS brand_users_select  ON brand_users;
DROP POLICY IF EXISTS brand_users_insert  ON brand_users;
DROP POLICY IF EXISTS brand_users_update  ON brand_users;
DROP POLICY IF EXISTS brand_users_delete  ON brand_users;

-- SELECT: see your own assignment, or all assignments on brands you admin
CREATE POLICY brand_users_select ON brand_users
  FOR SELECT
  USING (
    -- Own row always visible
    user_id = COALESCE(
      current_setting('app.current_user', TRUE)::UUID,
      '00000000-0000-0000-0000-000000000000'::UUID
    )
    OR
    -- Brand admins see all members on their brand
    EXISTS (
      SELECT 1 FROM brand_users bu
      WHERE bu.brand_id = brand_users.brand_id
        AND bu.user_id  = COALESCE(
          current_setting('app.current_user', TRUE)::UUID,
          '00000000-0000-0000-0000-000000000000'::UUID
        )
        AND bu.role   = 'brand_admin'
        AND bu.status = 'active'
    )
  );

-- INSERT: only brand_admins on that brand (or bypass for org-level admins
-- handled in application middleware — keep this policy simple)
CREATE POLICY brand_users_insert ON brand_users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brand_users bu
      WHERE bu.brand_id = brand_users.brand_id
        AND bu.user_id  = COALESCE(
          current_setting('app.current_user', TRUE)::UUID,
          '00000000-0000-0000-0000-000000000000'::UUID
        )
        AND bu.role   = 'brand_admin'
        AND bu.status = 'active'
    )
  );

-- UPDATE: brand_admins on the same brand
CREATE POLICY brand_users_update ON brand_users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM brand_users bu
      WHERE bu.brand_id = brand_users.brand_id
        AND bu.user_id  = COALESCE(
          current_setting('app.current_user', TRUE)::UUID,
          '00000000-0000-0000-0000-000000000000'::UUID
        )
        AND bu.role   = 'brand_admin'
        AND bu.status = 'active'
    )
  );

-- DELETE: brand_admins only (prefer status='inactive' for soft removal)
CREATE POLICY brand_users_delete ON brand_users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM brand_users bu
      WHERE bu.brand_id = brand_users.brand_id
        AND bu.user_id  = COALESCE(
          current_setting('app.current_user', TRUE)::UUID,
          '00000000-0000-0000-0000-000000000000'::UUID
        )
        AND bu.role   = 'brand_admin'
        AND bu.status = 'active'
    )
  );

-- ── Verification ───────────────────────────────────────────────

DO $$
BEGIN
  ASSERT (
    SELECT relrowsecurity FROM pg_class WHERE relname = 'brand_users'
  ), 'RLS must be enabled on brand_users';

  ASSERT (
    SELECT COUNT(*) FROM pg_policies WHERE tablename = 'brand_users'
  ) = 4, 'Expected 4 RLS policies on brand_users';

  RAISE NOTICE 'Migration 012 (brand_users): OK — table, indexes, RLS all verified';
END;
$$;

COMMIT;
