(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.EstudiantesTboScheduleCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CUSTOM_ACCENTS = ["available", "accent", "highlight", "danger", "neutral"];
  const CUSTOM_DISCIPLINE_VALUE = "__custom_discipline__";
  const CUSTOM_SLOT_VALUE = "__custom_slot__";

  const WEEKDAYS = [
    { key: "lunes", label: "Lunes", order: 1 },
    { key: "martes", label: "Martes", order: 2 },
    { key: "miercoles", label: "Miércoles", order: 3 },
    { key: "jueves", label: "Jueves", order: 4 },
    { key: "viernes", label: "Viernes", order: 5 },
  ];

  const BASE_TIME_SLOTS = [
    { key: "08:00-09:00", label: "8:00 a 9:00" },
    { key: "08:15-09:00", label: "8:15 a 9:00" },
    { key: "09:00-10:00", label: "9:00 a 10:00" },
    { key: "16:40", label: "16:40 hs" },
    { key: "18:00-19:00", label: "18:00 a 19:00" },
    { key: "18:40", label: "18:40 hs" },
    { key: "19:00-19:45", label: "19:00 a 19:45" },
    { key: "20:00-21:00", label: "20:00 a 21:00" },
  ];

  const BASE_DISCIPLINES = [
    { key: "indoor", label: "Indoor Bike", accent: "accent", order: 1 },
    { key: "funcional", label: "Funcional", accent: "available", order: 2 },
    { key: "fullgap", label: "Full Gap", accent: "highlight", order: 3 },
    { key: "kickboxing", label: "Kick Boxing", accent: "danger", order: 4 },
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
  const BASE_DISCIPLINE_KEY_SET = new Set(BASE_DISCIPLINES.map((discipline) => discipline.key));
  const BASE_TIME_SLOT_KEY_SET = new Set(BASE_TIME_SLOTS.map((slot) => slot.key));
  const DISCIPLINE_ALIAS_MAP = {
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

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function sanitizeDisciplineLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function toTitleCase(value) {
    return sanitizeDisciplineLabel(value)
      .split(" ")
      .filter(Boolean)
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
      .join(" ");
  }

  function slugify(value) {
    return normalizeText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getAccentFromSeed(seed) {
    const hash = [...normalizeText(seed)].reduce((total, character) => total + character.charCodeAt(0), 0);
    return CUSTOM_ACCENTS[hash % CUSTOM_ACCENTS.length];
  }

  function createId() {
    return `schedule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function cloneState(sourceState) {
    return {
      version: Number(sourceState?.version || 2),
      customTimeSlots: (Array.isArray(sourceState?.customTimeSlots) ? sourceState.customTimeSlots : []).map((slot) => ({ ...slot })),
      customDisciplines: (Array.isArray(sourceState?.customDisciplines) ? sourceState.customDisciplines : []).map((discipline) => ({ ...discipline })),
      schedules: (Array.isArray(sourceState?.schedules) ? sourceState.schedules : []).map((schedule) => ({ ...schedule })),
    };
  }

  function weekdayNumberToKey(weekdayNumber) {
    return WEEKDAYS.find((weekday) => weekday.order === weekdayNumber)?.key || "";
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

    if (normalized === "miercoles") {
      return "miercoles";
    }

    return WEEKDAYS.find((weekday) => normalizeText(weekday.label) === normalized || weekday.key === normalized)?.key || "";
  }

  function parseTimeToken(rawValue) {
    const value = String(rawValue || "").trim().replace(".", ":");
    const match = value.match(/^(\d{1,2})(?::(\d{2}))?$/);

    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2] || "0");

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    const canonical = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const display = `${hours}:${String(minutes).padStart(2, "0")}`;

    return {
      canonical,
      display,
      minutes: hours * 60 + minutes,
    };
  }

  function parseTimeSlotValue(rawValue) {
    const normalized = normalizeText(rawValue).replace(/\./g, ":");

    if (!normalized) {
      return null;
    }

    const rangeMatch = normalized.match(/^(\d{1,2}(?::\d{2})?)\s*a\s*(\d{1,2}(?::\d{2})?)$/);

    if (rangeMatch) {
      const start = parseTimeToken(rangeMatch[1]);
      const end = parseTimeToken(rangeMatch[2]);

      if (!start || !end || end.minutes <= start.minutes) {
        return null;
      }

      return {
        key: `${start.canonical}-${end.canonical}`,
        label: `${start.display} a ${end.display}`,
        startMinutes: start.minutes,
        endMinutes: end.minutes,
      };
    }

    const singleMatch = normalized.match(/^(\d{1,2}(?::\d{2})?)(?:\s*hs?)?$/);

    if (!singleMatch) {
      return null;
    }

    const time = parseTimeToken(singleMatch[1]);

    if (!time) {
      return null;
    }

    return {
      key: time.canonical,
      label: `${time.display} hs`,
      startMinutes: time.minutes,
      endMinutes: time.minutes,
    };
  }

  function buildTimeSlotMeta(slot, custom = false) {
    const parsed = parseTimeSlotValue(slot?.label || slot?.key || slot);

    if (!parsed) {
      return null;
    }

    return {
      key: parsed.key,
      label: slot?.label || parsed.label,
      startMinutes: parsed.startMinutes,
      endMinutes: parsed.endMinutes,
      custom,
      createdAt: slot?.createdAt || new Date().toISOString(),
    };
  }

  function compareTimeSlots(left, right) {
    if (left.startMinutes !== right.startMinutes) {
      return left.startMinutes - right.startMinutes;
    }

    if (left.endMinutes !== right.endMinutes) {
      return left.endMinutes - right.endMinutes;
    }

    return left.label.localeCompare(right.label, "es");
  }

  const BASE_TIME_SLOT_META = BASE_TIME_SLOTS.map((slot) => buildTimeSlotMeta(slot, false)).sort(compareTimeSlots);

  function buildDisciplineMeta(discipline, custom = false) {
    const label = discipline?.label ? discipline.label : toTitleCase(discipline);
    const key = String(discipline?.key || slugify(label)).trim();

    if (!key || !label) {
      return null;
    }

    return {
      key,
      label,
      accent: discipline?.accent || getAccentFromSeed(label),
      order: discipline?.order || 999,
      custom,
      createdAt: discipline?.createdAt || new Date().toISOString(),
    };
  }

  function compareDisciplines(left, right) {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.label.localeCompare(right.label, "es");
  }

  const BASE_DISCIPLINE_META = BASE_DISCIPLINES.map((discipline) => buildDisciplineMeta(discipline, false)).sort(compareDisciplines);

  function getTimeSlotsFromState(sourceState, options = {}) {
    const allSlots = [...BASE_TIME_SLOT_META, ...(sourceState.customTimeSlots || [])];

    if (!options.activeOnly) {
      return [...allSlots].sort(compareTimeSlots);
    }

    const activeKeys = new Set((sourceState.schedules || []).map((schedule) => schedule.slotKey));
    return allSlots
      .filter((slot) => BASE_TIME_SLOT_KEY_SET.has(slot.key) || activeKeys.has(slot.key))
      .sort(compareTimeSlots);
  }

  function getTimeSlotIndexFromState(sourceState, options = {}) {
    return Object.fromEntries(getTimeSlotsFromState(sourceState, options).map((slot) => [slot.key, slot]));
  }

  function getDisciplinesFromState(sourceState, options = {}) {
    const allDisciplines = [...BASE_DISCIPLINE_META, ...(sourceState.customDisciplines || [])];

    if (!options.activeOnly) {
      return [...allDisciplines].sort(compareDisciplines);
    }

    const activeKeys = new Set((sourceState.schedules || []).map((schedule) => schedule.disciplineKey));
    return allDisciplines
      .filter((discipline) => activeKeys.has(discipline.key))
      .sort(compareDisciplines);
  }

  function getDisciplineIndexFromState(sourceState, options = {}) {
    return Object.fromEntries(getDisciplinesFromState(sourceState, options).map((discipline) => [discipline.key, discipline]));
  }

  function findTimeSlotMeta(sourceState, value) {
    const rawValue = String(value || "").trim();

    if (!rawValue) {
      return null;
    }

    const slotIndex = getTimeSlotIndexFromState(sourceState);

    if (slotIndex[rawValue]) {
      return slotIndex[rawValue];
    }

    const parsed = parseTimeSlotValue(rawValue);

    if (!parsed) {
      return null;
    }

    return slotIndex[parsed.key] || null;
  }

  function findDisciplineMeta(sourceState, value) {
    const rawValue = String(value || "").trim();

    if (!rawValue) {
      return null;
    }

    const disciplineIndex = getDisciplineIndexFromState(sourceState);

    if (disciplineIndex[rawValue]) {
      return disciplineIndex[rawValue];
    }

    const normalized = normalizeText(rawValue);
    const alias = DISCIPLINE_ALIAS_MAP[normalized] || DISCIPLINE_ALIAS_MAP[normalized.replace(/\s+/g, "")];

    if (alias && disciplineIndex[alias]) {
      return disciplineIndex[alias];
    }

    return getDisciplinesFromState(sourceState).find((discipline) => normalizeText(discipline.label) === normalized) || null;
  }

  function sanitizeCustomTimeSlots(rawSlots) {
    const seen = new Set(BASE_TIME_SLOT_KEY_SET);

    return (Array.isArray(rawSlots) ? rawSlots : [])
      .map((slot) => buildTimeSlotMeta(slot, true))
      .filter((slot) => {
        if (!slot || seen.has(slot.key)) {
          return false;
        }

        seen.add(slot.key);
        return true;
      })
      .sort(compareTimeSlots);
  }

  function sanitizeCustomDisciplines(rawDisciplines) {
    const seen = new Set(BASE_DISCIPLINE_KEY_SET);

    return (Array.isArray(rawDisciplines) ? rawDisciplines : [])
      .map((discipline) => buildDisciplineMeta(discipline, true))
      .filter((discipline) => {
        if (!discipline || seen.has(discipline.key)) {
          return false;
        }

        seen.add(discipline.key);
        return true;
      })
      .sort(compareDisciplines);
  }

  function ensureCustomTimeSlotInState(sourceState, value) {
    const existingSlot = findTimeSlotMeta(sourceState, value);

    if (existingSlot) {
      return existingSlot.key;
    }

    const slot = buildTimeSlotMeta({ label: value }, true);

    if (!slot) {
      return "";
    }

    const currentIndex = Object.fromEntries(sourceState.customTimeSlots.map((item) => [item.key, item]));

    if (!BASE_TIME_SLOT_KEY_SET.has(slot.key) && !currentIndex[slot.key]) {
      sourceState.customTimeSlots.push(slot);
      sourceState.customTimeSlots.sort(compareTimeSlots);
    }

    return slot.key;
  }

  function ensureCustomDisciplineInState(sourceState, value) {
    const existingDiscipline = findDisciplineMeta(sourceState, value);

    if (existingDiscipline) {
      return existingDiscipline.key;
    }

    const label = toTitleCase(value);

    if (!label) {
      return "";
    }

    const baseSlug = slugify(label) || `disciplina-${Date.now()}`;
    let key = baseSlug;
    let suffix = 2;

    while (BASE_DISCIPLINE_KEY_SET.has(key) || sourceState.customDisciplines.some((discipline) => discipline.key === key)) {
      key = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const customDiscipline = buildDisciplineMeta(
      {
        key,
        label,
        accent: getAccentFromSeed(label),
        order: 999,
      },
      true
    );

    sourceState.customDisciplines.push(customDiscipline);
    sourceState.customDisciplines.sort(compareDisciplines);
    return customDiscipline.key;
  }

  function resolveSlotKey(sourceState, payloadValue, allowCreate = false) {
    const existing = findTimeSlotMeta(sourceState, payloadValue);

    if (existing) {
      return existing.key;
    }

    return allowCreate ? ensureCustomTimeSlotInState(sourceState, payloadValue) : "";
  }

  function resolveDisciplineKey(sourceState, payloadValue, allowCreate = false) {
    const existing = findDisciplineMeta(sourceState, payloadValue);

    if (existing) {
      return existing.key;
    }

    return allowCreate ? ensureCustomDisciplineInState(sourceState, payloadValue) : "";
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

  function createScheduleComparator(sourceState) {
    const timeSlotIndex = getTimeSlotIndexFromState(sourceState);
    const disciplineIndex = getDisciplineIndexFromState(sourceState);

    return (left, right) => {
      const leftWeekday = WEEKDAY_INDEX[left.weekdayKey]?.order || 999;
      const rightWeekday = WEEKDAY_INDEX[right.weekdayKey]?.order || 999;

      if (leftWeekday !== rightWeekday) {
        return leftWeekday - rightWeekday;
      }

      const leftSlot = timeSlotIndex[left.slotKey];
      const rightSlot = timeSlotIndex[right.slotKey];

      if ((leftSlot?.startMinutes || 9999) !== (rightSlot?.startMinutes || 9999)) {
        return (leftSlot?.startMinutes || 9999) - (rightSlot?.startMinutes || 9999);
      }

      if ((leftSlot?.endMinutes || 9999) !== (rightSlot?.endMinutes || 9999)) {
        return (leftSlot?.endMinutes || 9999) - (rightSlot?.endMinutes || 9999);
      }

      const leftDiscipline = disciplineIndex[left.disciplineKey];
      const rightDiscipline = disciplineIndex[right.disciplineKey];

      return (leftDiscipline?.label || left.disciplineKey).localeCompare(rightDiscipline?.label || right.disciplineKey, "es");
    };
  }

  function sanitizeSchedules(rawSchedules, sourceState) {
    const signatures = new Set();

    return (Array.isArray(rawSchedules) ? rawSchedules : [])
      .map((schedule) => {
        const weekdayKey = normalizeWeekdayKey(schedule?.weekdayKey || schedule?.weekday || schedule?.day) || resolveWeekdayFromDate(schedule?.date);
        const slotValue = schedule?.slotKey || schedule?.slotValue || schedule?.slot || schedule?.time || schedule?.timeLabel;
        const disciplineValue = schedule?.disciplineKey || schedule?.disciplineValue || schedule?.discipline || schedule?.classType || schedule?.classLabel;
        const slotKey = resolveSlotKey(sourceState, slotValue, true);
        const disciplineKey = resolveDisciplineKey(sourceState, disciplineValue, true);

        if (!weekdayKey || !slotKey || !disciplineKey) {
          return null;
        }

        const signature = `${weekdayKey}|${slotKey}|${disciplineKey}`;

        if (signatures.has(signature)) {
          return null;
        }

        signatures.add(signature);
        return createScheduleRecord({
          ...schedule,
          weekdayKey,
          slotKey,
          disciplineKey,
        });
      })
      .filter(Boolean)
      .sort(createScheduleComparator(sourceState));
  }

  function sanitizeState(rawState) {
    const nextState = {
      version: 2,
      customTimeSlots: sanitizeCustomTimeSlots(rawState?.customTimeSlots),
      customDisciplines: sanitizeCustomDisciplines(rawState?.customDisciplines),
      schedules: [],
    };

    nextState.schedules = sanitizeSchedules(rawState?.schedules, nextState);

    if (!nextState.schedules.length) {
      nextState.schedules = sanitizeSchedules(DEFAULT_SCHEDULES, nextState);
    }

    return nextState;
  }

  function createDefaultState() {
    return sanitizeState({ schedules: DEFAULT_SCHEDULES });
  }

  function findScheduleConflict(sourceState, { weekdayKey, slotKey, disciplineKey }, excludeId = "") {
    const normalizedId = String(excludeId || "").trim();

    return sourceState.schedules.find((schedule) => {
      if (normalizedId && schedule.id === normalizedId) {
        return false;
      }

      return (
        schedule.weekdayKey === weekdayKey
        && schedule.slotKey === slotKey
        && schedule.disciplineKey === disciplineKey
      );
    }) || null;
  }

  function buildValidatedPayload(sourceState, payload, currentId = "") {
    const weekdayKey = normalizeWeekdayKey(payload?.weekdayKey || payload?.weekday || payload?.day);
    const disciplineValue = payload?.disciplineValue || payload?.disciplineKey || payload?.discipline || payload?.classType;
    const slotValue = payload?.slotValue || payload?.slotKey || payload?.slot || payload?.time;
    const disciplineKey = resolveDisciplineKey(sourceState, disciplineValue, true);
    const slotKey = resolveSlotKey(sourceState, slotValue, true);

    if (!disciplineKey) {
      throw new Error("Elegí una disciplina válida para guardar el horario.");
    }

    if (!weekdayKey) {
      throw new Error("Elegí un día válido para la agenda.");
    }

    if (!slotKey) {
      throw new Error("Ingresá una franja horaria válida.");
    }

    const duplicate = findScheduleConflict(
      sourceState,
      {
        weekdayKey,
        slotKey,
        disciplineKey,
      },
      currentId
    );

    if (duplicate) {
      throw new Error("Ya existe esa disciplina cargada en ese día y en esa franja horaria.");
    }

    return {
      weekdayKey,
      slotKey,
      disciplineKey,
    };
  }

  function enrichSchedule(sourceState, schedule) {
    const timeSlotIndex = getTimeSlotIndexFromState(sourceState);
    const disciplineIndex = getDisciplineIndexFromState(sourceState);
    const weekday = WEEKDAY_INDEX[schedule.weekdayKey];
    const slot = timeSlotIndex[schedule.slotKey];
    const discipline = disciplineIndex[schedule.disciplineKey];

    return {
      ...schedule,
      weekdayLabel: weekday?.label || schedule.weekdayKey,
      weekdayOrder: weekday?.order || 999,
      slotLabel: slot?.label || schedule.slotKey,
      slotOrder: slot?.startMinutes || 9999,
      disciplineLabel: discipline?.label || schedule.disciplineKey,
      accent: discipline?.accent || "neutral",
      isCustomDiscipline: Boolean(discipline?.custom),
      isCustomSlot: Boolean(slot?.custom),
    };
  }

  function getTimeSlots(sourceState, options = {}) {
    return getTimeSlotsFromState(sourceState, options);
  }

  function getDisciplines(sourceState, options = {}) {
    return getDisciplinesFromState(sourceState, options);
  }

  function getSchedules(sourceState, filters = {}) {
    return sourceState.schedules
      .map((schedule) => enrichSchedule(sourceState, schedule))
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
      .sort(createScheduleComparator(sourceState));
  }

  function getScheduleById(sourceState, scheduleId) {
    return getSchedules(sourceState).find((schedule) => schedule.id === scheduleId) || null;
  }

  function createSchedule(sourceState, payload) {
    const nextState = cloneState(sourceState);
    const validatedPayload = buildValidatedPayload(nextState, payload);
    const record = createScheduleRecord(validatedPayload);

    nextState.schedules.push(record);
    nextState.schedules.sort(createScheduleComparator(nextState));

    return {
      state: nextState,
      schedule: getScheduleById(nextState, record.id),
    };
  }

  function updateSchedule(sourceState, scheduleId, payload) {
    const nextState = cloneState(sourceState);
    const normalizedId = String(scheduleId || "").trim();
    const scheduleIndex = nextState.schedules.findIndex((schedule) => schedule.id === normalizedId);

    if (scheduleIndex === -1) {
      throw new Error("No encontramos ese horario para editar.");
    }

    const currentSchedule = nextState.schedules[scheduleIndex];
    const validatedPayload = buildValidatedPayload(nextState, payload, normalizedId);

    nextState.schedules[scheduleIndex] = createScheduleRecord({
      ...currentSchedule,
      ...validatedPayload,
      id: currentSchedule.id,
      createdAt: currentSchedule.createdAt,
      updatedAt: new Date().toISOString(),
    });

    nextState.schedules.sort(createScheduleComparator(nextState));

    return {
      state: nextState,
      schedule: getScheduleById(nextState, scheduleId),
    };
  }

  function deleteSchedule(sourceState, scheduleId) {
    const nextState = cloneState(sourceState);
    const existingSchedule = getScheduleById(nextState, scheduleId);

    if (!existingSchedule) {
      throw new Error("No encontramos ese horario para eliminar.");
    }

    nextState.schedules = nextState.schedules.filter((schedule) => schedule.id !== scheduleId);

    return {
      state: nextState,
      schedule: existingSchedule,
    };
  }

  function getScheduleBoardData(sourceState) {
    const schedules = getSchedules(sourceState);
    const boardSlots = getTimeSlots(sourceState, { activeOnly: true });

    return {
      columns: WEEKDAYS,
      rows: boardSlots.map((slot) => ({
        key: slot.key,
        label: slot.label,
        cells: WEEKDAYS.map((weekday) => {
          const cellSchedules = schedules
            .filter((schedule) => schedule.weekdayKey === weekday.key && schedule.slotKey === slot.key)
            .sort((left, right) => left.disciplineLabel.localeCompare(right.disciplineLabel, "es"));

          if (!cellSchedules.length) {
            return {
              label: "Libre",
              className: "schedule-slot is-empty",
              items: [],
            };
          }

          if (cellSchedules.length === 1) {
            return {
              label: cellSchedules[0].disciplineLabel.toUpperCase(),
              className: `schedule-slot is-active is-${cellSchedules[0].accent}`,
              items: [
                {
                  label: cellSchedules[0].disciplineLabel.toUpperCase(),
                  accent: cellSchedules[0].accent,
                },
              ],
            };
          }

          return {
            label: "",
            className: "schedule-slot is-active is-multi",
            items: cellSchedules.map((schedule) => ({
              label: schedule.disciplineLabel.toUpperCase(),
              accent: schedule.accent,
            })),
          };
        }),
      })),
    };
  }

  function getDisciplineSummaries(sourceState, options = {}) {
    const schedules = getSchedules(sourceState);
    const summaries = getDisciplines(sourceState)
      .map((discipline) => {
        const disciplineSchedules = schedules.filter((schedule) => schedule.disciplineKey === discipline.key);
        const activeDays = [...new Set(disciplineSchedules.map((schedule) => schedule.weekdayLabel))];

        return {
          ...discipline,
          count: disciplineSchedules.length,
          activeDays,
          summaryLabel: disciplineSchedules.length
            ? `${disciplineSchedules.length} horario${disciplineSchedules.length === 1 ? "" : "s"} | ${activeDays.join(", ")}`
            : discipline.custom
              ? "Disponible para sumar a la agenda"
              : "Sin horarios cargados",
        };
      })
      .sort(compareDisciplines);

    return options.activeOnly ? summaries.filter((discipline) => discipline.count > 0) : summaries;
  }

  function getStats(sourceState) {
    const schedules = getSchedules(sourceState);
    const activeSlotCount = new Set(schedules.map((schedule) => schedule.slotKey)).size;

    return {
      totalSchedules: schedules.length,
      activeDisciplines: new Set(schedules.map((schedule) => schedule.disciplineKey)).size,
      activeDays: new Set(schedules.map((schedule) => schedule.weekdayKey)).size,
      availableSlots: getTimeSlots(sourceState).length,
      activeSlots: activeSlotCount,
    };
  }

  function formatWeekday(weekdayKey) {
    return WEEKDAY_INDEX[weekdayKey]?.label || "";
  }

  function formatScheduleSlot(sourceState, slotKey) {
    return getTimeSlotIndexFromState(sourceState)[slotKey]?.label || slotKey || "";
  }

  return {
    customDisciplineValue: CUSTOM_DISCIPLINE_VALUE,
    customSlotValue: CUSTOM_SLOT_VALUE,
    weekdays: WEEKDAYS,
    baseTimeSlots: BASE_TIME_SLOTS,
    baseDisciplines: BASE_DISCIPLINES,
    defaultSchedules: DEFAULT_SCHEDULES,
    sanitizeState,
    createDefaultState,
    cloneState,
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
});
