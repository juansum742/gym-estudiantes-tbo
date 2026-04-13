import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import "../schedule-core.js";

const core = globalThis.EstudiantesTboScheduleCore;

if (!core) {
  throw new Error("No encontramos la lógica compartida de horarios.");
}

const textEncoder = new TextEncoder();
const SESSION_TTL_MS = 1000 * 60 * 60 * 4;
const LOGIN_WINDOW_MS = 1000 * 60 * 10;
const LOGIN_BLOCK_MS = 1000 * 60 * 15;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_JSON_BODY_BYTES = 4096;
const MIN_PASSWORD_HASH_ITERATIONS = 60000;
const MAX_PASSWORD_HASH_ITERATIONS = 100000;
const PASSWORD_HASH_PREFIX = "pbkdf2_sha256";
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/json; charset=utf-8",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function getAllowedOrigins(env) {
  const origins = String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!origins.length) {
    throw new HttpError(503, "La configuración de seguridad del servidor está incompleta.");
  }

  return origins;
}

function buildCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function resolveResponseOrigin(request, env, options = {}) {
  const requestOrigin = String(request.headers.get("Origin") || "").trim();
  const allowedOrigins = getAllowedOrigins(env);

  if (!requestOrigin) {
    if (options.requireOrigin) {
      throw new HttpError(403, "No autorizado.");
    }

    return allowedOrigins[0];
  }

  if (!allowedOrigins.includes(requestOrigin)) {
    throw new HttpError(403, "No autorizado.");
  }

  return requestOrigin;
}

function jsonResponse(payload, { status = 200, origin } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...RESPONSE_HEADERS,
      ...buildCorsHeaders(origin),
    },
  });
}

function getDb(env) {
  if (!env.DB) {
    throw new HttpError(503, "La configuración de seguridad del servidor está incompleta.");
  }

  return env.DB;
}

function getRequiredSecret(env, keyName) {
  const value = String(env[keyName] || "").trim();

  if (!value) {
    throw new HttpError(503, "La configuración de seguridad del servidor está incompleta.");
  }

  return value;
}

function toBase64Url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return new Uint8Array(Buffer.from(padded, "base64"));
}

function constantTimeEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

async function sha256Bytes(value) {
  const buffer = typeof value === "string" ? textEncoder.encode(value) : value;
  return new Uint8Array(createHash("sha256").update(Buffer.from(buffer)).digest());
}

async function hashWithPepper(value, pepper) {
  return toBase64Url(await sha256Bytes(`${pepper}:${value}`));
}

function parsePasswordHashRecord(record) {
  const [algorithm, iterationsRaw, saltRaw, hashRaw] = String(record || "").split("$");
  const iterations = Number(iterationsRaw);

  if (
    algorithm !== PASSWORD_HASH_PREFIX
    || !Number.isInteger(iterations)
    || iterations < MIN_PASSWORD_HASH_ITERATIONS
    || iterations > MAX_PASSWORD_HASH_ITERATIONS
    || !saltRaw
    || !hashRaw
  ) {
    throw new HttpError(503, "La configuración de seguridad del servidor está incompleta.");
  }

  return {
    iterations,
    salt: fromBase64Url(saltRaw),
    hash: fromBase64Url(hashRaw),
  };
}

async function derivePasswordHash(password, saltBytes, iterations) {
  return new Uint8Array(pbkdf2Sync(password, Buffer.from(saltBytes), iterations, 32, "sha256"));
}

async function verifyPassword(inputPassword, passwordHashRecord) {
  const normalizedPassword = String(inputPassword || "").trim();

  if (!normalizedPassword || normalizedPassword.length > 128) {
    return false;
  }

  const parsedHash = parsePasswordHashRecord(passwordHashRecord);
  const derivedHash = await derivePasswordHash(normalizedPassword, parsedHash.salt, parsedHash.iterations);

  return constantTimeEqual(derivedHash, parsedHash.hash);
}

function readRequestBodySize(request) {
  const rawHeader = request.headers.get("Content-Length");
  const contentLength = Number(rawHeader || "0");
  return Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0;
}

async function readJson(request) {
  if (readRequestBodySize(request) > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, "La solicitud es demasiado grande.");
  }

  if (!request.body) {
    return {};
  }

  try {
    return await request.json();
  } catch (error) {
    throw new HttpError(400, "No pudimos leer el contenido enviado.");
  }
}

function createOpaqueToken() {
  return toBase64Url(randomBytes(32));
}

function readBearerToken(request) {
  const authorization = String(request.headers.get("Authorization") || "");

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim().slice(0, 256);
}

function getClientIp(request) {
  const headerValue = String(
    request.headers.get("CF-Connecting-IP")
    || request.headers.get("X-Forwarded-For")
    || request.headers.get("X-Real-IP")
    || ""
  );

  return headerValue.split(",")[0].trim() || "unknown";
}

async function getClientKey(request, env) {
  const pepper = getRequiredSecret(env, "AUTH_PEPPER");
  const origin = String(request.headers.get("Origin") || "").trim();
  const userAgent = String(request.headers.get("User-Agent") || "").trim();
  const fingerprint = `${getClientIp(request)}|${origin}|${userAgent}`;
  return hashWithPepper(fingerprint, pepper);
}

async function getUserAgentHash(request, env) {
  const pepper = getRequiredSecret(env, "AUTH_PEPPER");
  const userAgent = String(request.headers.get("User-Agent") || "").trim();
  return hashWithPepper(userAgent, pepper);
}

async function getSessionTokenHash(rawToken, env) {
  const pepper = getRequiredSecret(env, "AUTH_PEPPER");
  return hashWithPepper(rawToken, pepper);
}

function getSessionTtl(env) {
  const configuredValue = Number(env.ADMIN_SESSION_TTL_MS || SESSION_TTL_MS);
  return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : SESSION_TTL_MS;
}

async function cleanupExpiredSessions(db) {
  await db.prepare("DELETE FROM admin_sessions_secure WHERE expires_at <= ?").bind(Date.now()).run();
}

async function cleanupExpiredLoginAttempts(db) {
  const cutoff = Date.now() - LOGIN_WINDOW_MS;
  await db.prepare("DELETE FROM admin_login_attempts WHERE blocked_until <= ? AND last_attempt_at <= ?").bind(Date.now(), cutoff).run();
}

async function assertLoginAllowed(db, clientKey) {
  const row = await db
    .prepare(`
      SELECT attempts, blocked_until
      FROM admin_login_attempts
      WHERE client_key = ?
      LIMIT 1
    `)
    .bind(clientKey)
    .first();

  if (row && Number(row.blocked_until) > Date.now()) {
    throw new HttpError(429, "Demasiados intentos. Esperá unos minutos y volvé a probar.");
  }
}

async function recordLoginFailure(db, clientKey) {
  const now = Date.now();
  const existingRow = await db
    .prepare(`
      SELECT attempts, first_attempt_at, blocked_until
      FROM admin_login_attempts
      WHERE client_key = ?
      LIMIT 1
    `)
    .bind(clientKey)
    .first();

  const withinWindow = existingRow && now - Number(existingRow.first_attempt_at) <= LOGIN_WINDOW_MS;
  const attempts = withinWindow ? Number(existingRow.attempts) + 1 : 1;
  const firstAttemptAt = withinWindow ? Number(existingRow.first_attempt_at) : now;
  const blockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_BLOCK_MS : 0;

  await db
    .prepare(`
      INSERT INTO admin_login_attempts (client_key, attempts, first_attempt_at, last_attempt_at, blocked_until)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(client_key) DO UPDATE SET
        attempts = excluded.attempts,
        first_attempt_at = excluded.first_attempt_at,
        last_attempt_at = excluded.last_attempt_at,
        blocked_until = excluded.blocked_until
    `)
    .bind(clientKey, attempts, firstAttemptAt, now, blockedUntil)
    .run();
}

async function clearLoginAttempts(db, clientKey) {
  await db.prepare("DELETE FROM admin_login_attempts WHERE client_key = ?").bind(clientKey).run();
}

async function createAdminSession(db, request, env) {
  const rawToken = createOpaqueToken();
  const tokenHash = await getSessionTokenHash(rawToken, env);
  const userAgentHash = await getUserAgentHash(request, env);
  const origin = resolveResponseOrigin(request, env, { requireOrigin: true });
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = now + getSessionTtl(env);

  await db
    .prepare(`
      INSERT INTO admin_sessions_secure (token_hash, expires_at, created_at, last_seen_at, origin, user_agent_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(tokenHash, expiresAt, nowIso, nowIso, origin, userAgentHash)
    .run();

  return rawToken;
}

async function invalidateSession(db, tokenHash) {
  if (!tokenHash) {
    return;
  }

  await db.prepare("DELETE FROM admin_sessions_secure WHERE token_hash = ?").bind(tokenHash).run();
}

async function requireAdminSession(request, env) {
  const origin = resolveResponseOrigin(request, env, { requireOrigin: true });
  const rawToken = readBearerToken(request);

  if (!rawToken) {
    throw new HttpError(401, "No autorizado.");
  }

  const db = getDb(env);
  await cleanupExpiredSessions(db);

  const tokenHash = await getSessionTokenHash(rawToken, env);
  const session = await db
    .prepare(`
      SELECT token_hash, expires_at, origin, user_agent_hash
      FROM admin_sessions_secure
      WHERE token_hash = ?
      LIMIT 1
    `)
    .bind(tokenHash)
    .first();

  if (!session || Number(session.expires_at) <= Date.now()) {
    await invalidateSession(db, tokenHash);
    throw new HttpError(401, "No autorizado.");
  }

  const expectedUserAgentHash = await getUserAgentHash(request, env);
  const currentUserAgentHash = textEncoder.encode(String(expectedUserAgentHash));
  const storedUserAgentHash = textEncoder.encode(String(session.user_agent_hash || ""));

  if (!constantTimeEqual(currentUserAgentHash, storedUserAgentHash) || String(session.origin || "") !== origin) {
    await invalidateSession(db, tokenHash);
    throw new HttpError(401, "No autorizado.");
  }

  const nextExpiresAt = Date.now() + getSessionTtl(env);

  await db
    .prepare(`
      UPDATE admin_sessions_secure
      SET expires_at = ?, last_seen_at = ?
      WHERE token_hash = ?
    `)
    .bind(nextExpiresAt, new Date().toISOString(), tokenHash)
    .run();

  return { tokenHash, origin };
}

async function readStateFromDb(db) {
  const results = await db.batch([
    db.prepare(`
      SELECT key, label, start_minutes, end_minutes, created_at
      FROM custom_time_slots
      ORDER BY start_minutes ASC, end_minutes ASC, label ASC
    `),
    db.prepare(`
      SELECT key, label, accent, order_index, created_at
      FROM custom_disciplines
      ORDER BY order_index ASC, label ASC
    `),
    db.prepare(`
      SELECT id, weekday_key, slot_key, discipline_key, created_at, updated_at
      FROM schedules
      ORDER BY weekday_key ASC, slot_key ASC, discipline_key ASC
    `),
  ]);

  const customTimeSlots = (results[0]?.results || []).map((slot) => ({
    key: slot.key,
    label: slot.label,
    startMinutes: Number(slot.start_minutes),
    endMinutes: Number(slot.end_minutes),
    createdAt: slot.created_at,
  }));

  const customDisciplines = (results[1]?.results || []).map((discipline) => ({
    key: discipline.key,
    label: discipline.label,
    accent: discipline.accent,
    order: Number(discipline.order_index),
    createdAt: discipline.created_at,
  }));

  const schedules = (results[2]?.results || []).map((schedule) => ({
    id: schedule.id,
    weekdayKey: schedule.weekday_key,
    slotKey: schedule.slot_key,
    disciplineKey: schedule.discipline_key,
    createdAt: schedule.created_at,
    updatedAt: schedule.updated_at,
  }));

  return core.sanitizeState({
    version: 2,
    customTimeSlots,
    customDisciplines,
    schedules,
  });
}

function pruneUnusedCustomMeta(sourceState) {
  const state = core.sanitizeState({
    version: 2,
    customTimeSlots: sourceState.customTimeSlots,
    customDisciplines: sourceState.customDisciplines,
    schedules: sourceState.schedules,
  });
  const usedSlotKeys = new Set((state.schedules || []).map((schedule) => schedule.slotKey));
  const usedDisciplineKeys = new Set((state.schedules || []).map((schedule) => schedule.disciplineKey));

  return {
    ...state,
    customTimeSlots: state.customTimeSlots.filter((slot) => usedSlotKeys.has(slot.key)),
    customDisciplines: state.customDisciplines.filter((discipline) => usedDisciplineKeys.has(discipline.key)),
  };
}

async function persistState(db, sourceState) {
  const state = pruneUnusedCustomMeta(sourceState);

  const statements = [
    db.prepare("DELETE FROM schedules"),
    db.prepare("DELETE FROM custom_time_slots"),
    db.prepare("DELETE FROM custom_disciplines"),
  ];

  for (const slot of state.customTimeSlots) {
    statements.push(
      db
        .prepare(`
          INSERT INTO custom_time_slots (key, label, start_minutes, end_minutes, created_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(slot.key, slot.label, slot.startMinutes, slot.endMinutes, slot.createdAt || new Date().toISOString())
    );
  }

  for (const discipline of state.customDisciplines) {
    statements.push(
      db
        .prepare(`
          INSERT INTO custom_disciplines (key, label, accent, order_index, created_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          discipline.key,
          discipline.label,
          discipline.accent || "accent",
          Number(discipline.order || 999),
          discipline.createdAt || new Date().toISOString()
        )
    );
  }

  for (const schedule of state.schedules) {
    statements.push(
      db
        .prepare(`
          INSERT INTO schedules (id, weekday_key, slot_key, discipline_key, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          schedule.id,
          schedule.weekdayKey,
          schedule.slotKey,
          schedule.disciplineKey,
          schedule.createdAt || new Date().toISOString(),
          schedule.updatedAt || new Date().toISOString()
        )
    );
  }

  await db.batch(statements);
  return state;
}

async function handleSchedulesGet(request, env) {
  const origin = resolveResponseOrigin(request, env);
  const state = await readStateFromDb(getDb(env));

  return jsonResponse(
    {
      state,
      stats: core.getStats(state),
      mode: "cloudflare-d1",
    },
    { origin }
  );
}

async function handleLogin(request, env) {
  const origin = resolveResponseOrigin(request, env, { requireOrigin: true });
  const body = await readJson(request);
  const candidatePassword = String(body?.pin || "").trim();
  const db = getDb(env);
  const clientKey = await getClientKey(request, env);

  await cleanupExpiredLoginAttempts(db);
  await assertLoginAllowed(db, clientKey);

  const passwordHashRecord = getRequiredSecret(env, "ADMIN_PASSWORD_HASH");
  const isValidPassword = await verifyPassword(candidatePassword, passwordHashRecord);

  if (!isValidPassword) {
    await recordLoginFailure(db, clientKey);
    return jsonResponse(
      {
        error: "Credenciales inválidas.",
      },
      { status: 401, origin }
    );
  }

  await clearLoginAttempts(db, clientKey);
  await cleanupExpiredSessions(db);

  const token = await createAdminSession(db, request, env);
  const state = await readStateFromDb(db);

  return jsonResponse(
    {
      token,
      state,
    },
    { origin }
  );
}

async function handleSession(request, env) {
  const origin = resolveResponseOrigin(request, env, { requireOrigin: true });
  await requireAdminSession(request, env);
  const state = await readStateFromDb(getDb(env));

  return jsonResponse(
    {
      state,
      authenticated: true,
    },
    { origin }
  );
}

async function handleLogout(request, env) {
  const origin = resolveResponseOrigin(request, env, { requireOrigin: true });
  const rawToken = readBearerToken(request);

  if (!rawToken) {
    return jsonResponse({ ok: true }, { origin });
  }

  const db = getDb(env);
  const tokenHash = await getSessionTokenHash(rawToken, env);
  await invalidateSession(db, tokenHash);

  return jsonResponse({ ok: true }, { origin });
}

async function handleScheduleCreate(request, env) {
  const origin = resolveResponseOrigin(request, env, { requireOrigin: true });
  await requireAdminSession(request, env);
  const db = getDb(env);
  const body = await readJson(request);
  const currentState = await readStateFromDb(db);
  let result;

  try {
    result = core.createSchedule(currentState, body);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "No pudimos guardar el horario.");
  }

  const nextState = await persistState(db, result.state);
  const schedule = core.getScheduleById(nextState, result.schedule?.id);

  return jsonResponse(
    {
      state: nextState,
      schedule,
    },
    { status: 201, origin }
  );
}

async function handleScheduleUpdate(request, env, scheduleId) {
  const origin = resolveResponseOrigin(request, env, { requireOrigin: true });
  await requireAdminSession(request, env);
  const db = getDb(env);
  const body = await readJson(request);
  const currentState = await readStateFromDb(db);
  let result;

  try {
    result = core.updateSchedule(currentState, scheduleId, body);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "No pudimos editar el horario.");
  }

  const nextState = await persistState(db, result.state);
  const schedule = core.getScheduleById(nextState, result.schedule?.id || scheduleId);

  return jsonResponse(
    {
      state: nextState,
      schedule,
    },
    { origin }
  );
}

async function handleScheduleDelete(request, env, scheduleId) {
  const origin = resolveResponseOrigin(request, env, { requireOrigin: true });
  await requireAdminSession(request, env);
  const db = getDb(env);
  const currentState = await readStateFromDb(db);
  let result;

  try {
    result = core.deleteSchedule(currentState, scheduleId);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "No pudimos eliminar el horario.");
  }

  const nextState = await persistState(db, result.state);

  return jsonResponse(
    {
      state: nextState,
      schedule: result.schedule,
    },
    { origin }
  );
}

async function routeRequest(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "OPTIONS") {
    const origin = resolveResponseOrigin(request, env);
    return new Response(null, {
      status: 204,
      headers: {
        ...buildCorsHeaders(origin),
        "Cache-Control": "no-store",
      },
    });
  }

  if (pathname === "/api/health" && request.method === "GET") {
    const origin = resolveResponseOrigin(request, env);
    return jsonResponse(
      {
        ok: true,
        mode: "cloudflare-d1",
        timestamp: new Date().toISOString(),
      },
      { origin }
    );
  }

  if (pathname === "/api/schedules" && request.method === "GET") {
    return handleSchedulesGet(request, env);
  }

  if (pathname === "/api/admin/login" && request.method === "POST") {
    return handleLogin(request, env);
  }

  if (pathname === "/api/admin/session" && request.method === "GET") {
    return handleSession(request, env);
  }

  if (pathname === "/api/admin/logout" && request.method === "POST") {
    return handleLogout(request, env);
  }

  if (pathname === "/api/schedules" && request.method === "POST") {
    return handleScheduleCreate(request, env);
  }

  if (pathname.startsWith("/api/schedules/")) {
    const scheduleId = decodeURIComponent(pathname.slice("/api/schedules/".length)).trim();

    if (!scheduleId) {
      const origin = resolveResponseOrigin(request, env, { requireOrigin: true });
      return jsonResponse(
        {
          error: "No recibimos el identificador del horario.",
        },
        { status: 400, origin }
      );
    }

    if (request.method === "PUT") {
      return handleScheduleUpdate(request, env, scheduleId);
    }

    if (request.method === "DELETE") {
      return handleScheduleDelete(request, env, scheduleId);
    }
  }

  const origin = resolveResponseOrigin(request, env);
  return jsonResponse(
    {
      error: "No encontramos ese endpoint.",
    },
    { status: 404, origin }
  );
}

export default {
  async fetch(request, env) {
    try {
      return await routeRequest(request, env);
    } catch (error) {
      const origin = (() => {
        try {
          return resolveResponseOrigin(request, env);
        } catch (responseOriginError) {
          return getAllowedOrigins(env)[0];
        }
      })();
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError
        ? error.message
        : "No pudimos procesar la solicitud.";

      return jsonResponse({ error: message }, { status, origin });
    }
  },
};
