import "../schedule-core.js";

const core = globalThis.EstudiantesTboScheduleCore;

if (!core) {
  throw new Error("No encontramos la lógica compartida de horarios.");
}

const API_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function jsonResponse(payload, { status = 200, origin = "*" } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...API_HEADERS,
      ...buildCorsHeaders(origin),
    },
  });
}

function buildCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveResponseOrigin(request, env) {
  const requestOrigin = request.headers.get("Origin") || "";
  const allowedOrigins = getAllowedOrigins(env);

  if (!requestOrigin) {
    return allowedOrigins[0] || "*";
  }

  if (!allowedOrigins.length) {
    return "*";
  }

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : "";
}

function assertOriginAllowed(request, env) {
  const responseOrigin = resolveResponseOrigin(request, env);

  if (!responseOrigin) {
    throw new HttpError(403, "Este origen no está autorizado para usar la API.");
  }

  return responseOrigin;
}

async function readJson(request) {
  if (!request.body) {
    return {};
  }

  try {
    return await request.json();
  } catch (error) {
    throw new HttpError(400, "No pudimos leer el contenido enviado.");
  }
}

function createSessionToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

function getSessionTtl(env) {
  const configuredValue = Number(env.ADMIN_SESSION_TTL_MS || SESSION_TTL_MS);
  return Number.isFinite(configuredValue) && configuredValue > 0 ? configuredValue : SESSION_TTL_MS;
}

async function cleanupExpiredSessions(db) {
  await db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").bind(Date.now()).run();
}

async function createAdminSession(db, env) {
  const token = createSessionToken();
  const now = Date.now();
  const expiresAt = now + getSessionTtl(env);

  await db
    .prepare("INSERT INTO admin_sessions (token, expires_at, created_at) VALUES (?, ?, ?)")
    .bind(token, expiresAt, new Date(now).toISOString())
    .run();

  return token;
}

function readBearerToken(request) {
  const authorization = String(request.headers.get("Authorization") || "");

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

async function requireAdminSession(request, env) {
  const token = readBearerToken(request);

  if (!token) {
    throw new HttpError(401, "Necesitás iniciar sesión en el panel para modificar horarios.");
  }

  const db = getDb(env);

  await cleanupExpiredSessions(db);

  const session = await db
    .prepare("SELECT token, expires_at FROM admin_sessions WHERE token = ? LIMIT 1")
    .bind(token)
    .first();

  if (!session || Number(session.expires_at) <= Date.now()) {
    await db.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(token).run();
    throw new HttpError(401, "La sesión del panel venció. Volvé a ingresar.");
  }

  const nextExpiresAt = Date.now() + getSessionTtl(env);

  await db
    .prepare("UPDATE admin_sessions SET expires_at = ? WHERE token = ?")
    .bind(nextExpiresAt, token)
    .run();

  return token;
}

function getDb(env) {
  if (!env.DB) {
    throw new HttpError(500, "La base D1 no está configurada en este Worker.");
  }

  return env.DB;
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

async function persistState(db, sourceState) {
  const state = core.sanitizeState({
    version: 2,
    customTimeSlots: sourceState.customTimeSlots,
    customDisciplines: sourceState.customDisciplines,
    schedules: sourceState.schedules,
  });

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
  const origin = assertOriginAllowed(request, env);
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
  const origin = assertOriginAllowed(request, env);
  const body = await readJson(request);
  const pin = String(body?.pin || "").trim();
  const adminPin = String(env.ADMIN_PIN || "TBO2026").trim();

  if (!pin || pin !== adminPin) {
    return jsonResponse(
      {
        error: "PIN incorrecto. Verificá el acceso del panel.",
      },
      { status: 401, origin }
    );
  }

  const db = getDb(env);
  await cleanupExpiredSessions(db);
  const token = await createAdminSession(db, env);
  const state = await readStateFromDb(db);

  return jsonResponse(
    {
      token,
      state,
    },
    { origin }
  );
}

async function handleScheduleCreate(request, env) {
  const origin = assertOriginAllowed(request, env);
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
  const origin = assertOriginAllowed(request, env);
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
  const origin = assertOriginAllowed(request, env);
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

    if (!origin && request.headers.get("Origin")) {
      return jsonResponse(
        {
          error: "Este origen no está autorizado para usar la API.",
        },
        { status: 403, origin: "*" }
      );
    }

    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(origin || "*"),
    });
  }

  if (pathname === "/api/health" && request.method === "GET") {
    const origin = assertOriginAllowed(request, env);
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

  if (pathname === "/api/schedules" && request.method === "POST") {
    return handleScheduleCreate(request, env);
  }

  if (pathname.startsWith("/api/schedules/")) {
    const scheduleId = decodeURIComponent(pathname.slice("/api/schedules/".length));

    if (!scheduleId) {
      const origin = assertOriginAllowed(request, env);
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

  const origin = resolveResponseOrigin(request, env) || "*";
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
      const origin = resolveResponseOrigin(request, env) || "*";
      const status = error instanceof HttpError ? error.status : 500;
      return jsonResponse(
        {
          error: error instanceof Error ? error.message : "No pudimos procesar la solicitud.",
        },
        { status, origin }
      );
    }
  },
};
