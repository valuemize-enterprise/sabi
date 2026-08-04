-- ═══════════════════════════════════════════════════════════════════
-- Migration 011 — HR Session + Book of Deals
-- Sabi Intelligence Suite · Cerebre Media Africa
--
-- Adds:
--   • support_staff_directory  — non-login staff (drivers, cleaners, etc.)
--   • vacancies                — open positions tracker for MD dashboard
--   • deal_debriefs            — Win/Loss debrief system (Phase H)
--
--   New columns on people_records:
--       employment_category, internship_type, internship_duration,
--       internship_start_date, internship_end_date, internship_alert_sent
--
--   New column on users:
--       deal_book_full_access
--
--   Opportunities table:
--       Stage rename (6 values → new labels + new 'agreement' stage)
--       15 new columns (contact, deal_type, retainer, campaign, attribution, deck_url)
--       stage_changed_at column for staleness detection
--
--   agency_targets:
--       goal_category CHECK updated to include new_business + hr_workforce
--
-- Run Migration 010 BEFORE this one.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. support_staff_directory ────────────────────────────────────
-- Non-login staff. No Sabi accounts. HR manages this list.
-- Feeds the MD dashboard headcount widget (Support count).

CREATE TABLE IF NOT EXISTS public.support_staff_directory (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  full_name        VARCHAR(120) NOT NULL,
  phone_number     VARCHAR(32),
  role_type        VARCHAR(48) NOT NULL,
  role_description VARCHAR(120),
  department       VARCHAR(64),
  date_of_birth    DATE,                 -- optional, for birthday widget
  start_date       DATE,
  status           VARCHAR(16) NOT NULL DEFAULT 'active',
  notes            TEXT,
  created_by       UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT support_staff_directory_pkey
    PRIMARY KEY (id),
  CONSTRAINT support_staff_directory_role_type_check
    CHECK (role_type IN (
      'driver', 'receptionist', 'cleaner',
      'security', 'facility', 'other'
    )),
  CONSTRAINT support_staff_directory_status_check
    CHECK (status IN ('active', 'inactive', 'exited'))
);

CREATE INDEX IF NOT EXISTS idx_ssd_status
  ON public.support_staff_directory (status);
CREATE INDEX IF NOT EXISTS idx_ssd_role_type
  ON public.support_staff_directory (role_type);
CREATE INDEX IF NOT EXISTS idx_ssd_dob_month
  ON public.support_staff_directory (EXTRACT(MONTH FROM date_of_birth))
  WHERE date_of_birth IS NOT NULL;

COMMENT ON TABLE public.support_staff_directory IS
  'Non-login support staff (drivers, cleaners, security, etc.). '
  'HR and Super Admin only. No Sabi accounts required. '
  'Phase 2: contribution measurement and mobile notifications.';


-- ── 2. vacancies ─────────────────────────────────────────────────
-- HR flags open positions here. Surfaces in MD dashboard
-- as "X open positions" and in the People OS Alerts tab.

CREATE TABLE IF NOT EXISTS public.vacancies (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  role_name     VARCHAR(120) NOT NULL,
  department    VARCHAR(64),
  description   TEXT,
  date_opened   DATE        NOT NULL DEFAULT CURRENT_DATE,
  date_filled   DATE,
  status        VARCHAR(16) NOT NULL DEFAULT 'open',
  created_by    UUID REFERENCES public.users (id) ON DELETE SET NULL,
  filled_by     UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT vacancies_pkey PRIMARY KEY (id),
  CONSTRAINT vacancies_status_check
    CHECK (status IN ('open', 'filled', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_vacancies_status
  ON public.vacancies (status);

COMMENT ON TABLE public.vacancies IS
  'Open position tracker. HR creates/fills vacancies. '
  'MD dashboard shows count of open vacancies. '
  'Feeds HR and Workforce goal category in Agency Goals.';


-- ── 3. deal_debriefs ─────────────────────────────────────────────
-- Structured debrief captured on every Won or Lost deal close.
-- ARIA aggregates these quarterly for win/loss pattern analysis.

CREATE TABLE IF NOT EXISTS public.deal_debriefs (
  id                UUID        NOT NULL DEFAULT gen_random_uuid(),
  opportunity_id    UUID        NOT NULL,
  outcome           VARCHAR(8)  NOT NULL,  -- 'won' | 'lost'
  deciding_factor   TEXT,                  -- what made the difference (won)
  what_worked       TEXT,                  -- what to repeat (won)
  competitor_name   VARCHAR(120),          -- who they went with (lost)
  loss_objection    TEXT,                  -- what they cited as the reason (lost)
  pitch_again       BOOLEAN,               -- would we pitch this company again?
  what_to_change    TEXT,                  -- what would we do differently?
  debrief_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT deal_debriefs_pkey
    PRIMARY KEY (id),
  CONSTRAINT deal_debriefs_opportunity_id_fkey
    FOREIGN KEY (opportunity_id) REFERENCES public.opportunities (id)
    ON DELETE CASCADE,
  CONSTRAINT deal_debriefs_debrief_by_fkey
    FOREIGN KEY (debrief_by) REFERENCES public.users (id)
    ON DELETE SET NULL,
  CONSTRAINT deal_debriefs_outcome_check
    CHECK (outcome IN ('won', 'lost'))
);

CREATE INDEX IF NOT EXISTS idx_dd_opportunity_id
  ON public.deal_debriefs (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_dd_outcome_created
  ON public.deal_debriefs (outcome, created_at DESC);

COMMENT ON TABLE public.deal_debriefs IS
  'Structured Win/Loss debrief per closed deal. '
  'ARIA aggregates quarterly: win patterns, common objections, competitor appearances. '
  'Feeds New Business goal category win rate metric.';


-- ── 4. people_records — internship + employment category ─────────

-- employment_category: core staff vs intern.
-- Support staff are in support_staff_directory (not here).
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS employment_category VARCHAR(16)
    NOT NULL DEFAULT 'core';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'people_records'
      AND constraint_name = 'people_records_employment_category_check'
  ) THEN
    ALTER TABLE public.people_records
      ADD CONSTRAINT people_records_employment_category_check
      CHECK (employment_category IN ('core', 'intern'));
  END IF;
END $$;

-- Back-fill: anyone currently flagged as intern employment_type
-- gets the intern category
UPDATE public.people_records
SET employment_category = 'intern'
WHERE employment_type = 'intern'
  AND employment_category = 'core';

-- internship_type: NYSC (1yr fixed) | SIWES/other (custom duration)
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS internship_type VARCHAR(16);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'people_records'
      AND constraint_name = 'people_records_internship_type_check'
  ) THEN
    ALTER TABLE public.people_records
      ADD CONSTRAINT people_records_internship_type_check
      CHECK (internship_type IN ('nysc', 'siwes', 'other') OR internship_type IS NULL);
  END IF;
END $$;

-- internship_duration: months (12 for NYSC, 3/6/custom for SIWES)
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS internship_duration INTEGER;

-- internship_start_date: first day of the start month (HR picks month+year)
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS internship_start_date DATE;

-- internship_end_date: computed by the app
-- (start + duration months). Stored as a regular column
-- so the alert sweep can query it efficiently.
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS internship_end_date DATE;

-- internship_alert_sent: TRUE once the 1-month-remaining email fires.
-- Prevents duplicate alerts on repeated sweep runs.
ALTER TABLE public.people_records
  ADD COLUMN IF NOT EXISTS internship_alert_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for the daily alert sweep
CREATE INDEX IF NOT EXISTS idx_pr_internship_end_alert
  ON public.people_records (internship_end_date, internship_alert_sent)
  WHERE internship_end_date IS NOT NULL
    AND internship_alert_sent = FALSE;

COMMENT ON COLUMN public.people_records.internship_type IS
  'nysc = 1 year fixed. siwes = 3/6/custom months. other = custom.';
COMMENT ON COLUMN public.people_records.internship_end_date IS
  'Computed by the app on save (start + duration months). '
  'Stored here for efficient alert sweep queries.';
COMMENT ON COLUMN public.people_records.internship_alert_sent IS
  'Set TRUE after the 1-month-remaining email fires. '
  'Prevents duplicate alerts on repeated sweep runs.';


-- ── 5. users — deal_book_full_access ─────────────────────────────
-- Super Admin grants this per user in admin settings.
-- Users with this flag see full Book of Deals (all staff's deals,
-- amounts, contact details). Super Admin always has this implicitly.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deal_book_full_access BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_deal_book_access
  ON public.users (deal_book_full_access)
  WHERE deal_book_full_access = TRUE;

COMMENT ON COLUMN public.users.deal_book_full_access IS
  'TRUE = can see full Book of Deals (all staff deals, amounts, contacts). '
  'Super Admin always has this; others require explicit grant.';


-- ── 6. opportunities — stage rename + new columns ─────────────────

-- 6a. Add stage_changed_at (needed by Phase 2 staleness detection)
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ DEFAULT NOW();

-- Populate from stage history where available
UPDATE public.opportunities o
SET stage_changed_at = (
  SELECT MAX(sh.changed_at)
  FROM public.opportunity_stage_history sh
  WHERE sh.opportunity_id = o.id
)
WHERE EXISTS (
  SELECT 1 FROM public.opportunity_stage_history sh
  WHERE sh.opportunity_id = o.id
);

-- 6b. Rename stage values to Cerebre workflow labels.
-- Old          → New
-- identified   → introduction
-- in_progress  → proposal
-- proposal_sent → pitch
-- under_review → second_pitch
-- negotiating  → decision
-- won          → onboarded
-- lost_paused  → lost_paused (unchanged)
-- (adding new: 'agreement')

-- Drop the existing stage CHECK constraint first.
-- Find the constraint name dynamically in case it differs:
DO $$
DECLARE
  _constraint_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO _constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
  WHERE tc.table_name = 'opportunities'
    AND cc.check_clause LIKE '%stage%'
  LIMIT 1;

  IF _constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.opportunities DROP CONSTRAINT ' || quote_ident(_constraint_name);
    RAISE NOTICE 'Dropped constraint: %', _constraint_name;
  ELSE
    RAISE NOTICE 'No stage CHECK constraint found — skipping drop.';
  END IF;
END $$;

-- Rename the stage values
UPDATE public.opportunities SET stage = 'introduction'  WHERE stage = 'identified';
UPDATE public.opportunities SET stage = 'proposal'      WHERE stage = 'in_progress';
UPDATE public.opportunities SET stage = 'pitch'         WHERE stage = 'proposal_sent';
UPDATE public.opportunities SET stage = 'second_pitch'  WHERE stage = 'under_review';
UPDATE public.opportunities SET stage = 'decision'      WHERE stage = 'negotiating';
UPDATE public.opportunities SET stage = 'onboarded'     WHERE stage = 'won';
-- 'lost_paused' stays as-is

-- Add the new CHECK constraint with Cerebre workflow stages
ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_stage_check
  CHECK (stage IN (
    'introduction',   -- first contact made
    'proposal',       -- pitch deck being built
    'pitch',          -- deck presented to client
    'second_pitch',   -- follow-up meeting requested
    'decision',       -- client is deciding
    'agreement',      -- SLA signed — triggers brand workspace creation
    'onboarded',      -- brand workspace active in Sabi
    'lost_paused'     -- deal didn't proceed or is on hold
  ));

-- 6c. New columns — contact person
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS contact_name     VARCHAR(120),
  ADD COLUMN IF NOT EXISTS contact_position VARCHAR(120),
  ADD COLUMN IF NOT EXISTS contact_email    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_phone    VARCHAR(32);

-- 6d. New columns — deal structure
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS deal_type     VARCHAR(16),
  ADD COLUMN IF NOT EXISTS service_scope TEXT[],
  ADD COLUMN IF NOT EXISTS industry      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS deck_url      VARCHAR(500);  -- RFP/Brief/Pitch deck Zoho link

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'opportunities'
      AND constraint_name = 'opportunities_deal_type_check'
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_deal_type_check
      CHECK (deal_type IN ('retainer', 'campaign', 'project') OR deal_type IS NULL);
  END IF;
END $$;

-- 6e. New columns — retainer (when deal_type = 'retainer')
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS retainer_monthly_amount  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS retainer_start_date      DATE,
  ADD COLUMN IF NOT EXISTS retainer_duration_months INTEGER;

-- 6f. New columns — campaign (when deal_type = 'campaign')
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS campaign_name         VARCHAR(200),
  ADD COLUMN IF NOT EXISTS campaign_goals        TEXT,
  ADD COLUMN IF NOT EXISTS campaign_start_date   DATE,
  ADD COLUMN IF NOT EXISTS campaign_end_date     DATE,
  ADD COLUMN IF NOT EXISTS campaign_total_amount NUMERIC(15,2);

-- 6g. New columns — attribution (foundation of Book of Deals)
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS business_bringer_id UUID
    REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS account_manager_id UUID
    REFERENCES public.users (id) ON DELETE SET NULL;

-- Indexes for Book of Deals queries
CREATE INDEX IF NOT EXISTS idx_opp_business_bringer
  ON public.opportunities (business_bringer_id)
  WHERE business_bringer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opp_account_manager
  ON public.opportunities (account_manager_id)
  WHERE account_manager_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opp_stage_changed
  ON public.opportunities (stage, stage_changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_opp_deal_type
  ON public.opportunities (deal_type)
  WHERE deal_type IS NOT NULL;

COMMENT ON COLUMN public.opportunities.stage_changed_at IS
  'Timestamp of last stage change. Used for staleness detection in '
  'Command Centre Pipeline dial and Smart Follow-Up Drafts.';
COMMENT ON COLUMN public.opportunities.business_bringer_id IS
  'Who sourced this deal. Core to Book of Deals and the Pursuit Board. '
  'Set automatically when a deal is logged via My Deals.';
COMMENT ON COLUMN public.opportunities.deck_url IS
  'Shareable link to RFP, Brief, or Pitch Deck (ZOHO Drive). '
  'Auto-seeded into first Brand Brief on conversion.';


-- ── 7. agency_targets — goal_category update ─────────────────────
-- Add 'new_business' and 'hr_workforce' to the allowed categories.
-- These feed the Agency Goals master framework.

DO $$
DECLARE
  _constraint_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO _constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
  WHERE tc.table_name = 'agency_targets'
    AND cc.check_clause LIKE '%goal_category%'
  LIMIT 1;

  IF _constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.agency_targets DROP CONSTRAINT '
            || quote_ident(_constraint_name);

    -- Re-add with new categories included
    -- Adjust the existing values below to match your current CHECK constraint
    ALTER TABLE public.agency_targets
      ADD CONSTRAINT agency_targets_goal_category_check
      CHECK (goal_category IN (
        'revenue',
        'client_satisfaction',
        'task_completion',
        'brand_health',
        'staff_performance',
        'new_business',      -- NEW: Book of Deals / Pipeline
        'hr_workforce'       -- NEW: People OS / Support Staff / Vacancies
      ));

    RAISE NOTICE 'agency_targets goal_category constraint updated.';
  ELSE
    RAISE NOTICE 'No goal_category CHECK constraint found on agency_targets — '
                 'add the constraint manually if your schema uses a different approach.';
  END IF;
END $$;


COMMIT;

-- ── Verification queries (run after commit) ───────────────────────

-- 1. Check new tables exist:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN (
--   'support_staff_directory', 'vacancies', 'deal_debriefs'
-- );

-- 2. Check people_records new columns:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'people_records'
--   AND column_name IN (
--     'employment_category','internship_type','internship_duration',
--     'internship_start_date','internship_end_date','internship_alert_sent'
--   );

-- 3. Check users.deal_book_full_access:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name = 'deal_book_full_access';

-- 4. Verify stage rename (should return 0 rows for any old values):
-- SELECT COUNT(*) FROM opportunities
-- WHERE stage IN ('identified','in_progress','proposal_sent',
--                 'under_review','negotiating','won');

-- 5. Check opportunities new columns:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'opportunities'
--   AND column_name IN (
--     'contact_name','deal_type','service_scope','industry',
--     'deck_url','retainer_monthly_amount','campaign_name',
--     'business_bringer_id','account_manager_id','stage_changed_at'
--   );
