-- Migration 013 ROLLBACK
BEGIN;
DROP TRIGGER  IF EXISTS trg_task_groups_updated_at ON task_groups;
DROP FUNCTION IF EXISTS set_task_groups_updated_at();
DROP TABLE    IF EXISTS task_comments CASCADE;
ALTER TABLE   tasks DROP COLUMN IF EXISTS group_id;
DROP TABLE    IF EXISTS task_groups CASCADE;
RAISE NOTICE 'Migration 013: rolled back';
COMMIT;
