-- ═══════════════════════════════════════════════════════════════════
-- Migration 018 — deal_debriefs.what_failed + notes columns
-- Sabi Intelligence Suite · Cerebre Media Africa
--
-- Why:
--   deal-debrief.service.js / deal-debrief-api.ts (frontend) persist a
--   "what_failed" (lost-only reason) and a free-text "notes" field.
--   Migration 011 created deal_debriefs with the older names
--   (loss_objection, what_to_change) and NO notes column, so the
--   archive + quarterly-insights queries fail with:
--     column deal_debriefs.what_failed does not exist
--
--   This migration adds the columns the API contract uses. The legacy
--   loss_objection/what_to_change columns are left in place (data kept).
--
-- Run with:  psql -f backend/src/db/migrations/018_deal_debriefs_what_failed_notes.sql
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.deal_debriefs
  ADD COLUMN IF NOT EXISTS what_failed TEXT,
  ADD COLUMN IF NOT EXISTS notes      TEXT;

COMMIT;
