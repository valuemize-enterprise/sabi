-- ═══════════════════════════════════════════════════════════════════
-- Migration 010 — People OS v2
-- Sabi Intelligence Suite · Cerebre Media Africa
--
-- Adds:
--   • people_record_changes  — field-level audit trail for every HR edit
--   • disciplinary_records   — HR-only disciplinary event log
--   • New columns on people_records:
--       employment_status, exit_date, exit_reason,
--       contract_end_date, line_manager_id, probation_completed_at
--
-- Safe to run on existing data — all new columns have safe defaults
-- or are nullable. Nothing existing is dropped or renamed.
-- Run this before Migration 011.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. people_record_changes ─────────────────────────────────────
-- Every time HR edits a field on people_records, one row is written
-- here: who changed it, what the old value was, what the new value
-- is, and the reason (required for sensitive fields).

CREATE TABLE IF NOT EXISTS public.people_record_changes (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  record_id     UUID        NOT NULL,   -- → people_records.id
  user_id       UUID        NOT NULL,   -- the staff member whose record changed
  changed_by    UUID        NOT NULL,   -- the HR / Super Admin who made the change
  field_name    VARCHAR(64) NOT NULL,   -- e.g. 'role_key', 'employment_status'
  old_value     TEXT,                   -- serialised old value (NULL = was empty)
  new_value     TEXT        NOT NULL,
  reason        TEXT,                   -- required for role, status, comp_band, start_date
  tier          SMALLINT    NOT NULL DEFAULT 1,  -- 1, 2, or 3 — mirrors the data tier
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT people_record_changes_pkey
    PRIMARY KEY (id),
  CONSTRAINT people_record_changes_record_id_fkey
    FOREIGN KEY (record_id) REFERENCES public.people_records (id)
    ON DELETE CASCADE,
  CONSTRAINT people_record_changes_user_id_fkey
    FOREIGN KEY (user_id)   REFERENCES public.users (id)
    ON DELETE CASCADE,
  CONSTRAINT people_record_changes_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES public.users (id)
    ON DELETE SET NULL,
  CONSTRAINT people_record_changes_tier_check
    CHECK (tier IN (1, 2, 3))
);

-- Index: list all changes for a specific person, newest first
CREATE INDEX IF NOT EXISTS idx_prc_record_id
  ON public.people_record_changes (record_id, changed_at DESC);

-- Index: find all changes made by a specific HR user
CREATE INDEX IF NOT EXISTS idx_prc_changed_by
  ON public.people_record_changes (changed_by, changed_at DESC);

-- Index: find all changes to a specific field across all records
CREATE INDEX IF NOT EXISTS idx_prc_field_name
  ON public.people_record_changes (field_name, changed_at DESC);

COMMENT ON TABLE public.people_record_changes IS
  'Field-level audit trail for every HR edit on people_records. '
  'HR only. Never exposed to staff, Admin, or MD.';


-- ── 2. disciplinary_records ──────────────────────────────────────
-- HR-only log of formal disciplinary events.
-- Never visible to the staff member themselves, Admin, or MD.
-- Accessible via the Disciplinary tab in PersonFile.

CREATE TABLE IF NOT EXISTS public.disciplinary_records (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL,   -- the staff member
  type          VARCHAR(32) NOT NULL,
  date_issued   DATE        NOT NULL,
  description   TEXT        NOT NULL,
  outcome       TEXT,                   -- resolution summary if any
  created_by    UUID        NOT NULL,
  is_resolved   BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT disciplinary_records_pkey
    PRIMARY KEY (id),
  CONSTRAINT disciplinary_records_type_check
    CHECK (type IN (
      'verbal_warning',
      'written_warning',
      'pip',           -- Performance Improvement Plan
      'suspension',
      'dismissal'
    )),
  CONSTRAINT disciplinary_records_user_id_fkey
    FOREIGN KEY (user_id)     REFERENCES public.users (id) ON DELETE CASCADE,
  CONSTRAINT disciplinary_records_created_by_fkey
    FOREIGN KEY (created_by)  REFERENCES public.users (id) ON DELETE SET NULL,
  CONSTRAINT disciplinary_records_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES public.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dr_user_id
  ON public.disciplinary_records (user_id, created_at DESC);

COMMENT ON TABLE public.disciplinary_records IS
  'HR-only disciplinary event log. HR and Super Admin read/write. '
  'Never visible to the staff member, MD, or Admin.';


-- ── 3. New columns on people_records ─────────────────────────────

-- employment_status: the formal HR status for this person.
-- Separate from the existing `status` column (which tracks
-- whether the Sabi account is active/inactive) — this tracks
-- the employment relationship itself.
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS employment_status VARCHAR(24)
    NOT NULL DEFAULT 'active';

-- Add constraint separately so IF NOT EXISTS works cleanly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'people_records'
      AND constraint_name = 'people_records_employment_status_check'
  ) THEN
    ALTER TABLE public.people_records
      ADD CONSTRAINT people_records_employment_status_check
      CHECK (employment_status IN (
        'active',
        'probation',
        'on_leave',
        'suspended',
        'resigned',
        'terminated'
      ));
  END IF;
END $$;

-- Populate employment_status from existing status where possible
-- Adjust this mapping if your existing status values differ
UPDATE public.people_records
SET employment_status = CASE
  WHEN status = 'offboarded' THEN 'resigned'
  WHEN status = 'inactive'   THEN 'terminated'
  ELSE 'active'
END
WHERE employment_status = 'active'  -- only update the default
  AND status IS NOT NULL
  AND status != 'active';

-- exit_date: set when employment_status → resigned or terminated
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS exit_date DATE;

-- exit_reason: HR-authored brief note on why the person left
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS exit_reason TEXT;

-- contract_end_date: for employment_type = 'contract' only.
-- Triggers renewal reminders at 30 days and 7 days before expiry.
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- line_manager_id: the person's direct line manager.
-- Different from their Brand Admin on a specific brand —
-- this is the permanent organisational reporting line.
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS line_manager_id UUID
    REFERENCES public.users (id) ON DELETE SET NULL;

-- probation_completed_at: set by HR when probation is confirmed complete.
-- Allows People OS to track the full probation lifecycle.
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS probation_completed_at DATE;

CREATE INDEX IF NOT EXISTS idx_pr_employment_status
  ON public.people_records (employment_status);

CREATE INDEX IF NOT EXISTS idx_pr_line_manager_id
  ON public.people_records (line_manager_id);

COMMENT ON COLUMN public.people_records.employment_status IS
  'Formal HR employment status. Drives the status machine. '
  'Separate from `status` (Sabi account active/inactive).';
COMMENT ON COLUMN public.people_records.contract_end_date IS
  'Applicable when employment_type = ''contract''. '
  'Triggers renewal alerts at 30 and 7 days before expiry.';
COMMENT ON COLUMN public.people_records.line_manager_id IS
  'Permanent direct line manager. Different from Brand Admin assignments.';


COMMIT;

-- ── Verification queries (run after commit to confirm) ────────────
-- SELECT COUNT(*) FROM public.people_record_changes;   -- should be 0 (new)
-- SELECT COUNT(*) FROM public.disciplinary_records;    -- should be 0 (new)
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'people_records'
--     AND column_name IN (
--       'employment_status','exit_date','exit_reason',
--       'contract_end_date','line_manager_id','probation_completed_at'
--     );   -- should return 6 rows
