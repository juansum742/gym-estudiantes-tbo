CREATE TABLE IF NOT EXISTS admin_sessions_secure (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  origin TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  client_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at INTEGER NOT NULL,
  last_attempt_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_secure_expires_at
  ON admin_sessions_secure (expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_blocked_until
  ON admin_login_attempts (blocked_until);

DELETE FROM admin_sessions;
