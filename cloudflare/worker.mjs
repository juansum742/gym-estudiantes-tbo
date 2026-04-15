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
const MIN_ADMIN_PASSWORD_LENGTH = 7;
const MAX_ADMIN_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_HASH_ITERATIONS = 60000;
const MAX_PASSWORD_HASH_ITERATIONS = 100000;
const DEFAULT_PASSWORD_HASH_ITERATIONS = 100000;
const PASSWORD_HASH_PREFIX = "pbkdf2_sha256";
const PASSWORD_HASH_PREFIX_PEPPERED = "pbkdf2_sha256_peppered";
const SESSION_COOKIE_NAME = "__Secure-estudiantes_tbo_admin";
const SESSION_COOKIE_PATH = "/api";
const API_RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/json; charset=utf-8",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "same-site",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};
const STATIC_SHARED_HEADERS = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "same-site",
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()",
};
const HTML_SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-src https://www.google.com https://maps.google.com",
    "upgrade-insecure-requests",
  ].join("; "),
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getRequestUrl(request) {
  return new URL(request.url);
}

function getRequestOrigin(request) {
  return getRequestUrl(request).origin;
}

function getOriginHeader(request) {
  return String(request.headers.get("Origin") || "").trim();
}

function getSecFetchSite(request) {
  return String(request.headers.get("Sec-Fetch-Site") || "").trim().toLowerCase();
}

function resolvePublicCorsOrigin(request, env) {
  const requestOrigin = getOriginHeader(request);
  const requestSiteOrigin = getRequestOrigin(request);

  if (!requestOrigin) {
    return null;
  }

  if (requestOrigin === requestSiteOrigin) {
    return requestOrigin;
  }

  if (getAllowedOrigins(env).includes(requestOrigin)) {
    return requestOrigin;
  }

  throw new HttpError(403, "No autorizado.");
}

function assertSameOriginRead(request) {
  const requestOrigin = getOriginHeader(request);
  const requestSiteOrigin = getRequestOrigin(request);
  const secFetchSite = getSecFetchSite(request);

  if (requestOrigin && requestOrigin !== requestSiteOrigin) {
    throw new HttpError(403, "No autorizado.");
  }

  if (secFetchSite && !["same-origin", "same-site", "none", "empty"].includes(secFetchSite)) {
    throw new HttpError(403, "No autorizado.");
  }

  return requestSiteOrigin;
}

function assertTrustedWriteRequest(request) {
  const requestOrigin = getOriginHeader(request);
  const requestSiteOrigin = getRequestOrigin(request);
  const secFetchSite = getSecFetchSite(request);

  if (!requestOrigin || requestOrigin !== requestSiteOrigin) {
    throw new HttpError(403, "No autorizado.");
  }

  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    throw new HttpError(403, "No autorizado.");
  }

  return requestSiteOrigin;
}

function buildCorsHeaders(origin, { allowCredentials = false } = {}) {
  if (!origin) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    ...(allowCredentials ? { "Access-Control-Allow-Credentials": "true" } : {}),
    Vary: "Origin",
  };
}

function jsonResponse(payload, { status = 200, corsOrigin = null, allowCredentials = false, setCookie } = {}) {
  const headers = new Headers({
    ...API_RESPONSE_HEADERS,
    ...buildCorsHeaders(corsOrigin, { allowCredentials }),
  });

  if (setCookie) {
    headers.append("Set-Cookie", setCookie);
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers,
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
    ![PASSWORD_HASH_PREFIX, PASSWORD_HASH_PREFIX_PEPPERED].includes(algorithm)
    || !Number.isInteger(iterations)
    || iterations < MIN_PASSWORD_HASH_ITERATIONS
    || iterations > MAX_PASSWORD_HASH_ITERATIONS
    || !saltRaw
    || !hashRaw
  ) {
    throw new HttpError(503, "La configuración de seguridad del servidor está incompleta.");
  }

  return {
    algorithm,
    iterations,
    salt: fromBase64Url(saltRaw),
    hash: fromBase64Url(hashRaw),
  };
}

async function derivePasswordHash(password, saltBytes, iterations) {
  return new Uint8Array(pbkdf2Sync(password, Buffer.from(saltBytes), iterations, 32, "sha256"));
}

function normalizePasswordInput(inputPassword) {
  return String(inputPassword || "").trim();
}

function validatePasswordStrength(password) {
  const normalizedPassword = normalizePasswordInput(password);

  if (normalizedPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `La nueva clave debe tener al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres.`);
  }

  if (normalizedPassword.length > MAX_ADMIN_PASSWORD_LENGTH) {
    throw new HttpError(400, "La nueva clave es demasiado larga.");
  }

  if (!/[A-Za-z]/.test(normalizedPassword) || !/[0-9]/.test(normalizedPassword)) {
    throw new HttpError(400, "La nueva clave debe combinar letras y números.");
  }

  return normalizedPassword;
}

async function buildPasswordHashRecord(password, env, { peppered = true } = {}) {
  const normalizedPassword = validatePasswordStrength(password);
  const salt = randomBytes(16);
  const pepper = peppered ? getRequiredSecret(env, "AUTH_PEPPER") : "";
  const material = peppered ? `${pepper}:${normalizedPassword}` : normalizedPassword;
  const hash = await derivePasswordHash(material, salt, DEFAULT_PASSWORD_HASH_ITERATIONS);
  const algorithm = peppered ? PASSWORD_HASH_PREFIX_PEPPERED : PASSWORD_HASH_PREFIX;

  return `${algorithm}$${DEFAULT_PASSWORD_HASH_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

async function verifyPassword(inputPassword, passwordHashRecord, env) {
  const normalizedPassword = normalizePasswordInput(inputPassword);

  if (!normalizedPassword || normalizedPassword.length > MAX_ADMIN_PASSWORD_LENGTH) {
    return false;
  }

  const parsedHash = parsePasswordHashRecord(passwordHashRecord);
  const pepper = parsedHash.algorithm === PASSWORD_HASH_PREFIX_PEPPERED
    ? getRequiredSecret(env, "AUTH_PEPPER")
    : "";
  const material = parsedHash.algorithm === PASSWORD_HASH_PREFIX_PEPPERED
    ? `${pepper}:${normalizedPassword}`
    : normalizedPassword;
  const derivedHash = await derivePasswordHash(material, parsedHash.salt, parsedHash.iterations);

  return constantTimeEqual(derivedHash, parsedHash.hash);
}

async function readAdminPasswordHashRecord(db, env) {
  try {
    const row = await db
      .prepare(`
        SELECT password_hash
        FROM admin_credentials
        WHERE id = 1
        LIMIT 1
      `)
      .first();

    return String(row?.password_hash || "").trim() || getRequiredSecret(env, "ADMIN_PASSWORD_HASH");
  } catch (error) {
    if (String(error?.message || "").includes("no such table: admin_credentials")) {
      return getRequiredSecret(env, "ADMIN_PASSWORD_HASH");
    }

    throw error;
  }
}

async function persistAdminPasswordHashRecord(db, passwordHashRecord) {
  const timestamp = new Date().toISOString();

  await db
    .prepare(`
      CREATE TABLE IF NOT EXISTS admin_credentials (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    .run();

  await db
    .prepare(`
      INSERT INTO admin_credentials (id, password_hash, created_at, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        password_hash = excluded.password_hash,
        updated_at = excluded.updated_at
    `)
    .bind(passwordHashRecord, timestamp, timestamp)
    .run();
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

function parseCookies(request) {
  const cookieHeader = String(request.headers.get("Cookie") || "");
  const entries = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const cookies = new Map();

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    cookies.set(key, value);
  }

  return cookies;
}

function readSessionCookie(request) {
  return parseCookies(request).get(SESSION_COOKIE_NAME) || "";
}

function buildSessionCookie(token, env) {
  const maxAgeSeconds = Math.max(1, Math.floor(getSessionTtl(env) / 1000));

  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    `Max-Age=${maxAgeSeconds}`,
    `Path=${SESSION_COOKIE_PATH}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

function buildClearSessionCookie() {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    `Path=${SESSION_COOKIE_PATH}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
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
  const siteOrigin = getRequestOrigin(request);
  const userAgent = String(request.headers.get("User-Agent") || "").trim();
  const fingerprint = `${getClientIp(request)}|${siteOrigin}|${userAgent}`;
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
  const siteOrigin = getRequestOrigin(request);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = now + getSessionTtl(env);

  await db
    .prepare(`
      INSERT INTO admin_sessions_secure (token_hash, expires_at, created_at, last_seen_at, origin, user_agent_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(tokenHash, expiresAt, nowIso, nowIso, siteOrigin, userAgentHash)
    .run();

  return rawToken;
}

async function invalidateSession(db, tokenHash) {
  if (!tokenHash) {
    return;
  }

  await db.prepare("DELETE FROM admin_sessions_secure WHERE token_hash = ?").bind(tokenHash).run();
}

async function invalidateAllSessions(db) {
  await db.prepare("DELETE FROM admin_sessions_secure").run();
}

async function requireAdminSession(request, env) {
  const rawToken = readSessionCookie(request);

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

  if (
    !constantTimeEqual(currentUserAgentHash, storedUserAgentHash)
    || String(session.origin || "") !== getRequestOrigin(request)
  ) {
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

  return { tokenHash };
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

function decorateStaticResponse(request, response) {
  if (!response || response.status >= 400 || response.status === 304) {
    return response;
  }

  const url = getRequestUrl(request);
  const pathname = url.pathname;
  const isAdminPage = pathname === "/admin" || pathname === "/admin.html";
  const headers = new Headers(response.headers);
  const contentType = String(headers.get("content-type") || "");
  const isHtml = contentType.includes("text/html");

  Object.entries(STATIC_SHARED_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  if (isHtml) {
    Object.entries(HTML_SECURITY_HEADERS).forEach(([key, value]) => {
      headers.set(key, value);
    });

    headers.set("Cache-Control", isAdminPage ? "no-store" : "no-cache");

    if (isAdminPage) {
      headers.set("X-Robots-Tag", "noindex, nofollow");
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function serveStaticAsset(request, env) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    throw new HttpError(503, "Los assets públicos del sitio no están configurados.");
  }

  const url = getRequestUrl(request);

  if (url.pathname === "/home") {
    return Response.redirect(`${url.origin}/`, 302);
  }

  const assetResponse = await env.ASSETS.fetch(request);
  return decorateStaticResponse(request, assetResponse);
}

async function handleSchedulesGet(request, env) {
  const corsOrigin = resolvePublicCorsOrigin(request, env);
  const state = await readStateFromDb(getDb(env));

  return jsonResponse(
    {
      state,
      stats: core.getStats(state),
      mode: "cloudflare-d1",
    },
    { corsOrigin }
  );
}

async function handleLogin(request, env) {
  const corsOrigin = getRequestOrigin(request);
  assertTrustedWriteRequest(request);
  const body = await readJson(request);
  const candidatePassword = String(body?.pin || body?.password || "").trim();
  const db = getDb(env);
  const clientKey = await getClientKey(request, env);

  await cleanupExpiredLoginAttempts(db);
  await assertLoginAllowed(db, clientKey);

  const passwordHashRecord = await readAdminPasswordHashRecord(db, env);
  const isValidPassword = await verifyPassword(candidatePassword, passwordHashRecord, env);

  if (!isValidPassword) {
    await recordLoginFailure(db, clientKey);
    return jsonResponse(
      {
        error: "Credenciales inválidas.",
      },
      { status: 401, corsOrigin }
    );
  }

  await clearLoginAttempts(db, clientKey);
  await cleanupExpiredSessions(db);

  const token = await createAdminSession(db, request, env);
  const state = await readStateFromDb(db);

  return jsonResponse(
    {
      authenticated: true,
      state,
    },
    {
      corsOrigin,
      setCookie: buildSessionCookie(token, env),
    }
  );
}

async function handlePasswordChange(request, env) {
  const corsOrigin = getRequestOrigin(request);
  assertTrustedWriteRequest(request);
  await requireAdminSession(request, env);
  const db = getDb(env);
  const body = await readJson(request);
  const currentPassword = normalizePasswordInput(body?.currentPassword);
  const nextPassword = normalizePasswordInput(body?.nextPassword || body?.newPassword);
  const repeatedPassword = normalizePasswordInput(body?.confirmPassword || body?.repeatPassword);

  if (!currentPassword) {
    throw new HttpError(400, "Ingresá tu clave actual.");
  }

  if (!nextPassword) {
    throw new HttpError(400, "Ingresá la nueva clave.");
  }

  if (!repeatedPassword) {
    throw new HttpError(400, "Repetí la nueva clave.");
  }

  if (nextPassword !== repeatedPassword) {
    throw new HttpError(400, "La nueva clave y su repetición no coinciden.");
  }

  if (currentPassword === nextPassword) {
    throw new HttpError(400, "La nueva clave tiene que ser distinta a la actual.");
  }

  const currentHashRecord = await readAdminPasswordHashRecord(db, env);
  const currentPasswordIsValid = await verifyPassword(currentPassword, currentHashRecord, env);

  if (!currentPasswordIsValid) {
    throw new HttpError(400, "La clave actual no es correcta.");
  }

  const nextHashRecord = await buildPasswordHashRecord(nextPassword, env, { peppered: true });
  await persistAdminPasswordHashRecord(db, nextHashRecord);
  await invalidateAllSessions(db);

  return jsonResponse(
    {
      ok: true,
      message: "Clave actualizada. Por seguridad, volvé a ingresar con la nueva contraseña.",
      requiresReauth: true,
    },
    {
      corsOrigin,
      setCookie: buildClearSessionCookie(),
    }
  );
}

async function handleSession(request, env) {
  const corsOrigin = getRequestOrigin(request);
  assertSameOriginRead(request);
  await requireAdminSession(request, env);
  const state = await readStateFromDb(getDb(env));

  return jsonResponse(
    {
      state,
      authenticated: true,
    },
    { corsOrigin }
  );
}

async function handleLogout(request, env) {
  const corsOrigin = getRequestOrigin(request);
  assertTrustedWriteRequest(request);
  const rawToken = readSessionCookie(request);
  const db = getDb(env);

  if (rawToken) {
    const tokenHash = await getSessionTokenHash(rawToken, env);
    await invalidateSession(db, tokenHash);
  }

  return jsonResponse(
    { ok: true },
    {
      corsOrigin,
      setCookie: buildClearSessionCookie(),
    }
  );
}

async function handleScheduleCreate(request, env) {
  const corsOrigin = getRequestOrigin(request);
  assertTrustedWriteRequest(request);
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
    { status: 201, corsOrigin }
  );
}

async function handleScheduleUpdate(request, env, scheduleId) {
  const corsOrigin = getRequestOrigin(request);
  assertTrustedWriteRequest(request);
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
    { corsOrigin }
  );
}

async function handleScheduleDelete(request, env, scheduleId) {
  const corsOrigin = getRequestOrigin(request);
  assertTrustedWriteRequest(request);
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
    { corsOrigin }
  );
}

async function handleOptions(request, env) {
  const pathname = getRequestUrl(request).pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/api/schedules" || pathname === "/api/health") {
    const corsOrigin = resolvePublicCorsOrigin(request, env);
    return new Response(null, {
      status: 204,
      headers: {
        ...buildCorsHeaders(corsOrigin),
        "Cache-Control": "no-store",
      },
    });
  }

  throw new HttpError(403, "No autorizado.");
}

async function routeApiRequest(request, env) {
  const pathname = getRequestUrl(request).pathname.replace(/\/+$/, "") || "/";

  if (request.method === "OPTIONS") {
    return handleOptions(request, env);
  }

  if (pathname === "/api/health" && request.method === "GET") {
    const corsOrigin = resolvePublicCorsOrigin(request, env);
    return jsonResponse(
      {
        ok: true,
        mode: "cloudflare-d1",
        timestamp: new Date().toISOString(),
      },
      { corsOrigin }
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

  if (pathname === "/api/admin/password" && request.method === "POST") {
    return handlePasswordChange(request, env);
  }

  if (pathname === "/api/schedules" && request.method === "POST") {
    return handleScheduleCreate(request, env);
  }

  if (pathname.startsWith("/api/schedules/")) {
    const scheduleId = decodeURIComponent(pathname.slice("/api/schedules/".length)).trim();

    if (!scheduleId) {
      return jsonResponse(
        {
          error: "No recibimos el identificador del horario.",
        },
        { status: 400, corsOrigin: getRequestOrigin(request) }
      );
    }

    if (request.method === "PUT") {
      return handleScheduleUpdate(request, env, scheduleId);
    }

    if (request.method === "DELETE") {
      return handleScheduleDelete(request, env, scheduleId);
    }
  }

  return jsonResponse(
    {
      error: "No encontramos ese endpoint.",
    },
    { status: 404, corsOrigin: resolvePublicCorsOrigin(request, env) }
  );
}

async function routeRequest(request, env) {
  const pathname = getRequestUrl(request).pathname;

  if (pathname.startsWith("/api/")) {
    return routeApiRequest(request, env);
  }

  return serveStaticAsset(request, env);
}

export default {
  async fetch(request, env) {
    try {
      return await routeRequest(request, env);
    } catch (error) {
      if (getRequestUrl(request).pathname.startsWith("/api/")) {
        const corsOrigin = (() => {
          try {
            return resolvePublicCorsOrigin(request, env) || getRequestOrigin(request);
          } catch (resolveError) {
            return getRequestOrigin(request);
          }
        })();
        const status = error instanceof HttpError ? error.status : 500;
        const message = error instanceof HttpError
          ? error.message
          : "No pudimos procesar la solicitud.";

        const options = {
          status,
          corsOrigin,
        };

        if (status === 401) {
          options.setCookie = buildClearSessionCookie();
        }

        return jsonResponse({ error: message }, options);
      }

      return new Response("No pudimos cargar el sitio.", {
        status: error instanceof HttpError ? error.status : 500,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          ...STATIC_SHARED_HEADERS,
        },
      });
    }
  },
};
