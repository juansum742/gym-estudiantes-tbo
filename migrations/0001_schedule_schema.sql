CREATE TABLE IF NOT EXISTS custom_time_slots (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  start_minutes INTEGER NOT NULL,
  end_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_disciplines (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  accent TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 999,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  weekday_key TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  discipline_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedules_weekday_slot
  ON schedules (weekday_key, slot_key, discipline_key);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
  ON admin_sessions (expires_at);

INSERT OR IGNORE INTO schedules (id, weekday_key, slot_key, discipline_key, created_at, updated_at) VALUES
  ('default-lunes-funcional-0800-0900', 'lunes', '08:00-09:00', 'funcional', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-miercoles-funcional-0800-0900', 'miercoles', '08:00-09:00', 'funcional', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-viernes-funcional-0800-0900', 'viernes', '08:00-09:00', 'funcional', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-martes-indoor-0815-0900', 'martes', '08:15-09:00', 'indoor', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-jueves-indoor-0815-0900', 'jueves', '08:15-09:00', 'indoor', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-martes-kickboxing-1800-1900', 'martes', '18:00-19:00', 'kickboxing', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-jueves-kickboxing-1800-1900', 'jueves', '18:00-19:00', 'kickboxing', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-lunes-indoor-1900-1945', 'lunes', '19:00-19:45', 'indoor', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-miercoles-indoor-1900-1945', 'miercoles', '19:00-19:45', 'indoor', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-viernes-indoor-1900-1945', 'viernes', '19:00-19:45', 'indoor', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-lunes-funcional-2000-2100', 'lunes', '20:00-21:00', 'funcional', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-miercoles-funcional-2000-2100', 'miercoles', '20:00-21:00', 'funcional', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-viernes-funcional-2000-2100', 'viernes', '20:00-21:00', 'funcional', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-martes-fullgap-2000-2100', 'martes', '20:00-21:00', 'fullgap', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z'),
  ('default-jueves-fullgap-2000-2100', 'jueves', '20:00-21:00', 'fullgap', '2026-04-13T00:00:00.000Z', '2026-04-13T00:00:00.000Z');
