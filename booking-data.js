(function () {
  const core = window.EstudiantesTboScheduleCore || globalThis.EstudiantesTboScheduleCore;

  if (!core) {
    throw new Error("No encontramos schedule-core.js. Cargalo antes de booking-data.js.");
  }

  const STORAGE_KEY = "estudiantes_tbo_schedule_v2";
  const LEGACY_STORAGE_KEYS = ["estudiantes_tbo_schedule_v1", "estudiantes_tbo_premium_v3", "estudiantes_tbo_premium_v2"];
  const AUTH_TOKEN_KEY = "estudiantes_tbo_admin_session";
  const CHANGE_EVENT = "estudiantes-tbo-schedule:changed";
  const AUTH_CHANGE_EVENT = "estudiantes-tbo-auth:changed";
  const SYNC_INTERVAL_MS = 30000;

  let state = loadInitialState();
  let authToken = readSessionText(AUTH_TOKEN_KEY);
  let backendMode = "unknown";
  let refreshPromise = null;

  function hasLocalStorage() {
    try {
      return typeof window.localStorage !== "undefined";
    } catch (error) {
      return false;
    }
  }

  function hasSessionStorage() {
    try {
      return typeof window.sessionStorage !== "undefined";
    } catch (error) {
      return false;
    }
  }

  function readStorageJson(storageKey) {
    if (!hasLocalStorage()) {
      return null;
    }

    try {
      const rawValue = window.localStorage.getItem(storageKey);
      return rawValue ? JSON.parse(rawValue) : null;
    } catch (error) {
      return null;
    }
  }

  function writeStorageJson(storageKey, value) {
    if (!hasLocalStorage()) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      // Ignoramos fallos de cuota para no romper la UI pública.
    }
  }

  function readSessionText(storageKey) {
    if (!hasSessionStorage()) {
      return "";
    }

    try {
      return window.sessionStorage.getItem(storageKey) || "";
    } catch (error) {
      return "";
    }
  }

  function writeSessionText(storageKey, value) {
    if (!hasSessionStorage()) {
      return;
    }

    try {
      if (value) {
        window.sessionStorage.setItem(storageKey, value);
      } else {
        window.sessionStorage.removeItem(storageKey);
      }
    } catch (error) {
      // Ignoramos fallos de almacenamiento para no romper la UI.
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

  function dispatchAuthChange() {
    window.dispatchEvent(
      new CustomEvent(AUTH_CHANGE_EVENT, {
        detail: {
          authenticated: Boolean(authToken),
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

  function setAuthToken(nextToken) {
    authToken = String(nextToken || "").trim();
    writeSessionText(AUTH_TOKEN_KEY, authToken);
    dispatchAuthChange();
  }

  function clearAuthToken() {
    setAuthToken("");
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
        clearAuthToken();
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

  async function ensureBackendAvailable() {
    if (backendMode === "unknown") {
      await refreshFromServer({ silent: true });
    }

    if (backendMode !== "available") {
      throw new Error("No pudimos conectar con el panel seguro. Verificá la API del servidor.");
    }
  }

  async function login(pin) {
    const normalizedPin = String(pin || "").trim();

    if (!normalizedPin) {
      throw new Error("Ingresá la clave de acceso del panel.");
    }

    await ensureBackendAvailable();

    const payload = await requestJson("/api/admin/login", {
      method: "POST",
      body: { pin: normalizedPin },
    });

    setAuthToken(String(payload?.token || ""));

    if (payload?.state) {
      setState(payload.state);
    }

    return {
      authenticated: Boolean(authToken),
    };
  }

  async function restoreSession() {
    if (!authToken) {
      return false;
    }

    await ensureBackendAvailable();

    const payload = await requestJson("/api/admin/session", {
      method: "GET",
      requiresAuth: true,
    });

    if (payload?.state) {
      setState(payload.state);
    }

    return true;
  }

  async function logout() {
    if (authToken && backendMode === "available") {
      try {
        await requestJson("/api/admin/logout", {
          method: "POST",
          requiresAuth: true,
        });
      } catch (error) {
        // Aunque el backend falle, invalidamos la sesión local.
      }
    }

    clearAuthToken();
  }

  function requireAuthenticatedSession() {
    if (!authToken) {
      throw new Error("Tu sesión del panel venció. Ingresá nuevamente.");
    }
  }

  async function createSchedule(payload) {
    await ensureBackendAvailable();
    requireAuthenticatedSession();

    const response = await requestJson("/api/schedules", {
      method: "POST",
      body: payload,
      requiresAuth: true,
    });

    setState(response?.state || state);
    return response?.schedule ? core.getScheduleById(state, response.schedule.id) || response.schedule : null;
  }

  async function updateSchedule(scheduleId, payload) {
    await ensureBackendAvailable();
    requireAuthenticatedSession();

    const response = await requestJson(`/api/schedules/${encodeURIComponent(scheduleId)}`, {
      method: "PUT",
      body: payload,
      requiresAuth: true,
    });

    setState(response?.state || state);
    return response?.schedule ? core.getScheduleById(state, response.schedule.id) || response.schedule : null;
  }

  async function deleteSchedule(scheduleId) {
    await ensureBackendAvailable();
    requireAuthenticatedSession();

    const response = await requestJson(`/api/schedules/${encodeURIComponent(scheduleId)}`, {
      method: "DELETE",
      requiresAuth: true,
    });

    setState(response?.state || state);
    return response?.schedule || null;
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
      if (event.key !== STORAGE_KEY) {
        return;
      }

      const nextState = readStorageJson(STORAGE_KEY);

      if (!nextState) {
        return;
      }

      state = core.sanitizeState(nextState);
      dispatchChange();
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
    changeEvent: CHANGE_EVENT,
    authChangeEvent: AUTH_CHANGE_EVENT,
    customDisciplineValue: core.customDisciplineValue,
    customSlotValue: core.customSlotValue,
    weekdays: core.weekdays,
    ready,
    login,
    logout,
    restoreSession,
    refresh: () => refreshFromServer({ silent: false }),
    isServerMode: () => backendMode === "available",
    hasActiveSession: () => Boolean(authToken),
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
