CREATE TABLE IF NOT EXISTS admin_security_questions (
  question_key TEXT PRIMARY KEY,
  question_label TEXT NOT NULL,
  answer_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_recovery_attempts (
  client_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at INTEGER NOT NULL,
  last_attempt_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_recovery_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  origin TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_recovery_attempts_blocked_until
  ON admin_recovery_attempts (blocked_until);

CREATE INDEX IF NOT EXISTS idx_admin_recovery_sessions_expires_at
  ON admin_recovery_sessions (expires_at);
