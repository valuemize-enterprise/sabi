-- ============================================================
--  SABI INTELLIGENCE SUITE — Full Database Schema
--  A product of Cerebre Media Africa
--  Supabase / PostgreSQL
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- USERS (Agency staff)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'staff',
  department      TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT true,
  must_reset_password BOOLEAN DEFAULT false,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

-- ─────────────────────────────────────────────────────────────
-- BRANDS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,
  industry                  TEXT NOT NULL,
  description               TEXT,
  logo_url                  TEXT,
  website                   TEXT,
  social_handles            JSONB DEFAULT '{}',
  primary_color             TEXT DEFAULT '#6d28d9',
  status                    TEXT DEFAULT 'active',
  account_manager_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  clarity_score             INTEGER DEFAULT 0,
  clarity_score_breakdown   JSONB DEFAULT '{}',
  clarity_score_updated_at  TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brands_status ON brands(status);
CREATE INDEX idx_brands_account_manager ON brands(account_manager_id);

-- ─────────────────────────────────────────────────────────────
-- CLIENTS (Brand portal users)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  job_title       TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT true,
  must_reset_password BOOLEAN DEFAULT true,
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_brand   ON clients(brand_id);
CREATE INDEX idx_clients_email   ON clients(email);

-- ─────────────────────────────────────────────────────────────
-- STAFF BRAND ASSIGNMENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_brand_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  role_on_brand   TEXT DEFAULT 'contributor',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, brand_id)
);

-- ─────────────────────────────────────────────────────────────
-- REPORTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'weekly',
  period_start    DATE,
  period_end      DATE,
  content         JSONB DEFAULT '{}',
  metrics         JSONB DEFAULT '{}',
  narrative       TEXT,
  clarity_score   INTEGER,
  status          TEXT DEFAULT 'draft',
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_brand  ON reports(brand_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_type   ON reports(type);

-- ─────────────────────────────────────────────────────────────
-- GOALS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  metric_type     TEXT NOT NULL,
  target_value    NUMERIC NOT NULL,
  current_value   NUMERIC DEFAULT 0,
  unit            TEXT DEFAULT '#',
  deadline        DATE,
  status          TEXT DEFAULT 'active',
  velocity_score  NUMERIC DEFAULT 0,
  velocity_data   JSONB DEFAULT '{}',
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_goals_brand  ON goals(brand_id);
CREATE INDEX idx_goals_status ON goals(status);

-- ─────────────────────────────────────────────────────────────
-- COMPETITORS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  website         TEXT,
  industry        TEXT,
  social_handles  JSONB DEFAULT '{}',
  depth_view_data JSONB DEFAULT '{}',
  pulse_data      JSONB DEFAULT '{}',
  last_pulse_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competitors_brand ON competitors(brand_id);

-- ─────────────────────────────────────────────────────────────
-- CALENDAR EVENTS (MomentMap™)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID REFERENCES brands(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  event_date          DATE NOT NULL,
  event_type          TEXT NOT NULL DEFAULT 'cultural',
  relevance_score     INTEGER DEFAULT 50,
  ai_recommendation   TEXT,
  is_global           BOOLEAN DEFAULT false,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_brand     ON calendar_events(brand_id);
CREATE INDEX idx_calendar_date      ON calendar_events(event_date);
CREATE INDEX idx_calendar_global    ON calendar_events(is_global);

-- ─────────────────────────────────────────────────────────────
-- TASKS (Proof of Value Engine)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  goal_id             UUID REFERENCES goals(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  assigned_to         UUID REFERENCES users(id) ON DELETE SET NULL,
  status              TEXT DEFAULT 'todo',
  priority            TEXT DEFAULT 'medium',
  due_date            DATE,
  proof_of_value_data JSONB DEFAULT '{}',
  metric_impact       JSONB DEFAULT '{}',
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_brand       ON tasks(brand_id);
CREATE INDEX idx_tasks_goal        ON tasks(goal_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status      ON tasks(status);

-- ─────────────────────────────────────────────────────────────
-- ARIA CHAT SESSIONS (Ask ARIA)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aria_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID REFERENCES brands(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  client_id   UUID REFERENCES clients(id) ON DELETE SET NULL,
  session_type TEXT DEFAULT 'general',
  messages    JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aria_brand  ON aria_sessions(brand_id);
CREATE INDEX idx_aria_client ON aria_sessions(client_id);

-- ─────────────────────────────────────────────────────────────
-- CLARITY SCORE HISTORY
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clarity_score_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL,
  breakdown   JSONB DEFAULT '{}',
  ai_analysis TEXT,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clarity_brand ON clarity_score_history(brand_id);
CREATE INDEX idx_clarity_date  ON clarity_score_history(computed_at);

-- ─────────────────────────────────────────────────────────────
-- AUDIENCE IQ PROFILES (NEW FEATURE)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audience_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  profile_name    TEXT NOT NULL,
  segment_type    TEXT DEFAULT 'primary',
  demographics    JSONB DEFAULT '{}',
  psychographics  JSONB DEFAULT '{}',
  behaviourals    JSONB DEFAULT '{}',
  nigerian_context JSONB DEFAULT '{}',
  ai_insights     TEXT,
  ai_strategy     TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audience_brand ON audience_profiles(brand_id);

-- ─────────────────────────────────────────────────────────────
-- AUDIT LOGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID,
  actor_email     TEXT,
  actor_role      TEXT,
  action          TEXT NOT NULL,
  resource_type   TEXT,
  resource_id     UUID,
  details         JSONB DEFAULT '{}',
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_actor  ON audit_logs(actor_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_date   ON audit_logs(created_at);

-- ─────────────────────────────────────────────────────────────
-- PLATFORM SETTINGS (Super Admin)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  value       JSONB,
  description TEXT,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO platform_settings (key, value, description) VALUES
  ('platform_name', '"Sabi Intelligence Suite"', 'Platform display name'),
  ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
  ('allow_new_registrations', 'true', 'Allow new agency staff registrations'),
  ('max_brands_per_client', '5', 'Max brands a client can be linked to'),
  ('aria_model', '"claude-sonnet-4-6"', 'ARIA AI model to use'),
  ('aria_max_tokens', '2048', 'Max tokens for ARIA responses'),
  ('clarity_score_refresh_hours', '24', 'Hours between ClarityScore recalculations')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER FUNCTION
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER trg_users_updated_at         BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_brands_updated_at        BEFORE UPDATE ON brands          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated_at       BEFORE UPDATE ON clients         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reports_updated_at       BEFORE UPDATE ON reports         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_goals_updated_at         BEFORE UPDATE ON goals           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_competitors_updated_at   BEFORE UPDATE ON competitors     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated_at         BEFORE UPDATE ON tasks           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_aria_sessions_updated_at BEFORE UPDATE ON aria_sessions   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_audience_updated_at      BEFORE UPDATE ON audience_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) — Supabase
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE aria_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Backend service role bypasses RLS (used by Express backend with service_role key)
-- All access goes through our authenticated Express backend, not direct Supabase SDK from client
