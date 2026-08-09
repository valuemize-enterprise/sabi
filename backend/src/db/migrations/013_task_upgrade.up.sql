-- ═══════════════════════════════════════════════════════════════
-- Migration 013 — Task Groups + Task Comments
-- Sabi Intelligence Suite
--
-- Additive only. No existing columns or constraints are modified.
-- All existing tasks remain valid (group_id defaults to NULL = Ungrouped).
--
-- Run: paste into Supabase SQL editor and execute.
-- Rollback: 013_task_upgrade.down.sql
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. task_groups ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_groups (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID         NOT NULL REFERENCES brands(id)  ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7)   NOT NULL DEFAULT '#6d28d9',
  position    SMALLINT     NOT NULL DEFAULT 0,
  status      VARCHAR(16)  NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'archived')),
  created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_groups_brand
  ON task_groups (brand_id, position)
  WHERE status = 'active';

COMMENT ON TABLE task_groups IS 'Named groups (like Trello boards) that organise tasks within a brand workspace.';

-- ── 2. tasks — add group_id ────────────────────────────────────

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS group_id UUID
    REFERENCES task_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_group
  ON tasks (group_id)
  WHERE group_id IS NOT NULL;

COMMENT ON COLUMN tasks.group_id IS 'Optional task group. NULL = Ungrouped.';

-- ── 3. task_comments ───────────────────────────────────────────
-- 004_major_features already created task_comments with (task_id, user_id, content).
-- This migration is additive: add the new columns required by the comment service,
-- or create the table from scratch in a fresh DB.

CREATE TABLE IF NOT EXISTS task_comments (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID         NOT NULL REFERENCES tasks(id)  ON DELETE CASCADE,
  author_id   UUID         NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  body        TEXT         NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  mentions    UUID[]       NOT NULL DEFAULT '{}',
  edited_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Ensure the columns the comment service relies on exist even when the
-- table was created earlier by migration 004.
ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS author_id  UUID         REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS body       TEXT         CHECK (char_length(body) BETWEEN 1 AND 2000),
  ADD COLUMN IF NOT EXISTS mentions   UUID[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS edited_at  TIMESTAMPTZ;

-- Normalise older rows that used user_id/content into the new schema.
UPDATE task_comments
  SET author_id = COALESCE(author_id, user_id),
      body      = COALESCE(body, content)
  WHERE author_id IS NULL OR body IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_comments_task
  ON task_comments (task_id, created_at ASC);

COMMENT ON TABLE task_comments IS 'Comments on individual tasks. mentions[] stores @mentioned user IDs for notification dispatch.';

-- ── 4. updated_at trigger for task_groups ─────────────────────

CREATE OR REPLACE FUNCTION set_task_groups_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_groups_updated_at ON task_groups;
CREATE TRIGGER trg_task_groups_updated_at
  BEFORE UPDATE ON task_groups
  FOR EACH ROW EXECUTE FUNCTION set_task_groups_updated_at();

-- ── Verify ─────────────────────────────────────────────────────

DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'task_groups')    = 1, 'task_groups missing';
  ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'task_comments')  = 1, 'task_comments missing';
  ASSERT (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'group_id') = 1, 'tasks.group_id missing';
  RAISE NOTICE 'Migration 013: OK';
END;
$$;

COMMIT;
