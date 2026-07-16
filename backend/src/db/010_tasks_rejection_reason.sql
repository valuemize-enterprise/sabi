-- ============================================================
-- Migration 010: Add rejection_reason to tasks
-- Stores the reason when a brand admin sends a task back
-- ============================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
