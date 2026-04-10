const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const core = require("./schedule-core.js");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_PIN = process.env.ADMIN_PIN || "TBO2026";
const SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS || 1000 * 60 * 60 * 12);
const DATA_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(__dirname, "data", "schedule-state.json");
const DATA_DIR = path.dirname(DATA_FILE);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

const sessions = new Map();

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(core.createDefaultState(), null, 2));
  }
}

function loadStateFromDisk() {
  ensureDataFile();

  try {
    const rawValue = fs.readFileSync(DATA_FILE, "utf8");
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};
    return core.sanitizeState(parsedValue);
  } catch (error) {
    const fallbackState = core.createDefaultState();
    fs.writeFileSync(DATA_FILE, JSON.stringify(fallbackState, null, 2));
    return fallbackState;
  }
}

let currentState = loadStateFromDisk();

function saveStateToDisk() {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(currentState, null, 2));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(message);
}

function createSession() {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

function cleanupSessions() {
  const now = Date.now();

  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function readBearerToken(request) {
  const authorization = String(request.headers.authorization || "");

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

function requireAdminSession(request) {
  cleanupSessions();
  const token = readBearerToken(request);

  if (!token) {
    throw new Error("Necesitás iniciar sesión en el panel para modificar horarios.");
  }

  const session = sessions.get(token);

  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    throw new Error("La sesión del panel venció. Volvé a ingresar.");
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, session);
  return token;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("No pudimos leer el cuerpo de la solicitud."));
      }
    });

    request.on("error", () => {
      reject(new Error("Se cortó la conexión durante la solicitud."));
    });
  });
}

async function handleApiRequest(request, response, pathname) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      Allow: "GET,POST,PUT,DELETE,OPTIONS",
      "Cache-Control": "no-store",
    });
    response.end();
    return;
  }

  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      mode: "server",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (pathname === "/api/schedules" && request.method === "GET") {
    currentState = core.sanitizeState(currentState);
    sendJson(response, 200, {
      state: currentState,
      stats: core.getStats(currentState),
    });
    return;
  }

  if (pathname === "/api/admin/login" && request.method === "POST") {
    const body = await readRequestBody(request);
    const pin = String(body?.pin || "").trim();

    if (!pin || pin !== ADMIN_PIN) {
      sendJson(response, 401, {
        error: "PIN incorrecto. Verificá el acceso del panel.",
      });
      return;
    }

    const token = createSession();
    sendJson(response, 200, {
      token,
      state: currentState,
    });
    return;
  }

  if (pathname === "/api/schedules" && request.method === "POST") {
    requireAdminSession(request);
    const body = await readRequestBody(request);
    const result = core.createSchedule(currentState, body);
    currentState = result.state;
    saveStateToDisk();

    sendJson(response, 201, {
      state: currentState,
      schedule: result.schedule,
    });
    return;
  }

  if (pathname.startsWith("/api/schedules/")) {
    const scheduleId = decodeURIComponent(pathname.slice("/api/schedules/".length));

    if (!scheduleId) {
      sendJson(response, 400, {
        error: "No recibimos el identificador del horario.",
      });
      return;
    }

    if (request.method === "PUT") {
      requireAdminSession(request);
      const body = await readRequestBody(request);
      const result = core.updateSchedule(currentState, scheduleId, body);
      currentState = result.state;
      saveStateToDisk();

      sendJson(response, 200, {
        state: currentState,
        schedule: result.schedule,
      });
      return;
    }

    if (request.method === "DELETE") {
      requireAdminSession(request);
      const result = core.deleteSchedule(currentState, scheduleId);
      currentState = result.state;
      saveStateToDisk();

      sendJson(response, 200, {
        state: currentState,
        schedule: result.schedule,
      });
      return;
    }
  }

  sendJson(response, 404, {
    error: "No encontramos ese endpoint.",
  });
}

function resolveFilePath(pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const normalizedPath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  return path.join(__dirname, normalizedPath);
}

function serveStaticFile(response, pathname) {
  const resolvedPath = resolveFilePath(pathname);
  const safeRoot = path.resolve(__dirname);
  const safePath = path.resolve(resolvedPath);

  if (!safePath.startsWith(safeRoot)) {
    sendText(response, 403, "Acceso denegado.");
    return;
  }

  if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    sendText(response, 404, "No encontramos ese archivo.");
    return;
  }

  const extension = path.extname(safePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";

  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=300",
  });

  fs.createReadStream(safePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      await handleApiRequest(request, response, pathname);
      return;
    }

    serveStaticFile(response, pathname);
  } catch (error) {
    const statusCode = /PIN incorrecto|sesión|modificar horarios/i.test(error.message) ? 401 : 400;
    sendJson(response, statusCode, {
      error: error.message || "Ocurrió un error inesperado.",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Estudiantes TBÓ server escuchando en http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
});
