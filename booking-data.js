(function () {
  const core = window.EstudiantesTboScheduleCore || globalThis.EstudiantesTboScheduleCore;

  if (!core) {
    throw new Error("No encontramos schedule-core.js. Cargalo antes de booking-data.js.");
  }

  const STORAGE_KEY = "estudiantes_tbo_schedule_v2";
  const LEGACY_STORAGE_KEYS = ["estudiantes_tbo_schedule_v1", "estudiantes_tbo_premium_v3", "estudiantes_tbo_premium_v2"];
  const AUTH_TOKEN_KEY = "estudiantes_tbo_admin_token";
  const CHANGE_EVENT = "estudiantes-tbo-schedule:changed";
  const ADMIN_PIN = "TBO2026";
  const SYNC_INTERVAL_MS = 30000;

  let state = loadInitialState();
  let authToken = readStorageText(AUTH_TOKEN_KEY);
  let backendMode = "unknown";
  let refreshPromise = null;

  function hasStorage() {
    try {
      return typeof window.localStorage !== "undefined";
    } catch (error) {
      return false;
    }
  }

  function readStorageJson(storageKey) {
    if (!hasStorage()) {
      return null;
    }

    try {
      const rawValue = window.localStorage.getItem(storageKey);
      return rawValue ? JSON.parse(rawValue) : null;
    } catch (error) {
      return null;
    }
  }

  function readStorageText(storageKey) {
    if (!hasStorage()) {
      return "";
    }

    try {
      return window.localStorage.getItem(storageKey) || "";
    } catch (error) {
      return "";
    }
  }

  function writeStorageJson(storageKey, value) {
    if (!hasStorage()) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      // Ignoramos fallos de cuota para no romper la UI.
    }
  }

  function writeStorageText(storageKey, value) {
    if (!hasStorage()) {
      return;
    }

    try {
      if (value) {
        window.localStorage.setItem(storageKey, value);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch (error) {
      // Ignoramos fallos de cuota para no romper la UI.
    }
  }

  function loadInitialState() {
    const cachedState = readStorageJson(STORAGE_KEY);

    if (cachedState) {
      return core.sanitizeState(cachedState);
    }

    for (const storageKey of LEGACY_STORAGE_KEYS) {
      const legacyState = readStorageJson(storageKey);

      if (!legacyState) {
        continue;
      }

      const migratedState = core.sanitizeState({
        schedules: Array.isArray(legacyState?.schedules) ? legacyState.schedules : legacyState,
        customTimeSlots: legacyState?.customTimeSlots,
        customDisciplines: legacyState?.customDisciplines,
      });

      writeStorageJson(STORAGE_KEY, migratedState);
      return migratedState;
    }

    return core.createDefaultState();
  }

  function dispatchChange() {
    window.dispatchEvent(
      new CustomEvent(CHANGE_EVENT, {
        detail: {
          schedules: core.getSchedules(state),
          disciplines: core.getDisciplines(state),
          timeSlots: core.getTimeSlots(state),
          backendMode,
        },
      })
    );
  }

  function persistState() {
    writeStorageJson(STORAGE_KEY, state);
  }

  function setState(nextState, { dispatch = true } = {}) {
    state = core.sanitizeState(nextState);
    persistState();

    if (dispatch) {
      dispatchChange();
    }
  }

  function getApiBase() {
    const configuredBase = typeof window.__ESTUDIANTES_API_BASE__ === "string"
      ? window.__ESTUDIANTES_API_BASE__
      : "";

    return configuredBase.replace(/\/+$/, "");
  }

  function buildApiUrl(pathname) {
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `${getApiBase()}${normalizedPath}`;
  }

  async function parseResponsePayload(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return response.json();
    }

    const text = await response.text();
    return text ? { error: text } : null;
  }

  async function requestJson(pathname, options = {}) {
    if (typeof window.fetch !== "function") {
      throw new Error("Este navegador no soporta la API del servidor.");
    }

    const headers = new Headers(options.headers || {});

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (options.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (authToken && options.requiresAuth) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }

    const response = await window.fetch(buildApiUrl(pathname), {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      if (response.status === 401) {
        authToken = "";
        writeStorageText(AUTH_TOKEN_KEY, "");
      }

      throw new Error(payload?.error || "No pudimos conectar con el servidor.");
    }

    return payload;
  }

  async function refreshFromServer(options = {}) {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        const payload = await requestJson("/api/schedules");
        backendMode = "available";
        setState(payload?.state || payload || core.createDefaultState());
        return state;
      } catch (error) {
        backendMode = "unavailable";

        if (!options.silent) {
          throw error;
        }

        return state;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  async function ensureBackendMode() {
    if (backendMode === "unknown") {
      await refreshFromServer({ silent: true });
    }

    return backendMode;
  }

  async function login(pin) {
    const normalizedPin = String(pin || "").trim();

    if (!normalizedPin) {
      throw new Error("Ingresá el PIN de acceso del panel.");
    }

    await ensureBackendMode();

    if (backendMode === "available") {
      const payload = await requestJson("/api/admin/login", {
        method: "POST",
        body: { pin: normalizedPin },
      });

      authToken = String(payload?.token || "");
      writeStorageText(AUTH_TOKEN_KEY, authToken);

      if (payload?.state) {
        setState(payload.state);
      }

      return {
        mode: "server",
        token: authToken,
      };
    }

    if (normalizedPin !== ADMIN_PIN) {
      throw new Error("PIN incorrecto. Verificá el acceso del panel.");
    }

    return {
      mode: "local",
      token: "",
    };
  }

  async function createSchedule(payload) {
    await ensureBackendMode();

    if (backendMode === "available") {
      const response = await requestJson("/api/schedules", {
        method: "POST",
        body: payload,
        requiresAuth: true,
      });

      setState(response?.state || state);
      return response?.schedule ? core.getScheduleById(state, response.schedule.id) || response.schedule : null;
    }

    const result = core.createSchedule(state, payload);
    setState(result.state);
    return result.schedule;
  }

  async function updateSchedule(scheduleId, payload) {
    await ensureBackendMode();

    if (backendMode === "available") {
      const response = await requestJson(`/api/schedules/${encodeURIComponent(scheduleId)}`, {
        method: "PUT",
        body: payload,
        requiresAuth: true,
      });

      setState(response?.state || state);
      return response?.schedule ? core.getScheduleById(state, response.schedule.id) || response.schedule : null;
    }

    const result = core.updateSchedule(state, scheduleId, payload);
    setState(result.state);
    return result.schedule;
  }

  async function deleteSchedule(scheduleId) {
    await ensureBackendMode();

    if (backendMode === "available") {
      const response = await requestJson(`/api/schedules/${encodeURIComponent(scheduleId)}`, {
        method: "DELETE",
        requiresAuth: true,
      });

      setState(response?.state || state);
      return response?.schedule || null;
    }

    const result = core.deleteSchedule(state, scheduleId);
    setState(result.state);
    return result.schedule;
  }

  function getTimeSlots(options = {}) {
    return core.getTimeSlots(state, options);
  }

  function getDisciplines(options = {}) {
    return core.getDisciplines(state, options);
  }

  function getSchedules(filters = {}) {
    return core.getSchedules(state, filters);
  }

  function getScheduleById(scheduleId) {
    return core.getScheduleById(state, scheduleId);
  }

  function getScheduleBoardData() {
    return core.getScheduleBoardData(state);
  }

  function getDisciplineSummaries(options = {}) {
    return core.getDisciplineSummaries(state, options);
  }

  function getStats() {
    return core.getStats(state);
  }

  function formatWeekday(weekdayKey) {
    return core.formatWeekday(weekdayKey);
  }

  function formatScheduleSlot(slotKey) {
    return core.formatScheduleSlot(state, slotKey);
  }

  if (typeof window.addEventListener === "function") {
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY) {
        const nextState = readStorageJson(STORAGE_KEY);

        if (nextState) {
          state = core.sanitizeState(nextState);
          dispatchChange();
        }
      }

      if (event.key === AUTH_TOKEN_KEY) {
        authToken = readStorageText(AUTH_TOKEN_KEY);
      }
    });

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refreshFromServer({ silent: true });
      }
    });

    window.addEventListener("focus", () => {
      refreshFromServer({ silent: true });
    });
  }

  const ready = refreshFromServer({ silent: true });

  if (typeof window.setInterval === "function") {
    window.setInterval(() => {
      refreshFromServer({ silent: true });
    }, SYNC_INTERVAL_MS);
  }

  window.EstudiantesTboBooking = {
    adminPin: ADMIN_PIN,
    changeEvent: CHANGE_EVENT,
    customDisciplineValue: core.customDisciplineValue,
    customSlotValue: core.customSlotValue,
    weekdays: core.weekdays,
    ready,
    login,
    refresh: () => refreshFromServer({ silent: false }),
    isServerMode: () => backendMode === "available",
    getTimeSlots,
    getDisciplines,
    getSchedules,
    getScheduleById,
    getScheduleBoardData,
    getDisciplineSummaries,
    getStats,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    formatWeekday,
    formatScheduleSlot,
  };
})();
