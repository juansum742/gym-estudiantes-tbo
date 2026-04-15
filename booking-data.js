(function () {
  const core = window.EstudiantesTboScheduleCore || globalThis.EstudiantesTboScheduleCore;

  if (!core) {
    throw new Error("No encontramos schedule-core.js. Cargalo antes de booking-data.js.");
  }

  const STORAGE_KEY = "estudiantes_tbo_schedule_v2";
  const LEGACY_STORAGE_KEYS = ["estudiantes_tbo_schedule_v1", "estudiantes_tbo_premium_v3", "estudiantes_tbo_premium_v2"];
  const CHANGE_EVENT = "estudiantes-tbo-schedule:changed";
  const AUTH_CHANGE_EVENT = "estudiantes-tbo-auth:changed";
  const SYNC_INTERVAL_MS = 30000;

  let state = loadInitialState();
  let isAuthenticated = false;
  let backendMode = "unknown";
  let refreshPromise = null;

  function hasLocalStorage() {
    try {
      return typeof window.localStorage !== "undefined";
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

  function dispatchAuthChange(meta = {}) {
    window.dispatchEvent(
      new CustomEvent(AUTH_CHANGE_EVENT, {
        detail: {
          authenticated: isAuthenticated,
          backendMode,
          reason: meta.reason || "",
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

  function setAuthenticated(nextValue, meta = {}) {
    isAuthenticated = Boolean(nextValue);
    dispatchAuthChange(meta);
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

    const response = await window.fetch(buildApiUrl(pathname), {
      method: options.method || "GET",
      credentials: options.credentials || "same-origin",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      if (response.status === 401) {
        setAuthenticated(false, { reason: "expired" });
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

    setAuthenticated(true, { reason: "login" });

    if (payload?.state) {
      setState(payload.state);
    }

    return {
      authenticated: isAuthenticated,
    };
  }

  async function restoreSession() {
    await ensureBackendAvailable();

    const payload = await requestJson("/api/admin/session", {
      method: "GET",
    });

    if (payload?.state) {
      setState(payload.state);
    }

    setAuthenticated(Boolean(payload?.authenticated), { reason: payload?.authenticated ? "restore" : "expired" });
    return isAuthenticated;
  }

  async function logout() {
    if (backendMode === "available") {
      try {
        await requestJson("/api/admin/logout", {
          method: "POST",
        });
      } catch (error) {
        // Aunque el backend falle, invalidamos la sesión local.
      }
    }

    setAuthenticated(false, { reason: "logout" });
  }

  async function changePassword(payload) {
    await ensureBackendAvailable();

    const response = await requestJson("/api/admin/password", {
      method: "POST",
      body: payload,
    });

    setAuthenticated(false, { reason: "password-changed" });
    return response;
  }

  async function getSecurityStatus() {
    await ensureBackendAvailable();
    requireAuthenticatedSession();

    return requestJson("/api/admin/security", {
      method: "GET",
    });
  }

  async function saveSecurityQuestions(payload) {
    await ensureBackendAvailable();
    const response = await requestJson("/api/admin/security/questions", {
      method: "POST",
      body: payload,
    });

    setAuthenticated(true, { reason: response?.reauthenticated ? "reauth" : "restore" });
    return response;
  }

  async function clearSecurityQuestions(payload) {
    await ensureBackendAvailable();
    const response = await requestJson("/api/admin/security/questions/clear", {
      method: "POST",
      body: payload,
    });

    setAuthenticated(true, { reason: response?.reauthenticated ? "reauth" : "restore" });
    return response;
  }

  async function getRecoveryStatus() {
    await ensureBackendAvailable();

    return requestJson("/api/admin/recovery/status", {
      method: "GET",
    });
  }

  async function verifyRecoveryAnswers(payload) {
    await ensureBackendAvailable();

    return requestJson("/api/admin/recovery/verify", {
      method: "POST",
      body: payload,
    });
  }

  async function resetPasswordWithRecovery(payload) {
    await ensureBackendAvailable();

    const response = await requestJson("/api/admin/recovery/reset", {
      method: "POST",
      body: payload,
    });

    setAuthenticated(false, { reason: "password-recovered" });
    return response;
  }

  function requireAuthenticatedSession() {
    if (!isAuthenticated) {
      throw new Error("Tu sesión del panel venció. Ingresá nuevamente.");
    }
  }

  async function createSchedule(payload) {
    await ensureBackendAvailable();
    requireAuthenticatedSession();

    const response = await requestJson("/api/schedules", {
      method: "POST",
      body: payload,
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
    });

    setState(response?.state || state);
    return response?.schedule ? core.getScheduleById(state, response.schedule.id) || response.schedule : null;
  }

  async function deleteSchedule(scheduleId) {
    await ensureBackendAvailable();
    requireAuthenticatedSession();

    const response = await requestJson(`/api/schedules/${encodeURIComponent(scheduleId)}`, {
      method: "DELETE",
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
    changePassword,
    getSecurityStatus,
    saveSecurityQuestions,
    clearSecurityQuestions,
    getRecoveryStatus,
    verifyRecoveryAnswers,
    resetPasswordWithRecovery,
    restoreSession,
    refresh: () => refreshFromServer({ silent: false }),
    isServerMode: () => backendMode === "available",
    hasActiveSession: () => isAuthenticated,
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
