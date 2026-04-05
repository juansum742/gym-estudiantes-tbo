(function () {
  const STORAGE_KEY = "estudiantes_tbo_premium_v2";
  const CHANGE_EVENT = "estudiantes-tbo-booking:changed";
  const HORIZON_DAYS = 21;
  const ADMIN_PIN = "TBO2026";

  const CLASS_TYPES = {
    funcional: { label: "Funcional", accent: "available", capacity: 12 },
    indoor: { label: "Indoor Bike", accent: "accent", capacity: 10 },
    kick: { label: "Kick Boxing", accent: "danger", capacity: 14 },
    fullgap: { label: "FullGap", accent: "highlight", capacity: 14 },
    musculacion: { label: "Musculación Guiada", accent: "neutral", capacity: 8 },
  };

  const WEEKLY_TEMPLATES = {
    1: [
      { time: "08:00", classType: "funcional" },
      { time: "19:00", classType: "indoor" },
      { time: "20:00", classType: "funcional" },
    ],
    2: [
      { time: "08:15", classType: "indoor" },
      { time: "18:00", classType: "kick" },
      { time: "20:00", classType: "fullgap" },
    ],
    3: [
      { time: "08:00", classType: "funcional" },
      { time: "19:00", classType: "indoor" },
      { time: "20:00", classType: "funcional" },
    ],
    4: [
      { time: "08:15", classType: "indoor" },
      { time: "18:00", classType: "kick" },
      { time: "20:00", classType: "fullgap" },
    ],
    5: [
      { time: "08:00", classType: "funcional" },
      { time: "19:00", classType: "indoor" },
      { time: "20:00", classType: "funcional" },
    ],
    6: [
      { time: "10:00", classType: "musculacion" },
      { time: "11:15", classType: "indoor" },
    ],
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDateKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function addDays(baseDate, days) {
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  function startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function startOfWeek(date) {
    const value = new Date(date);
    const weekday = value.getDay();
    const diff = weekday === 0 ? -6 : 1 - weekday;
    value.setDate(value.getDate() + diff);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  function sortBySlot(a, b) {
    return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
  }

  function getClassMeta(classType) {
    return CLASS_TYPES[classType] || {
      label: classType,
      accent: "neutral",
      capacity: 10,
    };
  }

  function createScheduleId(dateKey, time, classType) {
    return `slot-${dateKey}-${time.replace(":", "")}-${classType}`;
  }

  function scheduleToDateTime(schedule) {
    const [hours, minutes] = schedule.time.split(":").map(Number);
    const date = parseDateKey(schedule.date);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  function buildTemplateSchedule(dateKey, template) {
    const meta = getClassMeta(template.classType);
    return {
      id: createScheduleId(dateKey, template.time, template.classType),
      date: dateKey,
      time: template.time,
      classType: template.classType,
      capacity: template.capacity || meta.capacity,
      origin: "template",
      createdAt: new Date().toISOString(),
    };
  }

  function readStoredState() {
    try {
      const rawValue = localStorage.getItem(STORAGE_KEY);
      return rawValue ? JSON.parse(rawValue) : null;
    } catch (error) {
      return null;
    }
  }

  function ensureFutureSchedules(state) {
    const today = startOfToday();
    const existingIds = new Set(state.schedules.map((schedule) => schedule.id));

    for (let offset = 0; offset <= HORIZON_DAYS; offset += 1) {
      const date = addDays(today, offset);
      const dateKey = toDateKey(date);
      const templates = WEEKLY_TEMPLATES[date.getDay()] || [];

      templates.forEach((template) => {
        const schedule = buildTemplateSchedule(dateKey, template);

        if (!existingIds.has(schedule.id)) {
          existingIds.add(schedule.id);
          state.schedules.push(schedule);
        }
      });
    }

    state.schedules = state.schedules
      .filter((schedule) => parseDateKey(schedule.date) >= addDays(today, -7))
      .sort(sortBySlot);
  }

  function normalizeState(state) {
    const safeState = {
      schedules: Array.isArray(state?.schedules) ? state.schedules : [],
      reservations: Array.isArray(state?.reservations) ? state.reservations : [],
    };

    ensureFutureSchedules(safeState);
    safeState.reservations.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    return safeState;
  }

  function persistState(state, notify = true) {
    const normalizedState = normalizeState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedState));

    if (notify) {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }

    return normalizedState;
  }

  function loadState() {
    const rawState = readStoredState();
    const normalizedState = normalizeState(rawState);

    if (!rawState || JSON.stringify(rawState) !== JSON.stringify(normalizedState)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedState));
    }

    return normalizedState;
  }

  function countReservationsForSchedule(state, scheduleId) {
    return state.reservations.filter((reservation) => reservation.scheduleId === scheduleId).length;
  }

  function formatDateLabel(dateKey) {
    return parseDateKey(dateKey).toLocaleDateString("es-UY", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  }

  function enrichSchedule(schedule, state) {
    const meta = getClassMeta(schedule.classType);
    const reservedCount = countReservationsForSchedule(state, schedule.id);
    const remaining = Math.max(schedule.capacity - reservedCount, 0);
    const status = remaining === 0 ? "occupied" : remaining <= Math.max(2, Math.ceil(schedule.capacity * 0.25)) ? "limited" : "available";

    return {
      ...schedule,
      classLabel: meta.label,
      accent: meta.accent,
      reservedCount,
      remaining,
      status,
      dateLabel: formatDateLabel(schedule.date),
      isAvailable: remaining > 0,
    };
  }

  function getSchedules(filters = {}) {
    const state = loadState();
    const now = new Date();

    return state.schedules
      .map((schedule) => enrichSchedule(schedule, state))
      .filter((schedule) => {
        if (filters.futureOnly && scheduleToDateTime(schedule) < now) {
          return false;
        }

        if (filters.date && schedule.date !== filters.date) {
          return false;
        }

        if (filters.classType && schedule.classType !== filters.classType) {
          return false;
        }

        if (filters.availableOnly && !schedule.isAvailable) {
          return false;
        }

        return true;
      })
      .sort(sortBySlot);
  }

  function getUniqueUpcomingDates(limit = 12) {
    const dates = [];
    const seen = new Set();

    getSchedules({ futureOnly: true }).forEach((schedule) => {
      if (!seen.has(schedule.date)) {
        seen.add(schedule.date);
        dates.push(schedule.date);
      }
    });

    return dates.slice(0, limit);
  }

  function getReservations() {
    const state = loadState();

    return state.reservations
      .map((reservation) => {
        const schedule = state.schedules.find((item) => item.id === reservation.scheduleId);
        const meta = getClassMeta(reservation.classType);

        return {
          ...reservation,
          classLabel: meta.label,
          accent: meta.accent,
          schedule,
        };
      })
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }

  function createReservation(payload) {
    const state = loadState();
    const name = String(payload.name || "").trim();
    const phone = String(payload.phone || "").trim();
    const scheduleId = payload.scheduleId;
    const schedule = state.schedules.find((item) => item.id === scheduleId);

    if (!name || !phone || !schedule) {
      throw new Error("Completá los datos y elegí un horario válido.");
    }

    const hydratedSchedule = enrichSchedule(schedule, state);

    if (scheduleToDateTime(hydratedSchedule) < new Date()) {
      throw new Error("Ese horario ya pasó. Elegí uno futuro.");
    }

    if (!hydratedSchedule.isAvailable) {
      throw new Error("Ese horario ya se agotó. Elegí otro disponible.");
    }

    const reservation = {
      id: `res-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      scheduleId: hydratedSchedule.id,
      name,
      phone,
      date: hydratedSchedule.date,
      time: hydratedSchedule.time,
      classType: hydratedSchedule.classType,
      createdAt: new Date().toISOString(),
    };

    state.reservations.push(reservation);
    persistState(state);
    return reservation;
  }

  function cancelReservation(reservationId) {
    const state = loadState();
    state.reservations = state.reservations.filter((reservation) => reservation.id !== reservationId);
    persistState(state);
  }

  function addSchedule(payload) {
    const state = loadState();
    const date = String(payload.date || "").trim();
    const time = String(payload.time || "").trim();
    const classType = String(payload.classType || "").trim();
    const capacity = Math.max(1, Number(payload.capacity || 0));
    const duplicate = state.schedules.find(
      (schedule) => schedule.date === date && schedule.time === time && schedule.classType === classType
    );

    if (!date || !time || !classType || !capacity) {
      throw new Error("Completá fecha, hora, clase y capacidad.");
    }

    if (duplicate) {
      throw new Error("Ese horario ya existe en la agenda.");
    }

    state.schedules.push({
      id: `manual-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      date,
      time,
      classType,
      capacity,
      origin: "manual",
      createdAt: new Date().toISOString(),
    });

    persistState(state);
  }

  function getStats() {
    const reservations = getReservations();
    const schedules = getSchedules({ futureOnly: true });
    const today = toDateKey(new Date());
    const weekStart = startOfWeek(new Date());
    const weekEnd = addDays(weekStart, 7);

    const reservationsToday = reservations.filter((reservation) => reservation.date === today).length;
    const reservationsWeek = reservations.filter((reservation) => {
      const date = parseDateKey(reservation.date);
      return date >= weekStart && date < weekEnd;
    }).length;

    const freeSpots = schedules.reduce((total, schedule) => total + schedule.remaining, 0);
    const byClass = reservations.reduce((accumulator, reservation) => {
      accumulator[reservation.classType] = (accumulator[reservation.classType] || 0) + 1;
      return accumulator;
    }, {});

    const topClassKey = Object.keys(byClass).sort((left, right) => byClass[right] - byClass[left])[0];

    return {
      reservationsToday,
      reservationsWeek,
      freeSpots,
      topClass: topClassKey ? getClassMeta(topClassKey).label : "Sin datos",
      topClassCount: topClassKey ? byClass[topClassKey] : 0,
    };
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  });

  window.EstudiantesTboBooking = {
    changeEvent: CHANGE_EVENT,
    adminPin: ADMIN_PIN,
    classTypes: CLASS_TYPES,
    getSchedules,
    getReservations,
    getUniqueUpcomingDates,
    getStats,
    createReservation,
    cancelReservation,
    addSchedule,
    formatDateLabel,
  };
})();
