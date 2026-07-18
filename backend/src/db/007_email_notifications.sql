-- ═══════════════════════════════════════════════════════════════
-- Migration 007 — Email Notification Engine
-- Sabi Intelligence Suite · Cerebre Media Africa
--
-- Two tables:
--   email_log          → every email sent, with a dedupe_key so the
--                        sweeper can nag "until done" WITHOUT spamming
--   email_preferences  → per-user opt-outs by category
--                        (critical + disciplinary emails ignore these)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,                          -- FK users.id (nullable: client contacts)
  email_address VARCHAR(255) NOT NULL,
  email_type    VARCHAR(64)  NOT NULL,         -- e.g. 'task_overdue'
  entity_id     UUID,                          -- the task/brief/strategy this is about
  level         SMALLINT     NOT NULL DEFAULT 1, -- escalation level (1,2,3…)
  dedupe_key    VARCHAR(255) NOT NULL,         -- uniqueness contract, see below
  subject       VARCHAR(255),
  status        VARCHAR(16)  NOT NULL DEFAULT 'sent', -- sent | failed | skipped
  resend_id     VARCHAR(64),
  metadata      JSONB        DEFAULT '{}',
  sent_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Dedupe contract (enforced here, built in email-dispatch.service.js):
--   One-shot events   → "<type>:<entity_id>"                 (sent once, ever)
--   Escalations       → "<type>:<entity_id>:L<level>"        (each level once)
--   Daily recurrences → "<type>:<user_id>:<YYYY-MM-DD>"      (once per day)
--   Weekly recurrences→ "<type>:<user_id>:<ISO week>"        (once per week)
CREATE UNIQUE INDEX IF NOT EXISTS email_log_dedupe_uq ON email_log (dedupe_key);
CREATE INDEX IF NOT EXISTS email_log_user_idx   ON email_log (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS email_log_type_idx   ON email_log (email_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS email_log_entity_idx ON email_log (entity_id);

CREATE TABLE IF NOT EXISTS email_preferences (
  user_id    UUID NOT NULL,
  category   VARCHAR(32) NOT NULL,   -- tasks | scores | briefs | financial | digests | celebrations
  enabled    BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

-- Categories that can NEVER be muted (documented, enforced in code):
--   'critical'      → client satisfaction alerts, security/audit alerts
--   'disciplinary'  → level-3 escalations
COMMENT ON TABLE email_preferences IS
  'Per-user email category opt-outs. critical + disciplinary categories bypass preferences by design.';
