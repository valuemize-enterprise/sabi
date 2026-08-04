-- ═══════════════════════════════════════════════════════════════════════════
-- 010_staff_profile_submissions.sql
-- Staff Profile Form — database layer
--
-- Depends on:
--   009_people_os.sql  → people_records, staff_profiles, tier3_access_log,
--                         users.onboarding_state
--
-- What this adds:
--   · staff_profile_submissions     — every field the staff form collects
--   · staff_profile_history         — immutable audit log of every submit/verify
--   · people_records.form_submission_state — quick status for registry view
--   · people_records.form_submitted_at     — when did staff submit
--   · RLS, triggers, indexes
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1 · EXTEND people_records FOR QUICK REGISTRY QUERIES
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE people_records
  ADD COLUMN IF NOT EXISTS form_submission_state VARCHAR(16) NOT NULL DEFAULT 'not_started',
  -- not_started | draft | submitted | verified | rejected
  ADD COLUMN IF NOT EXISTS form_submitted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS form_verified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guarantor_form_received BOOLEAN NOT NULL DEFAULT FALSE;

-- Comment explains the lifecycle
COMMENT ON COLUMN people_records.form_submission_state IS
  'Mirrors staff_profile_submissions.profile_state. Denormalised for fast registry queries without a join.';
COMMENT ON COLUMN people_records.guarantor_form_received IS
  'HR marks true when the physical Guarantor Form is received. Tracked separately from the digital form.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2 · MAIN FORM TABLE
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_profile_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,   -- FK users.id (no hard FK — Supabase auth.users)

  -- ── Profile lifecycle ────────────────────────────────────────────────
  profile_state  VARCHAR(16) NOT NULL DEFAULT 'not_started'
    CHECK (profile_state IN ('not_started','draft','submitted','verified','rejected')),
  submitted_at   TIMESTAMPTZ,
  verified_at    TIMESTAMPTZ,
  verified_by    UUID,         -- FK users.id of the HR who verified
  rejected_at    TIMESTAMPTZ,
  rejected_by    UUID,
  rejection_reason TEXT,

  -- ═══════════════════════════════════════════════════════
  -- TIER 1 · PUBLIC
  -- ═══════════════════════════════════════════════════════
  surname      VARCHAR(80),
  first_name   VARCHAR(80),
  middle_name  VARCHAR(80),

  -- ═══════════════════════════════════════════════════════
  -- TIER 2 · INTERNAL  (HR + admin + self)
  -- ═══════════════════════════════════════════════════════

  -- Identity & origin
  date_of_birth        DATE,
  nationality          VARCHAR(60)  NOT NULL DEFAULT 'Nigerian',
  place_of_birth       VARCHAR(80),   -- non-Nigerians only
  country_of_birth     VARCHAR(80),
  state_of_origin      VARCHAR(80),
  lga                  VARCHAR(80),
  hometown             VARCHAR(80),
  religion             VARCHAR(40),

  -- Marital
  marital_status       VARCHAR(12) CHECK (marital_status IN ('Single','Married','Divorced','Widowed')),
  date_of_marriage     DATE,
  spouse_name          VARCHAR(120),
  spouse_nationality   VARCHAR(60),
  spouse_profession    VARCHAR(80),

  -- Contact
  home_address         TEXT,
  phone                VARCHAR(24),
  personal_email       VARCHAR(120),

  -- Next of Kin
  nok_name             VARCHAR(120),
  nok_relationship     VARCHAR(40),
  nok_phone            VARCHAR(24),
  nok_email            VARCHAR(120),
  nok_address          TEXT,

  -- Family members (JSONB array)
  -- Schema: [{ full_name, date_of_birth, relationship }]
  family_members       JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Education (all JSONB arrays for flexibility)
  -- Schema for each entry: { institution_name, address, from_date, to_date, certificate_obtained }
  secondary_school                  JSONB,    -- single entry (null if not filled)
  tertiary_education                JSONB NOT NULL DEFAULT '[]'::jsonb,
  professional_qualifications       JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Languages
  -- Schema: [{ language, speaking, reading, writing }]   (proficiency: 'Very Good'|'Good'|'Fair')
  languages            JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Work experience
  total_years_experience  SMALLINT CHECK (total_years_experience >= 0),
  has_criminal_record     BOOLEAN NOT NULL DEFAULT FALSE,
  criminal_record_details TEXT,
  -- Schema: [{ organisation, from_date, to_date, responsibilities }]
  work_history            JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Guarantor (digital section — physical form tracked on people_records)
  guarantor_name                VARCHAR(120),
  guarantor_relationship        VARCHAR(80),
  guarantor_profession          VARCHAR(80),
  guarantor_company             VARCHAR(120),
  guarantor_office_address      TEXT,
  guarantor_phone               VARCHAR(24),
  guarantor_email               VARCHAR(120),
  guarantor_comments            TEXT,
  guarantor_form_acknowledged   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Declaration
  declaration_1        BOOLEAN NOT NULL DEFAULT FALSE,
  declaration_2        BOOLEAN NOT NULL DEFAULT FALSE,
  digital_signature    VARCHAR(200),
  signature_date       DATE,

  -- HR notes (set during verification)
  hr_notes             TEXT,

  -- ═══════════════════════════════════════════════════════
  -- TIER 3 · CONFIDENTIAL  (HR, Super Admin, self only)
  -- ═══════════════════════════════════════════════════════
  blood_group          VARCHAR(4) CHECK (blood_group  IN ('A+','A−','B+','B−','O+','O−','AB+','AB−')),
  genotype             VARCHAR(4) CHECK (genotype     IN ('AA','AS','SS','AC','SC')),
  allergy_1            VARCHAR(120),
  allergy_2            VARCHAR(120),
  medical_conditions   TEXT,

  -- Emergency contact
  emergency_contact_name    VARCHAR(120),
  emergency_contact_phone   VARCHAR(24),
  emergency_contact_address TEXT,

  -- ── Timestamps ───────────────────────────────────────────────────────
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One submission per user
  CONSTRAINT staff_profile_submissions_user_unique UNIQUE (user_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3 · IMMUTABLE HISTORY LOG
--     Every significant state change (submit, verify, reject, re-submit)
--     is appended here. Nothing is ever updated — insert-only.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_profile_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  actor_id     UUID NOT NULL,    -- who triggered the change
  event        VARCHAR(32) NOT NULL,
  -- 'draft_saved' | 'submitted' | 'verified' | 'rejected' | 'resubmitted' | 'guarantor_received'
  note         TEXT,
  snapshot     JSONB,            -- optional: diff or full submission snapshot at this moment
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4 · AUTO-UPDATE updated_at
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_updated_at ON staff_profile_submissions;
CREATE TRIGGER trg_profile_updated_at
  BEFORE UPDATE ON staff_profile_submissions
  FOR EACH ROW EXECUTE FUNCTION fn_profile_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 5 · KEEP people_records.form_submission_state IN SYNC (denorm trigger)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_form_state()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only fire when state column actually changes
  IF OLD.profile_state IS DISTINCT FROM NEW.profile_state THEN
    UPDATE people_records
    SET
      form_submission_state = NEW.profile_state,
      form_submitted_at     = CASE WHEN NEW.profile_state = 'submitted'  THEN NEW.submitted_at ELSE form_submitted_at END,
      form_verified_at      = CASE WHEN NEW.profile_state = 'verified'   THEN NEW.verified_at  ELSE form_verified_at  END
    WHERE user_id = NEW.user_id;

    -- Also advance onboarding_state if it's still at 'activated'
    UPDATE users
    SET onboarding_state =
      CASE
        WHEN NEW.profile_state = 'submitted' AND onboarding_state IN ('invited','activated') THEN 'profile_submitted'
        WHEN NEW.profile_state = 'verified'  THEN 'complete'
        ELSE onboarding_state
      END
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_form_state ON staff_profile_submissions;
CREATE TRIGGER trg_sync_form_state
  AFTER UPDATE ON staff_profile_submissions
  FOR EACH ROW EXECUTE FUNCTION fn_sync_form_state();

-- ─────────────────────────────────────────────────────────────────────────
-- 6 · INDEXES
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sps_user_id    ON staff_profile_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_sps_state      ON staff_profile_submissions (profile_state);
CREATE INDEX IF NOT EXISTS idx_sps_submitted  ON staff_profile_submissions (submitted_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_sps_verified   ON staff_profile_submissions (verified_at  DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_sph_user_id    ON staff_profile_history (user_id);
CREATE INDEX IF NOT EXISTS idx_sph_actor      ON staff_profile_history (actor_id);
CREATE INDEX IF NOT EXISTS idx_sph_created    ON staff_profile_history (created_at DESC);

-- tier3_access_log already created in 009; add index if missing
CREATE INDEX IF NOT EXISTS idx_t3_subject ON tier3_access_log (subject_user_id);
CREATE INDEX IF NOT EXISTS idx_t3_reader  ON tier3_access_log (reader_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 7 · ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE staff_profile_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profile_history      ENABLE ROW LEVEL SECURITY;

-- Staff sees and edits only their own row
CREATE POLICY "sps_own_row" ON staff_profile_submissions
  FOR ALL USING (user_id = auth.uid());

-- HR / Super Admin read all rows (tier filtering is in the service layer, not here)
CREATE POLICY "sps_hr_read" ON staff_profile_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND   role IN ('hr','super_admin','md')
    )
  );

-- HR / Super Admin update verification fields only
CREATE POLICY "sps_hr_update" ON staff_profile_submissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND   role IN ('hr','super_admin')
    )
  );

-- History: anyone can insert their own events; HR/Super Admin can read all
CREATE POLICY "sph_insert_own" ON staff_profile_history
  FOR INSERT WITH CHECK (actor_id = auth.uid());

CREATE POLICY "sph_hr_read" ON staff_profile_history
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND   role IN ('hr','super_admin','md')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 8 · CONVENIENCE VIEW — HR dashboard summary (no Tier 3 fields)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_profile_form_summary AS
SELECT
  pr.user_id,
  pr.display_name,
  pr.role_title,
  pr.department,
  pr.employment_type,
  pr.start_date,
  pr.form_submission_state,
  pr.form_submitted_at,
  pr.form_verified_at,
  pr.guarantor_form_received,
  sps.profile_state,
  sps.surname,
  sps.first_name,
  sps.phone,
  sps.personal_email,
  sps.nok_name,
  sps.nok_phone,
  sps.total_years_experience,
  sps.guarantor_name,
  sps.guarantor_phone,
  sps.guarantor_form_acknowledged,
  sps.digital_signature,
  sps.signature_date,
  sps.hr_notes,
  sps.created_at   AS form_started_at,
  sps.updated_at   AS form_last_saved
FROM people_records pr
LEFT JOIN staff_profile_submissions sps ON sps.user_id = pr.user_id
WHERE pr.status = 'active';

COMMENT ON VIEW v_profile_form_summary IS
  'HR dashboard view: profile form completion status without Tier-3 fields. Medical data must be read via the service layer (triggers audit log).';

-- ─────────────────────────────────────────────────────────────────────────
-- 9 · SEED onboarding_state VALUE (if missing from 009 ALTER)
-- ─────────────────────────────────────────────────────────────────────────
-- Adds 'profile_submitted' if users.onboarding_state is an enum type.
-- If it is a plain VARCHAR this block is a no-op (safe to run regardless).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'onboarding_state_enum'
  ) THEN
    ALTER TYPE onboarding_state_enum ADD VALUE IF NOT EXISTS 'profile_submitted';
    ALTER TYPE onboarding_state_enum ADD VALUE IF NOT EXISTS 'complete';
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- not an enum — VARCHAR column, skip silently
END;
$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK SCRIPT (run manually if you need to undo this migration)
-- ─────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP VIEW  IF EXISTS v_profile_form_summary;
-- DROP TABLE IF EXISTS staff_profile_history     CASCADE;
-- DROP TABLE IF EXISTS staff_profile_submissions CASCADE;
-- DROP FUNCTION IF EXISTS fn_sync_form_state()  CASCADE;
-- DROP FUNCTION IF EXISTS fn_profile_updated_at() CASCADE;
-- ALTER TABLE people_records
--   DROP COLUMN IF EXISTS form_submission_state,
--   DROP COLUMN IF EXISTS form_submitted_at,
--   DROP COLUMN IF EXISTS form_verified_at,
--   DROP COLUMN IF EXISTS guarantor_form_received;
-- COMMIT;
