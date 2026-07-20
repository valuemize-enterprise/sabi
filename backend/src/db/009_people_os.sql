-- ═══════════════════════════════════════════════════════════════
-- Migration 009 — People OS (Profile Generator + HR Portal)
-- Sabi Intelligence Suite · Blueprint v1, D1–D7 approved
--
-- Tables:
--   people_records    → HR source of truth, tier-structured (§03)
--   people_documents  → Tier-3 document vault metadata
--   leave_requests    → D4 approval chain; approval writes staff_leave
--   tier3_access_log  → every Tier-3 read, audit-logged (§03 hard rule 2)
-- Extensions:
--   users.role gains 'hr' · staff_profiles gains draft/publish state
-- ═══════════════════════════════════════════════════════════════

-- ── users: the hr role (D1) ────────────────────────────────────
-- If users.role is a VARCHAR (Sabi default), nothing to alter here —
-- just start assigning 'hr'. If you made it a Postgres enum, run:
--   ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr';
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_state VARCHAR(24) DEFAULT 'invited';
-- invited | activated | profile_draft | profile_live | complete

-- ── people_records: HR source of truth ────────────────────────
-- Column order groups the tiers. The generator's whitelist in
-- people.service.js selects Tier 1 columns ONLY — structural, not
-- polite. Tier 3 columns are never selected by any non-HR path.
CREATE TABLE IF NOT EXISTS people_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE NOT NULL,          -- FK users.id

  -- ═ TIER 1 · PUBLIC — generator-readable, client-visible via profile ═
  display_name     VARCHAR(120) NOT NULL,
  role_key         VARCHAR(48)  NOT NULL,         -- one of the 15 roles
  role_title       VARCHAR(120) NOT NULL,         -- human title shown on profile
  department       VARCHAR(64),
  start_date       DATE NOT NULL,
  spark_line       VARCHAR(200),                  -- the one human sentence

  -- ═ TIER 2 · INTERNAL ═
  work_phone       VARCHAR(32),
  employment_type  VARCHAR(16) NOT NULL DEFAULT 'full_time', -- full_time|contract|intern
  tp_cohort        VARCHAR(24),                   -- Tomorrow's People cohort tag
  probation_end    DATE,
  onboarding       JSONB DEFAULT '{}',            -- checklist state

  -- ═ TIER 3 · HR-CONFIDENTIAL — HR + Super Admin; MD audit-logged ═
  personal_email   VARCHAR(255),
  personal_phone   VARCHAR(32),
  date_of_birth    DATE,                          -- day+month used for D6; year never surfaced
  emergency_contact JSONB,                        -- {name, relationship, phone}
  comp_band        VARCHAR(24),                   -- band only, no figures (D3)
  hr_notes         TEXT,                          -- disciplinary / PIP notes

  status           VARCHAR(16) NOT NULL DEFAULT 'active', -- onboarding|active|offboarding|exited
  exit_date        DATE,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS people_records_status_idx ON people_records (status);

-- ── people_documents: Tier-3 vault (files in a PRIVATE bucket) ─
CREATE TABLE IF NOT EXISTS people_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  doc_type    VARCHAR(32) NOT NULL,     -- contract | id | certification | other
  label       VARCHAR(120) NOT NULL,
  file_path   TEXT NOT NULL,            -- Supabase Storage path, bucket: people-vault (private)
  expiry_date DATE,
  uploaded_by UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS people_documents_user_idx   ON people_documents (user_id);
CREATE INDEX IF NOT EXISTS people_documents_expiry_idx ON people_documents (expiry_date);

-- ── leave_requests: D4 chain ──────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  leave_type    VARCHAR(16) NOT NULL DEFAULT 'annual', -- annual|sick|personal
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  note          VARCHAR(300),
  status        VARCHAR(12) NOT NULL DEFAULT 'pending', -- pending|approved|declined
  approver_id   UUID,
  decision_note VARCHAR(300),
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leave_requests_user_idx   ON leave_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON leave_requests (status);

-- ── tier3_access_log: accountable access (§03 hard rule 2) ────
CREATE TABLE IF NOT EXISTS tier3_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reader_id       UUID NOT NULL,
  subject_user_id UUID NOT NULL,
  context         VARCHAR(64) NOT NULL,   -- person_file | documents | export
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tier3_access_subject_idx ON tier3_access_log (subject_user_id, accessed_at DESC);

-- ── staff_profiles: draft/publish lifecycle ───────────────────
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS state VARCHAR(12) NOT NULL DEFAULT 'published';
--   draft | published   (existing rows default to published — no regression)
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS generation_version SMALLINT DEFAULT 0;

COMMENT ON TABLE people_records IS
  'HR source of truth. Tier 1 (public) feeds the profile generator; Tier 3 readable by hr/super_admin only, MD reads audit-logged via tier3_access_log. Profile facts mirror Tier 1 read-only.';
