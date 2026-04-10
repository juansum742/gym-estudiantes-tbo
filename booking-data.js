(function () {
  const STORAGE_KEY = "estudiantes_tbo_schedule_v1";
  const LEGACY_STORAGE_KEYS = ["estudiantes_tbo_premium_v3", "estudiantes_tbo_premium_v2"];
  const CHANGE_EVENT = "estudiantes-tbo-schedule:changed";
  const ADMIN_PIN = "TBO2026";

  const WEEKDAYS = [
    { key: "lunes", label: "Lunes", order: 1 },
    { key: "martes", label: "Martes", order: 2 },
    { key: "miercoles", label: "Miércoles", order: 3 },
    { key: "jueves", label: "Jueves", order: 4 },
    { key: "viernes", label: "Viernes", order: 5 },
  ];

  const TIME_SLOTS = [
    { key: "08:00-09:00", label: "8:00 a 9:00", order: 1 },
    { key: "08:15-09:00", label: "8:15 a 9:00", order: 2 },
    { key: "09:00-10:00", label: "9:00 a 10:00", order: 3 },
    { key: "16:40", label: "16:40 hs", order: 4 },
    { key: "18:00-19:00", label: "18:00 a 19:00", order: 5 },
    { key: "18:40", label: "18:40 hs", order: 6 },
    { key: "19:00-19:45", label: "19:00 a 19:45", order: 7 },
    { key: "20:00-21:00", label: "20:00 a 21:00", order: 8 },
  ];

  const DISCIPLINES = [
    { key: "indoor", label: "Indoor Bike", accent: "accent" },
    { key: "funcional", label: "Funcional", accent: "available" },
    { key: "fullgap", label: "Full Gap", accent: "highlight" },
    { key: "kickboxing", label: "Kick Boxing", accent: "danger" },
  ];

  const DEFAULT_SCHEDULES = [
    { weekdayKey: "lunes", slotKey: "08:00-09:00", disciplineKey: "funcional" },
    { weekdayKey: "miercoles", slotKey: "08:00-09:00", disciplineKey: "funcional" },
    { weekdayKey: "viernes", slotKey: "08:00-09:00", disciplineKey: "funcional" },
    { weekdayKey: "martes", slotKey: "08:15-09:00", disciplineKey: "indoor" },
    { weekdayKey: "jueves", slotKey: "08:15-09:00", disciplineKey: "indoor" },
    { weekdayKey: "martes", slotKey: "18:00-19:00", disciplineKey: "kickboxing" },
    { weekdayKey: "jueves", slotKey: "18:00-19:00", disciplineKey: "kickboxing" },
    { weekdayKey: "lunes", slotKey: "19:00-19:45", disciplineKey: "indoor" },
    { weekdayKey: "miercoles", slotKey: "19:00-19:45", disciplineKey: "indoor" },
    { weekdayKey: "viernes", slotKey: "19:00-19:45", disciplineKey: "indoor" },
    { weekdayKey: "lunes", slotKey: "20:00-21:00", disciplineKey: "funcional" },
    { weekdayKey: "miercoles", slotKey: "20:00-21:00", disciplineKey: "funcional" },
    { weekdayKey: "viernes", slotKey: "20:00-21:00", disciplineKey: "funcional" },
    { weekdayKey: "martes", slotKey: "20:00-21:00", disciplineKey: "fullgap" },
    { weekdayKey: "jueves", slotKey: "20:00-21:00", disciplineKey: "fullgap" },
  ];

  const WEEKDAY_INDEX = Object.fromEntries(WEEKDAYS.map((weekday) => [weekday.key, weekday]));
  const TIME_SLOT_INDEX = Object.fromEntries(TIME_SLOTS.map((slot) => [slot.key, slot]));
  const DISCIPLINE_INDEX = Object.fromEntries(DISCIPLINES.map((discipline) => [discipline.key, discipline]));

  const SLOT_ALIASES = {
    "08:00": "08:00-09:00",
    "8:00": "08:00-09:00",
    "08:00-09:00": "08:00-09:00",
    "8:00-9:00": "08:00-09:00",
    "8-9": "08:00-09:00",
    "08:15": "08:15-09:00",
    "8:15": "08:15-09:00",
    "08:15-09:00": "08:15-09:00",
    "8:15-9:00": "08:15-09:00",
    "8:15-9": "08:15-09:00",
    "09:00": "09:00-10:00",
    "9:00": "09:00-10:00",
    "09:00-10:00": "09:00-10:00",
    "9:00-10:00": "09:00-10:00",
    "9-10": "09:00-10:00",
    "16:40": "16:40",
    "18:00": "18:00-19:00",
    "18:00-19:00": "18:00-19:00",
    "18-19": "18:00-19:00",
    "18:40": "18:40",
    "19:00": "19:00-19:45",
    "19:00-19:45": "19:00-19:45",
    "19-19:45": "19:00-19:45",
    "20:00": "20:00-21:00",
    "20:00-21:00": "20:00-21:00",
    "20-21": "20:00-21:00",
  };

  const WEEKDAY_ALIASES = {
    1: "lunes",
    2: "martes",
    3: "miercoles",
    4: "jueves",
    5: "viernes",
    lunes: "lunes",
    martes: "martes",
    miercoles: "miercoles",
    miércoles: "miercoles",
    jueves: "jueves",
    viernes: "viernes",
  };

  const DISCIPLINE_ALIASES = {
    indoor: "indoor",
    indoorbike: "indoor",
    "indoor bike": "indoor",
    funcional: "funcional",
    fullgap: "fullgap",
    "full gap": "fullgap",
    kickboxing: "kickboxing",
    "kick boxing": "kickboxing",
    kick: "kickboxing",
  };

  let state = null;

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function createId() {
    return `schedule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function weekdayNumberToKey(weekdayNumber) {
    if (weekdayNumber >= 1 && weekdayNumber <= 5) {
      return WEEKDAY_ALIASES[weekdayNumber];
    }

    return "";
  }

  function parseDateKey(dateKey) {
    const [year, month, day] = String(dateKey || "").split("-").map(Number);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  function resolveWeekdayFromDate(dateKey) {
    const date = parseDateKey(dateKey);

    if (!date) {
      return "";
    }

    const weekday = date.getDay();
    return weekday === 0 ? "" : weekdayNumberToKey(weekday);
  }

  function normalizeWeekdayKey(value) {
    if (typeof value === "number") {
      return weekdayNumberToKey(value);
    }

    const normalized = normalizeText(value);

    if (/^\d+$/.test(normalized)) {
      return weekdayNumberToKey(Number(normalized));
    }

    return WEEKDAY_ALIASES[normalized] || "";
  }

  function normalizeSlotKey(value) {
    const rawValue = String(value || "").trim();

    if (TIME_SLOT_INDEX[rawValue]) {
      return rawValue;
    }

    const normalized = normalizeText(rawValue)
      .replace(/\s*hs/g, "")
      .replace(/\s+a\s+/g, "-")
      .replace(/\s+/g, "")
      .replace(/\./g, ":");

    return SLOT_ALIASES[normalized] || "";
  }

  function normalizeDisciplineKey(value) {
    const rawValue = String(value || "").trim();

    if (DISCIPLINE_INDEX[rawValue]) {
      return rawValue;
    }

    const normalized = normalizeText(rawValue)
      .replace(/\s+/g, "")
      .replace(/í/g, "i");

    return DISCIPLINE_ALIASES[normalized] || DISCIPLINE_ALIASES[normalizeText(rawValue)] || "";
  }

  function compareSchedules(left, right) {
    const leftWeekday = WEEKDAY_INDEX[left.weekdayKey]?.order || 999;
    const rightWeekday = WEEKDAY_INDEX[right.weekdayKey]?.order || 999;

    if (leftWeekday !== rightWeekday) {
      return leftWeekday - rightWeekday;
    }

    const leftSlot = TIME_SLOT_INDEX[left.slotKey]?.order || 999;
    const rightSlot = TIME_SLOT_INDEX[right.slotKey]?.order || 999;

    if (leftSlot !== rightSlot) {
      return leftSlot - rightSlot;
    }

    return left.disciplineKey.localeCompare(right.disciplineKey, "es");
  }

  function enrichSchedule(schedule) {
    const weekday = WEEKDAY_INDEX[schedule.weekdayKey];
    const slot = TIME_SLOT_INDEX[schedule.slotKey];
    const discipline = DISCIPLINE_INDEX[schedule.disciplineKey];

    return {
      ...schedule,
      weekdayLabel: weekday?.label || schedule.weekdayKey,
      weekdayOrder: weekday?.order || 999,
      slotLabel: slot?.label || schedule.slotKey,
      slotOrder: slot?.order || 999,
      disciplineLabel: discipline?.label || schedule.disciplineKey,
      accent: discipline?.accent || "neutral",
    };
  }

  function createScheduleRecord(payload = {}) {
    const now = new Date().toISOString();

    return {
      id: payload.id || createId(),
      weekdayKey: payload.weekdayKey,
      slotKey: payload.slotKey,
      disciplineKey: payload.disciplineKey,
      createdAt: payload.createdAt || now,
      updatedAt: payload.updatedAt || now,
    };
  }

  function seedDefaultSchedules() {
    return DEFAULT_SCHEDULES
      .map((schedule) => createScheduleRecord(schedule))
      .sort(compareSchedules);
  }

  function sanitizeSchedules(schedules) {
    const nextSchedules = [];
    const takenSlots = new Set();

    (Array.isArray(schedules) ? schedules : []).forEach((schedule) => {
      const weekdayKey = normalizeWeekdayKey(schedule?.weekdayKey || schedule?.weekday || schedule?.day);
      const slotKey = normalizeSlotKey(schedule?.slotKey || schedule?.slot || schedule?.time || schedule?.timeLabel);
      const disciplineKey = normalizeDisciplineKey(schedule?.disciplineKey || schedule?.discipline || schedule?.classType || schedule?.classLabel);

      if (!weekdayKey || !slotKey || !disciplineKey) {
        return;
      }

      const signature = `${weekdayKey}|${slotKey}`;

      if (takenSlots.has(signature)) {
        return;
      }

      takenSlots.add(signature);
      nextSchedules.push(
        createScheduleRecord({
          ...schedule,
          weekdayKey,
          slotKey,
          disciplineKey,
        })
      );
    });

    return nextSchedules.sort(compareSchedules);
  }

  function migrateLegacySchedules(rawState) {
    const nextSchedules = [];
    const takenSlots = new Set();
    const legacySchedules = Array.isArray(rawState?.schedules) ? rawState.schedules : [];

    legacySchedules.forEach((schedule) => {
      const weekdayKey = normalizeWeekdayKey(schedule?.weekday || schedule?.weekdayKey || schedule?.day) || resolveWeekdayFromDate(schedule?.date);
      const slotKey = normalizeSlotKey(schedule?.slotKey || schedule?.slot || schedule?.time || schedule?.timeLabel);
      const disciplineKey = normalizeDisciplineKey(schedule?.disciplineKey || schedule?.discipline || schedule?.classType || schedule?.classLabel);

      if (!weekdayKey || !slotKey || !disciplineKey) {
        return;
      }

      const signature = `${weekdayKey}|${slotKey}`;

      if (takenSlots.has(signature)) {
        return;
      }

      takenSlots.add(signature);
      nextSchedules.push(
        createScheduleRecord({
          weekdayKey,
          slotKey,
          disciplineKey,
          createdAt: schedule?.createdAt,
          updatedAt: schedule?.updatedAt,
        })
      );
    });

    return nextSchedules.sort(compareSchedules);
  }

  function sanitizeState(rawState) {
    const nextSchedules = sanitizeSchedules(rawState?.schedules);

    return {
      version: 1,
      schedules: nextSchedules.length ? nextSchedules : seedDefaultSchedules(),
    };
  }

  function dispatchChange() {
    window.dispatchEvent(
      new CustomEvent(CHANGE_EVENT, {
        detail: {
          schedules: getSchedules(),
        },
      })
    );
  }

  function readStorageValue(storageKey) {
    try {
      const rawValue = localStorage.getItem(storageKey);
      return rawValue ? JSON.parse(rawValue) : null;
    } catch (error) {
      return null;
    }
  }

  function loadState() {
    if (state) {
      return state;
    }

    const storedState = readStorageValue(STORAGE_KEY);

    if (storedState) {
      state = sanitizeState(storedState);
      return state;
    }

    for (const storageKey of LEGACY_STORAGE_KEYS) {
      const legacyState = readStorageValue(storageKey);

      if (!legacyState) {
        continue;
      }

      const migratedSchedules = migrateLegacySchedules(legacyState);
      state = sanitizeState({
        schedules: migratedSchedules.length ? migratedSchedules : seedDefaultSchedules(),
      });
      persistState();
      return state;
    }

    state = sanitizeState({ schedules: seedDefaultSchedules() });
    persistState();
    return state;
  }

  function persistState() {
    if (!state) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    dispatchChange();
  }

  function findScheduleConflict({ weekdayKey, slotKey }, excludeId = "") {
    const normalizedId = String(excludeId || "").trim();

    return loadState().schedules.find((schedule) => {
      if (normalizedId && schedule.id === normalizedId) {
        return false;
      }

      return schedule.weekdayKey === weekdayKey && schedule.slotKey === slotKey;
    }) || null;
  }

  function validateSchedulePayload(payload, currentId = "") {
    const weekdayKey = normalizeWeekdayKey(payload?.weekdayKey || payload?.weekday || payload?.day);
    const slotKey = normalizeSlotKey(payload?.slotKey || payload?.slot || payload?.time);
    const disciplineKey = normalizeDisciplineKey(payload?.disciplineKey || payload?.discipline || payload?.classType);

    if (!disciplineKey) {
      throw new Error("Elegí una disciplina válida para guardar el horario.");
    }

    if (!weekdayKey) {
      throw new Error("Elegí un día válido para la agenda.");
    }

    if (!slotKey) {
      throw new Error("Elegí una franja horaria válida.");
    }

    const duplicate = findScheduleConflict({ weekdayKey, slotKey }, currentId);

    if (duplicate) {
      throw new Error("Ya existe una disciplina cargada en ese día y franja horaria.");
    }

    return {
      weekdayKey,
      slotKey,
      disciplineKey,
    };
  }

  function getSchedules(filters = {}) {
    return loadState().schedules
      .map(enrichSchedule)
      .filter((schedule) => {
        if (filters.weekdayKey && schedule.weekdayKey !== filters.weekdayKey) {
          return false;
        }

        if (filters.slotKey && schedule.slotKey !== filters.slotKey) {
          return false;
        }

        if (filters.disciplineKey && schedule.disciplineKey !== filters.disciplineKey) {
          return false;
        }

        return true;
      })
      .sort(compareSchedules);
  }

  function getScheduleById(scheduleId) {
    return getSchedules().find((schedule) => schedule.id === scheduleId) || null;
  }

  function createSchedule(payload) {
    const validatedPayload = validateSchedulePayload(payload);
    const record = createScheduleRecord(validatedPayload);

    loadState().schedules.push(record);
    loadState().schedules.sort(compareSchedules);
    persistState();
    return getScheduleById(record.id);
  }

  function updateSchedule(scheduleId, payload) {
    const normalizedId = String(scheduleId || "").trim();
    const scheduleIndex = loadState().schedules.findIndex((schedule) => schedule.id === normalizedId);

    if (scheduleIndex === -1) {
      throw new Error("No encontramos ese horario para editar.");
    }

    const currentSchedule = loadState().schedules[scheduleIndex];
    const validatedPayload = {
      weekdayKey: normalizeWeekdayKey(payload?.weekdayKey || payload?.weekday || payload?.day),
      slotKey: normalizeSlotKey(payload?.slotKey || payload?.slot || payload?.time),
      disciplineKey: normalizeDisciplineKey(payload?.disciplineKey || payload?.discipline || payload?.classType),
    };

    if (!validatedPayload.disciplineKey) {
      throw new Error("Elegí una disciplina válida para guardar el horario.");
    }

    if (!validatedPayload.weekdayKey) {
      throw new Error("Elegí un día válido para la agenda.");
    }

    if (!validatedPayload.slotKey) {
      throw new Error("Elegí una franja horaria válida.");
    }

    const isSameSlot =
      currentSchedule.weekdayKey === validatedPayload.weekdayKey
      && currentSchedule.slotKey === validatedPayload.slotKey;

    if (!isSameSlot) {
      const duplicate = findScheduleConflict(validatedPayload, normalizedId);

      if (duplicate) {
        throw new Error("Ya existe una disciplina cargada en ese día y franja horaria.");
      }
    }

    loadState().schedules[scheduleIndex] = createScheduleRecord({
      ...currentSchedule,
      ...validatedPayload,
      id: currentSchedule.id,
      createdAt: currentSchedule.createdAt,
      updatedAt: new Date().toISOString(),
    });

    loadState().schedules.sort(compareSchedules);
    persistState();
    return getScheduleById(scheduleId);
  }

  function deleteSchedule(scheduleId) {
    const existingSchedule = getScheduleById(scheduleId);

    if (!existingSchedule) {
      throw new Error("No encontramos ese horario para eliminar.");
    }

    state.schedules = loadState().schedules.filter((schedule) => schedule.id !== scheduleId);
    persistState();
    return existingSchedule;
  }

  function getScheduleBoardData() {
    const schedules = getSchedules();

    return {
      columns: WEEKDAYS,
      rows: TIME_SLOTS.map((slot) => ({
        key: slot.key,
        label: slot.label,
        cells: WEEKDAYS.map((weekday) => {
          const schedule = schedules.find(
            (item) => item.weekdayKey === weekday.key && item.slotKey === slot.key
          );

          if (!schedule) {
            return {
              label: "Libre",
              className: "schedule-slot is-empty",
            };
          }

          return {
            label: schedule.disciplineLabel.toUpperCase(),
            className: `schedule-slot is-active is-${schedule.accent}`,
          };
        }),
      })),
    };
  }

  function getScheduleGroups() {
    const schedules = getSchedules();

    return WEEKDAYS.map((weekday) => ({
      ...weekday,
      items: schedules.filter((schedule) => schedule.weekdayKey === weekday.key),
    }));
  }

  function getDisciplineSummaries() {
    const schedules = getSchedules();

    return DISCIPLINES.map((discipline) => {
      const disciplineSchedules = schedules.filter((schedule) => schedule.disciplineKey === discipline.key);

      return {
        ...discipline,
        count: disciplineSchedules.length,
        summaryLabel: disciplineSchedules.length
          ? `${disciplineSchedules.length} horario${disciplineSchedules.length === 1 ? "" : "s"} cargado${disciplineSchedules.length === 1 ? "" : "s"}`
          : "Sin horarios cargados",
      };
    });
  }

  function getStats() {
    const schedules = getSchedules();

    return {
      totalSchedules: schedules.length,
      activeDisciplines: new Set(schedules.map((schedule) => schedule.disciplineKey)).size,
      activeDays: new Set(schedules.map((schedule) => schedule.weekdayKey)).size,
      baseSlots: TIME_SLOTS.length,
    };
  }

  function formatWeekday(weekdayKey) {
    return WEEKDAY_INDEX[weekdayKey]?.label || "";
  }

  function formatScheduleSlot(slotKey) {
    return TIME_SLOT_INDEX[slotKey]?.label || "";
  }

  function getDisciplines() {
    return [...DISCIPLINES];
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }

    state = sanitizeState(readStorageValue(STORAGE_KEY) || { schedules: seedDefaultSchedules() });
    dispatchChange();
  });

  window.EstudiantesTboBooking = {
    adminPin: ADMIN_PIN,
    changeEvent: CHANGE_EVENT,
    weekdays: WEEKDAYS,
    timeSlots: TIME_SLOTS,
    disciplines: DISCIPLINES,
    getDisciplines,
    getSchedules,
    getScheduleById,
    getScheduleBoardData,
    getScheduleGroups,
    getDisciplineSummaries,
    getStats,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    formatWeekday,
    formatScheduleSlot,
  };
})();
