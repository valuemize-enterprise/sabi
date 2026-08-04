-- ═══════════════════════════════════════════════════════════════════
-- Migration 017 — email_log.entity_id → TEXT
-- Sabi Intelligence Suite · Cerebre Media Africa
--
-- Why:
--   email_dispatch.service.js logs entity_id for dedupe bookkeeping.
--   Most callers pass a single UUID (task/brief id). The leave flow
--   (leave.service.js) passes a per-recipient composite id like
--   "<requestId>:<approverId>" so each approver gets their own email —
--   the shared entity must therefore NOT be a UUID column.
--
--   With entity_id UUID, leave emails raised:
--     invalid input syntax for type uuid: "bf…:2d…"
--
-- This is safe: it only widens the column (no data loss, no index change).
-- Run with:  psql -f backend/src/db/migrations/017_email_log_entity_id_text.sql
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.email_log
  ALTER COLUMN entity_id TYPE TEXT USING entity_id::text;

COMMIT;
