(function () {
  const STORAGE_KEY = "estudiantes_tbo_premium_v3";
  const LEGACY_STORAGE_KEY = "estudiantes_tbo_premium_v2";
  const CHANGE_EVENT = "estudiantes-tbo-booking:changed";
  const HORIZON_DAYS = 30;
  const ADMIN_PIN = "TBO2026";
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const SCHEDULE_SCHEMA_VERSION = 3;
  const DUPLICATE_ACTIVE_PLAN_MESSAGE = "Este socio ya tiene activa esta disciplina. Solo se puede aprobar si se trata de otra disciplina o plan diferente.";

  const DEFAULT_DISCIPLINE_CAPACITY = 12;
  const DISCIPLINE_ACCENTS = ["available", "accent", "highlight", "danger", "neutral"];
  const BASE_CLASS_TYPES = {
    funcional: { label: "Funcional", accent: "available", capacity: 20, reservable: true, schedulable: true },
    indoor: { label: "Indoor Bike", accent: "accent", capacity: 15, reservable: true, schedulable: true },
    fullgap: { label: "Full Gap", accent: "highlight", capacity: 20, reservable: true, schedulable: true },
    kick: { label: "Kick Boxing", accent: "danger", capacity: 14, reservable: true, schedulable: true },
    musculacion: { label: "Musculación Guiada", accent: "neutral", capacity: 20, reservable: false, schedulable: false },
  };
  const CLASS_TYPES = { ...BASE_CLASS_TYPES };

  const MEMBERSHIP_PLANS = {
    general_diario: {
      label: "Pase diario",
      price: 250,
      durationDays: 1,
      category: "general",
      access: "Acceso por 1 día con ingreso a musculación, indoor bike, full gap y funcional.",
      isPublic: true,
    },
    general_semanal: {
      label: "Pase semanal",
      price: 550,
      durationDays: 7,
      category: "general",
      access: "Acceso por 7 días para entrenar con libertad y sostener la semana completa.",
      isPublic: true,
    },
    general_15dias: {
      label: "Pase 15 días",
      price: 850,
      durationDays: 15,
      category: "general",
      access: "Acceso por 15 días con vencimiento automático y control ágil en recepción.",
      isPublic: true,
    },
    general_mensual: {
      label: "Mensual",
      price: 1600,
      durationDays: 30,
      category: "general",
      access: "Acceso por 30 días con musculación y clases habilitadas bajo la misma membresía.",
      isPublic: true,
    },
    general_trimestral: {
      label: "Trimestral",
      price: 5250,
      durationDays: 90,
      category: "general",
      access: "Acceso general por 90 días para sostener continuidad y progreso.",
      isPublic: false,
    },
    general_anual: {
      label: "Anual",
      price: 18900,
      durationDays: 365,
      category: "general",
      access: "Acceso general premium durante 365 días con control centralizado.",
      isPublic: false,
    },
    musculacion_mensual: {
      label: "Mensual musculación",
      price: 1600,
      durationDays: 30,
      category: "musculacion",
      access: "Acceso libre durante 30 días a cualquier horario.",
      isPublic: false,
    },
    musculacion_semanal: {
      label: "Semanal musculación",
      price: 600,
      durationDays: 7,
      category: "musculacion",
      access: "Acceso libre por 7 días consecutivos.",
      isPublic: false,
    },
    pase_diario: {
      label: "Pase diario musculación",
      price: 250,
      durationDays: 1,
      category: "musculacion",
      access: "Acceso por 1 día al gimnasio.",
      isPublic: false,
    },
    clase_funcional: {
      label: "Funcional mensual",
      price: 1600,
      durationDays: 30,
      category: "clases",
      classType: "funcional",
      access: "Suscripción mensual de Funcional por 30 días, sin reserva diaria por horario.",
      isPublic: false,
    },
    clase_fullgap: {
      label: "Full Gap mensual",
      price: 1600,
      durationDays: 30,
      category: "clases",
      classType: "fullgap",
      access: "Suscripción mensual de Full Gap por 30 días, sin reserva diaria por horario.",
      isPublic: false,
    },
    clase_indoor: {
      label: "Indoor Bike mensual",
      price: 1600,
      durationDays: 30,
      category: "clases",
      classType: "indoor",
      access: "Suscripción mensual de Indoor Bike por 30 días, sin reserva diaria por horario.",
      isPublic: false,
    },
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
  };

  const HOME_BOARD_WEEKDAYS = [1, 2, 3, 4, 5];
  const HOME_BOARD_LABELS = {
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
  };
  const HOME_BASE_TIMES = ["08:00", "08:15", "18:00", "19:00", "20:00"];
  const HOME_TIME_LABELS = {
    "08:00": "8:00 a 9:00",
    "08:15": "8:15 a 9:00",
    "18:00": "18:00 a 19:00",
    "19:00": "19:00 a 19:45",
    "20:00": "20:00 a 21:00",
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

  function endOfDay(dateKey) {
    const date = parseDateKey(dateKey);
    date.setHours(23, 59, 59, 999);
    return date;
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

  function normalizeComparableText(value) {
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

  function slugifyDisciplineLabel(value) {
    return normalizeComparableText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeCapacityValue(value, fallback = DEFAULT_DISCIPLINE_CAPACITY) {
    const numericCapacity = Number(value);

    if (!Number.isFinite(numericCapacity)) {
      return fallback;
    }

    return Math.max(1, Math.round(numericCapacity));
  }

  function getAccentFromSeed(seed) {
    const normalizedSeed = normalizeComparableText(seed);
    const hash = [...normalizedSeed].reduce((total, character) => total + character.charCodeAt(0), 0);
    return DISCIPLINE_ACCENTS[hash % DISCIPLINE_ACCENTS.length];
  }

  function syncClassRegistry(state) {
    Object.keys(CLASS_TYPES).forEach((key) => {
      if (!BASE_CLASS_TYPES[key]) {
        delete CLASS_TYPES[key];
      }
    });

    Object.entries(state.customClasses || {}).forEach(([key, meta]) => {
      const label = sanitizeDisciplineLabel(meta?.label || "");

      if (!label) {
        return;
      }

      CLASS_TYPES[key] = {
        label,
        accent: meta?.accent || getAccentFromSeed(label || key),
        capacity: normalizeCapacityValue(meta?.capacity, DEFAULT_DISCIPLINE_CAPACITY),
        reservable: meta?.reservable !== false,
        schedulable: meta?.schedulable !== false,
      };
    });
  }

  function getClassTypeByLabel(label) {
    const normalizedLabel = normalizeComparableText(label);

    if (!normalizedLabel) {
      return "";
    }

    return Object.entries(CLASS_TYPES).find(([, meta]) => normalizeComparableText(meta.label) === normalizedLabel)?.[0] || "";
  }

  function ensureSchedulableClassType(state, input) {
    const label = sanitizeDisciplineLabel(input);

    if (!label) {
      throw new Error("Ingresá una disciplina válida.");
    }

    if (CLASS_TYPES[label]) {
      return label;
    }

    const existingKey = getClassTypeByLabel(label);

    if (existingKey) {
      return existingKey;
    }

    const baseKey = slugifyDisciplineLabel(label) || `disciplina-${Date.now()}`;
    let classType = baseKey;
    let suffix = 2;

    while (CLASS_TYPES[classType] || state.customClasses[classType]) {
      classType = `${baseKey}-${suffix}`;
      suffix += 1;
    }

    state.customClasses[classType] = {
      label,
      accent: getAccentFromSeed(label),
      capacity: DEFAULT_DISCIPLINE_CAPACITY,
      reservable: true,
      schedulable: true,
      createdAt: new Date().toISOString(),
    };

    syncClassRegistry(state);
    return classType;
  }

  function stripDigits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function sanitizePhoneInput(value) {
    return stripDigits(value).slice(0, 9);
  }

  function sanitizeNationalIdInput(value) {
    return stripDigits(value).slice(0, 8);
  }

  function sanitizeCheckinInput(value) {
    return stripDigits(value).slice(0, 8);
  }

  function validatePhone(value) {
    const digits = sanitizePhoneInput(value);

    if (!/^\d{9}$/.test(digits)) {
      throw new Error("Ingresá un número válido de 9 dígitos");
    }

    return digits;
  }

  function validateNationalId(value) {
    const digits = sanitizeNationalIdInput(value);

    if (!/^\d{7,8}$/.test(digits)) {
      throw new Error("Ingresá una cédula válida");
    }

    return digits;
  }

  function validateCheckinQuery(value) {
    const digits = sanitizeCheckinInput(value);

    if (!/^(\d{4,6}|\d{7,8})$/.test(digits)) {
      throw new Error("Ingresá un código o una cédula válida.");
    }

    return digits;
  }

  function getClassMeta(classType) {
    return CLASS_TYPES[classType] || {
      label: sanitizeDisciplineLabel(classType) || "Disciplina",
      accent: "neutral",
      capacity: DEFAULT_DISCIPLINE_CAPACITY,
      reservable: false,
      schedulable: false,
    };
  }

  function parseScheduleCapacity(value, classType) {
    return normalizeCapacityValue(value, getClassMeta(classType).capacity);
  }

  function getPlanMeta(planType) {
    return MEMBERSHIP_PLANS[planType] || {
      label: planType,
      price: null,
      durationDays: 30,
      category: "musculacion",
      access: "Acceso configurado manualmente.",
    };
  }

  function isReservableClassType(classType) {
    return Boolean(getClassMeta(classType).reservable);
  }

  function isSchedulableClassType(classType) {
    return Boolean(getClassMeta(classType).schedulable);
  }

  function getPublicMembershipPlanEntries() {
    return Object.entries(MEMBERSHIP_PLANS).filter(([, plan]) => plan.isPublic !== false);
  }

  function sortClassEntries(left, right) {
    return left[1].label.localeCompare(right[1].label, "es");
  }

  function getClassEntriesBySchedule(filters = {}) {
    const keys = [...new Set(getSchedules(filters).map((schedule) => schedule.classType))];
    return keys
      .map((classType) => [classType, getClassMeta(classType)])
      .sort(sortClassEntries);
  }

  function getSchedulableClassEntries(options = {}) {
    loadState();

    if (options.scheduledOnly) {
      return getClassEntriesBySchedule({
        futureOnly: options.futureOnly,
        schedulableOnly: true,
      });
    }

    return Object.entries(CLASS_TYPES)
      .filter(([, meta]) => meta.schedulable)
      .sort(sortClassEntries);
  }

  function getReservableClassEntries(options = {}) {
    loadState();

    if (options.scheduledOnly) {
      return getClassEntriesBySchedule({
        futureOnly: options.futureOnly,
        reservableOnly: true,
      });
    }

    return Object.entries(CLASS_TYPES)
      .filter(([, meta]) => meta.reservable)
      .sort(sortClassEntries);
  }

  function getSuggestedScheduleCapacity(input) {
    loadState();
    const classType = CLASS_TYPES[input] ? input : getClassTypeByLabel(input);
    return getClassMeta(classType || input).capacity;
  }

  function belongsToSamePlanFamily(existingPlanType, nextPlanType) {
    const existingMeta = getPlanMeta(existingPlanType);
    const nextMeta = getPlanMeta(nextPlanType);

    if (existingMeta.category !== nextMeta.category) {
      return false;
    }

    if (nextMeta.category === "musculacion") {
      return true;
    }

    return existingMeta.classType === nextMeta.classType;
  }

  function getMembersByNationalId(state, nationalId) {
    return state.members.filter((member) => member.nationalId === nationalId);
  }

  function getCanonicalAccessCode(state, nationalId) {
    return getMembersByNationalId(state, nationalId)
      .filter((member) => String(member.accessCode || "").trim())
      .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")))[0]
      ?.accessCode || "";
  }

  function syncSharedAccessCode(state, nationalId, preferredCode = "") {
    const sharedCode = String(preferredCode || getCanonicalAccessCode(state, nationalId) || "").trim();

    if (!sharedCode) {
      return "";
    }

    state.members.forEach((member) => {
      if (member.nationalId === nationalId) {
        member.accessCode = sharedCode;
      }
    });

    return sharedCode;
  }

  function normalizeSharedAccessCodes(state) {
    const nationalIds = [...new Set(state.members.map((member) => member.nationalId).filter(Boolean))];

    nationalIds.forEach((nationalId) => {
      const sharedCode = getCanonicalAccessCode(state, nationalId) || generateAccessCode(state, [4]);
      syncSharedAccessCode(state, nationalId, sharedCode);
    });
  }

  function formatDateLabel(dateKey) {
    return parseDateKey(dateKey).toLocaleDateString("es-UY", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  }

  function formatDateFull(dateKey) {
    return parseDateKey(dateKey).toLocaleDateString("es-UY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatCurrency(value) {
    if (typeof value !== "number") {
      return "Consultar";
    }

    return value.toLocaleString("es-UY", {
      style: "currency",
      currency: "UYU",
      maximumFractionDigits: 0,
    });
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
      origin: "official",
      repeatWeekly: true,
      createdAt: new Date().toISOString(),
    };
  }

  function buildRecurringScheduleOccurrence(dateKey, recurrence) {
    const meta = getClassMeta(recurrence.classType);
    return {
      id: createScheduleId(dateKey, recurrence.time, recurrence.classType),
      date: dateKey,
      time: recurrence.time,
      classType: recurrence.classType,
      capacity: recurrence.capacity || meta.capacity,
      origin: "recurring",
      recurrenceId: recurrence.id,
      repeatWeekly: true,
      createdAt: recurrence.createdAt || new Date().toISOString(),
      updatedAt: recurrence.updatedAt || recurrence.createdAt || new Date().toISOString(),
    };
  }

  function readStoredState() {
    try {
      const rawValue = localStorage.getItem(STORAGE_KEY);
      if (rawValue) {
        return JSON.parse(rawValue);
      }

      const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY);
      return legacyValue ? JSON.parse(legacyValue) : null;
    } catch (error) {
      return null;
    }
  }

  function sanitizeCustomClassEntries(state) {
    const nextEntries = {};

    Object.entries(state.customClasses || {}).forEach(([key, meta]) => {
      if (!key || BASE_CLASS_TYPES[key]) {
        return;
      }

      const label = sanitizeDisciplineLabel(meta?.label || "");

      if (!label) {
        return;
      }

      nextEntries[key] = {
        label,
        accent: meta?.accent || getAccentFromSeed(label || key),
        capacity: normalizeCapacityValue(meta?.capacity, DEFAULT_DISCIPLINE_CAPACITY),
        reservable: meta?.reservable !== false,
        schedulable: meta?.schedulable !== false,
        createdAt: meta?.createdAt || new Date().toISOString(),
      };
    });

    state.customClasses = nextEntries;
    syncClassRegistry(state);
  }

  function sanitizeRecurringSchedules(state) {
    state.recurringSchedules = (state.recurringSchedules || [])
      .map((recurrence) => {
        const label = sanitizeDisciplineLabel(
          recurrence?.label
          || getClassMeta(recurrence?.classType).label
          || recurrence?.classType
        );
        const classType = recurrence?.classType && CLASS_TYPES[recurrence.classType]
          ? recurrence.classType
          : ensureSchedulableClassType(state, label);
        const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(recurrence?.startDate || ""))
          ? String(recurrence.startDate)
          : toDateKey(new Date());
        const weekday = Number.isInteger(Number(recurrence?.weekday))
          ? Number(recurrence.weekday)
          : parseDateKey(startDate).getDay();
        const time = String(recurrence?.time || "").trim();

        if (!time) {
          return null;
        }

        return {
          id: recurrence?.id || `rec-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          classType,
          weekday,
          time,
          startDate,
          capacity: parseScheduleCapacity(recurrence?.capacity, classType),
          createdAt: recurrence?.createdAt || new Date().toISOString(),
          updatedAt: recurrence?.updatedAt || recurrence?.createdAt || new Date().toISOString(),
        };
      })
      .filter(Boolean)
      .sort((left, right) => `${left.weekday}-${left.time}`.localeCompare(`${right.weekday}-${right.time}`));
  }

  function ensureFutureSchedules(state) {
    const today = startOfToday();
    const horizonLimit = addDays(today, HORIZON_DAYS);
    const blockedIds = new Set(
      (Array.isArray(state.deletedScheduleIds) ? state.deletedScheduleIds : [])
        .filter((scheduleId) => {
          const parts = String(scheduleId).split("-");
          const dateKey = parts.length >= 4 ? `${parts[1]}-${parts[2]}-${parts[3]}` : "";
          if (!dateKey) {
            return false;
          }

          const scheduleDate = parseDateKey(dateKey);
          return scheduleDate >= addDays(today, -7) && scheduleDate <= horizonLimit;
        })
    );
    const isGeneratedSchedule = (schedule) => schedule.origin === "official" || schedule.origin === "recurring";

    state.schedules = state.schedules.filter((schedule) => {
      const scheduleDate = parseDateKey(schedule.date);

      if (schedule.origin === "manual") {
        return scheduleDate >= addDays(today, -7);
      }

      if (isGeneratedSchedule(schedule)) {
        return scheduleDate >= addDays(today, -7) && scheduleDate <= horizonLimit;
      }

      return scheduleDate >= addDays(today, -7);
    });

    const existingIds = new Set(state.schedules.map((schedule) => schedule.id));

    for (let offset = 0; offset <= HORIZON_DAYS; offset += 1) {
      const date = addDays(today, offset);
      const dateKey = toDateKey(date);
      const templates = WEEKLY_TEMPLATES[date.getDay()] || [];

      templates.forEach((template) => {
        const schedule = buildTemplateSchedule(dateKey, template);

        if (blockedIds.has(schedule.id)) {
          return;
        }

        if (!existingIds.has(schedule.id)) {
          existingIds.add(schedule.id);
          state.schedules.push(schedule);
        }
      });
    }

    state.recurringSchedules.forEach((recurrence) => {
      for (let offset = 0; offset <= HORIZON_DAYS; offset += 1) {
        const date = addDays(today, offset);

        if (date < parseDateKey(recurrence.startDate) || date.getDay() !== recurrence.weekday) {
          continue;
        }

        const occurrence = buildRecurringScheduleOccurrence(toDateKey(date), recurrence);

        if (blockedIds.has(occurrence.id)) {
          continue;
        }

        if (!existingIds.has(occurrence.id)) {
          existingIds.add(occurrence.id);
          state.schedules.push(occurrence);
        }
      }
    });

    state.schedules = state.schedules
      .filter((schedule) => parseDateKey(schedule.date) >= addDays(today, -7))
      .sort(sortBySlot);
    state.deletedScheduleIds = [...blockedIds].sort();
  }

  function sanitizeScheduleEntries(state) {
    const priority = {
      manual: 3,
      recurring: 2,
      official: 1,
      template: 0,
    };
    const deduped = new Map();

    state.schedules
      .filter((schedule) => schedule && schedule.date && schedule.time && isSchedulableClassType(schedule.classType))
      .sort((left, right) => {
        const leftPriority = priority[left.origin] || 0;
        const rightPriority = priority[right.origin] || 0;

        if (leftPriority !== rightPriority) {
          return rightPriority - leftPriority;
        }

        return String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""));
      })
      .forEach((schedule) => {
        const capacity = parseScheduleCapacity(schedule.capacity, schedule.classType);
        const key = createScheduleId(schedule.date, schedule.time, schedule.classType);

        if (!deduped.has(key)) {
          deduped.set(key, {
            ...schedule,
            id: key,
            capacity,
            repeatWeekly: schedule.repeatWeekly ?? (schedule.origin === "official" || schedule.origin === "recurring"),
          });
        }
      });

    state.schedules = [...deduped.values()].sort(sortBySlot);
  }

  function sanitizeReservationEntries(state) {
    const scheduleMap = new Map(state.schedules.map((schedule) => [schedule.id, schedule]));

    state.reservations = state.reservations
      .filter((reservation) => reservation && reservation.scheduleId)
      .map((reservation) => {
        const schedule = scheduleMap.get(reservation.scheduleId);

        if (!schedule || !isReservableClassType(schedule.classType)) {
          return null;
        }

        return {
          ...reservation,
          scheduleId: schedule.id,
          classType: schedule.classType,
          date: schedule.date,
          time: schedule.time,
          status: reservation.status === "confirmed" ? "confirmed" : "pending",
          fullName: String(reservation.fullName || "").trim(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }

  function migrateLegacySchedules(state) {
    const legacyReservations = Array.isArray(state.reservations) ? state.reservations : [];
    state.schedules = [];
    state.deletedScheduleIds = [];
    ensureFutureSchedules(state);

    const validScheduleIds = new Set(state.schedules.map((schedule) => schedule.id));
    state.reservations = legacyReservations
      .map((reservation) => {
        const scheduleId = createScheduleId(reservation.date, reservation.time, reservation.classType);

        if (!validScheduleIds.has(scheduleId) || !isReservableClassType(reservation.classType)) {
          return null;
        }

        return {
          ...reservation,
          scheduleId,
          status: reservation.status || "pending",
          fullName: String(reservation.fullName || "").trim(),
        };
      })
      .filter(Boolean);
  }

  function normalizeState(state) {
    const safeState = {
      schedules: Array.isArray(state?.schedules) ? state.schedules : [],
      reservations: Array.isArray(state?.reservations)
        ? state.reservations
          .filter((reservation) => reservation && reservation.scheduleId)
          .map((reservation) => ({
            ...reservation,
            status: reservation.status || "pending",
            fullName: String(reservation.fullName || "").trim(),
          }))
        : [],
      requests: Array.isArray(state?.requests) ? state.requests : [],
      members: Array.isArray(state?.members) ? state.members : [],
      checkIns: Array.isArray(state?.checkIns) ? state.checkIns : [],
      deletedScheduleIds: Array.isArray(state?.deletedScheduleIds) ? state.deletedScheduleIds : [],
      recurringSchedules: Array.isArray(state?.recurringSchedules) ? state.recurringSchedules : [],
      customClasses: state?.customClasses && typeof state.customClasses === "object" && !Array.isArray(state.customClasses)
        ? state.customClasses
        : {},
      scheduleSchemaVersion: Number(state?.scheduleSchemaVersion || 0),
    };

    if (safeState.scheduleSchemaVersion < SCHEDULE_SCHEMA_VERSION) {
      migrateLegacySchedules(safeState);
      safeState.scheduleSchemaVersion = SCHEDULE_SCHEMA_VERSION;
    }

    sanitizeCustomClassEntries(safeState);
    sanitizeRecurringSchedules(safeState);
    sanitizeScheduleEntries(safeState);
    ensureFutureSchedules(safeState);
    sanitizeReservationEntries(safeState);
    sanitizeCustomClassEntries(safeState);
    normalizeSharedAccessCodes(safeState);
    safeState.reservations.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    safeState.requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    safeState.members.sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
    safeState.checkIns.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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

  function enrichSchedule(schedule, state) {
    const meta = getClassMeta(schedule.classType);
    const reservedCount = countReservationsForSchedule(state, schedule.id);
    const remaining = Math.max(schedule.capacity - reservedCount, 0);
    const status = remaining === 0 ? "occupied" : remaining <= Math.max(2, Math.ceil(schedule.capacity * 0.25)) ? "limited" : "available";
    const statusLabel = status === "occupied"
      ? "Sin cupos disponibles"
      : status === "limited"
        ? `${remaining} cupo${remaining === 1 ? "" : "s"} restantes`
        : `${remaining} cupo${remaining === 1 ? "" : "s"} disponibles`;

    return {
      ...schedule,
      classLabel: meta.label,
      accent: meta.accent,
      reservedCount,
      remaining,
      status,
      statusLabel,
      dateLabel: formatDateLabel(schedule.date),
      isAvailable: remaining > 0,
      isReservable: isReservableClassType(schedule.classType),
      recurrenceLabel: schedule.repeatWeekly ? "Semanal" : "Único",
      isRecurring: Boolean(schedule.repeatWeekly),
    };
  }

  function computeEndDate(startDate, durationDays) {
    return toDateKey(addDays(parseDateKey(startDate), durationDays - 1));
  }

  function computePlanEndDate(planType, startDate) {
    return computeEndDate(startDate, getPlanMeta(planType).durationDays);
  }

  function generateAccessCode(state, lengths = [4, 5, 6]) {
    const usedCodes = new Set(state.members.map((member) => member.accessCode));

    for (const length of lengths) {
      for (let attempts = 0; attempts < 250; attempts += 1) {
        const min = 10 ** (length - 1);
        const max = 10 ** length - 1;
        const code = String(Math.floor(Math.random() * (max - min + 1)) + min);

        if (!usedCodes.has(code)) {
          return code;
        }
      }
    }

    return String(Date.now()).slice(-lengths[lengths.length - 1]);
  }

  function enrichMember(member, referenceDate = new Date()) {
    const planMeta = getPlanMeta(member.planType);
    const today = startOfToday();
    const startDate = parseDateKey(member.startDate);
    const expiryEnd = endOfDay(member.endDate);
    const relatedClassMeta = planMeta.classType ? getClassMeta(planMeta.classType) : null;
    const isStarted = startDate <= today;
    const isActive = isStarted && expiryEnd >= today;
    const isScheduled = !isStarted;
    const daysRemaining = isActive ? Math.floor((endOfDay(member.endDate) - today) / MS_PER_DAY) + 1 : 0;
    const daysUntilStart = isScheduled ? Math.floor((startDate - today) / MS_PER_DAY) : 0;
    const expiresSoon = isActive && daysRemaining <= 7;
    const expiredDaysAgo = !isActive && !isScheduled ? Math.abs(Math.floor((today - endOfDay(member.endDate)) / MS_PER_DAY)) : 0;

    let status = "expired";
    let statusLabel = "Vencido";
    let statusTone = "danger";
    let accessMessage = `Plan vencido el ${formatDateFull(member.endDate)}.`;

    if (isScheduled) {
      status = "scheduled";
      statusLabel = "Programado";
      statusTone = "accent";
      accessMessage = `El plan inicia en ${daysUntilStart} día${daysUntilStart === 1 ? "" : "s"}.`;
    } else if (isActive) {
      status = "active";
      statusLabel = "Activo";
      statusTone = daysRemaining <= 7 ? "limited" : "available";
      accessMessage = `Te quedan ${daysRemaining} día${daysRemaining === 1 ? "" : "s"}.`;
    }

    return {
      ...member,
      planLabel: planMeta.label,
      planPrice: planMeta.price,
      planPriceLabel: formatCurrency(planMeta.price),
      durationDays: planMeta.durationDays,
      planCategory: planMeta.category,
      planAccess: planMeta.access,
      relatedClassType: planMeta.classType || null,
      relatedClassLabel: relatedClassMeta?.label || "Acceso libre",
      status,
      statusLabel,
      statusTone,
      isActive,
      isScheduled,
      daysRemaining,
      daysUntilStart,
      expiresSoon,
      expiredDaysAgo,
      startDateLabel: formatDateFull(member.startDate),
      endDateLabel: formatDateFull(member.endDate),
      accessMessage,
    };
  }

  function enrichRequest(request) {
    const planMeta = getPlanMeta(request.planType);
    const status = request.status || "pending";
    const statusMap = {
      pending: { label: "Pendiente", tone: "accent" },
      approved: { label: "Aprobada", tone: "available" },
      rejected: { label: "Rechazada", tone: "danger" },
    };
    const statusMeta = statusMap[status] || statusMap.pending;
    const notes = String(request.notes || "").trim();

    return {
      ...request,
      notes,
      planLabel: planMeta.label,
      planCategory: planMeta.category,
      status,
      statusLabel: statusMeta.label,
      statusTone: statusMeta.tone,
      createdDateLabel: new Date(request.createdAt).toLocaleDateString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      createdTimeLabel: new Date(request.createdAt).toLocaleTimeString("es-UY", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }

  function sortProfilePlans(left, right) {
    const toneRank = (plan) => (plan.isActive ? 0 : plan.isScheduled ? 1 : 2);
    const leftRank = toneRank(left);
    const rightRank = toneRank(right);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    if (left.isActive && right.isActive) {
      return left.daysRemaining - right.daysRemaining;
    }

    if (left.isScheduled && right.isScheduled) {
      return left.daysUntilStart - right.daysUntilStart;
    }

    return right.endDate.localeCompare(left.endDate);
  }

  function buildProfileFromMembers(members, matchedMemberId = null) {
    const enrichedPlans = members.map((member) => enrichMember(member)).sort(sortProfilePlans);
    const activePlans = enrichedPlans.filter((plan) => plan.isActive);
    const scheduledPlans = enrichedPlans.filter((plan) => plan.isScheduled);
    const expiredPlans = enrichedPlans.filter((plan) => !plan.isActive && !plan.isScheduled);
    const matchedPlan = enrichedPlans.find((plan) => plan.id === matchedMemberId)
      || activePlans[0]
      || scheduledPlans[0]
      || enrichedPlans[0]
      || null;

    let status = "expired";
    let statusLabel = "Vencido";
    let statusTone = "danger";
    let accessMessage = "Todos los planes de esta cédula están vencidos.";

    if (activePlans.length) {
      status = "active";
      statusLabel = "Activo";
      statusTone = activePlans.some((plan) => plan.daysRemaining <= 7) ? "limited" : "available";
      accessMessage = activePlans.length === 1
        ? activePlans[0].accessMessage
        : `${activePlans.length} planes activos en esta cédula.`;
    } else if (scheduledPlans.length) {
      status = "scheduled";
      statusLabel = "Programado";
      statusTone = "accent";
      accessMessage = scheduledPlans.length === 1
        ? scheduledPlans[0].accessMessage
        : `${scheduledPlans.length} planes programados para esta cédula.`;
    }

    return {
      id: `profile-${matchedPlan?.nationalId || members[0]?.nationalId || "unknown"}`,
      fullName: matchedPlan?.fullName || members[0]?.fullName || "Socio no disponible",
      nationalId: matchedPlan?.nationalId || members[0]?.nationalId || "",
      phone: matchedPlan?.phone || members[0]?.phone || "",
      planLabel: enrichedPlans.length === 1 ? (matchedPlan?.planLabel || "Plan") : `${enrichedPlans.length} planes asociados`,
      planSummary: enrichedPlans.map((plan) => plan.planLabel).join(" + "),
      accessCode: matchedPlan?.accessCode || "",
      endDate: matchedPlan?.endDate || "",
      endDateLabel: matchedPlan?.endDateLabel || "",
      planCategory: matchedPlan?.planCategory || "multiple",
      relatedClassLabel: matchedPlan?.relatedClassLabel || "Múltiples planes",
      status,
      statusLabel,
      statusTone,
      accessMessage,
      isActive: activePlans.length > 0,
      isScheduled: activePlans.length === 0 && scheduledPlans.length > 0,
      daysRemaining: matchedPlan?.daysRemaining || 0,
      daysUntilStart: matchedPlan?.daysUntilStart || 0,
      activePlanCount: activePlans.length,
      scheduledPlanCount: scheduledPlans.length,
      expiredPlanCount: expiredPlans.length,
      matchedPlanId: matchedPlan?.id || null,
      plans: enrichedPlans,
    };
  }

  function resolveMembersByIdentifier(state, normalizedQuery) {
    const matchedByCode = state.members.find((member) => member.accessCode === normalizedQuery);

    if (matchedByCode) {
      return {
        members: state.members.filter((member) => member.nationalId === matchedByCode.nationalId),
        matchedMemberId: matchedByCode.id,
      };
    }

    const matchedByNationalId = state.members.filter((member) => member.nationalId === normalizedQuery);

    if (!matchedByNationalId.length) {
      return null;
    }

    return {
      members: matchedByNationalId,
      matchedMemberId: null,
    };
  }

  function syncSharedMemberIdentity(state, nationalId, fullName, phone, accessCode = "") {
    const now = new Date().toISOString();
    const sharedCode = accessCode || getCanonicalAccessCode(state, nationalId);

    state.members.forEach((member) => {
      if (member.nationalId === nationalId) {
        member.fullName = fullName;
        member.phone = phone;
        if (sharedCode) {
          member.accessCode = sharedCode;
        }
        member.updatedAt = now;
      }
    });
  }

  function findActivePlanConflictInState(state, nationalId, planType, excludedMemberId = null) {
    const referenceDate = new Date();

    return state.members
      .filter((member) => member.nationalId === nationalId && member.planType === planType && member.id !== excludedMemberId)
      .map((member) => enrichMember(member, referenceDate))
      .find((member) => member.isActive) || null;
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

        if (filters.schedulableOnly && !isSchedulableClassType(schedule.classType)) {
          return false;
        }

        if (filters.reservableOnly && !schedule.isReservable) {
          return false;
        }

        if (filters.availableOnly && !schedule.isAvailable) {
          return false;
        }

        return true;
      })
      .sort(sortBySlot);
  }

  function getUniqueUpcomingDates(limit = 12, filters = {}) {
    const dates = [];
    const seen = new Set();

    getSchedules({ futureOnly: true, ...filters }).forEach((schedule) => {
      if (!seen.has(schedule.date)) {
        seen.add(schedule.date);
        dates.push(schedule.date);
      }
    });

    return dates.slice(0, limit);
  }

  function getDisplayWeekStart(referenceDate = new Date()) {
    const weekStart = startOfWeek(referenceDate);
    const weekday = referenceDate.getDay();

    return weekday === 0 || weekday === 6 ? addDays(weekStart, 7) : weekStart;
  }

  function getScheduleSlotToneClass(schedules) {
    if (!schedules.length) {
      return "is-empty";
    }

    if (schedules.length > 1) {
      return "is-highlight";
    }

    const accent = schedules[0].accent;

    if (accent === "accent") {
      return "is-accent";
    }

    if (accent === "danger") {
      return "is-danger";
    }

    if (accent === "highlight") {
      return "is-highlight";
    }

    return "is-active";
  }

  function getScheduleBoardData() {
    const weekStart = getDisplayWeekStart();
    const columns = HOME_BOARD_WEEKDAYS.map((weekday) => {
      const date = addDays(weekStart, weekday - 1);
      return {
        weekday,
        label: HOME_BOARD_LABELS[weekday],
        date: toDateKey(date),
      };
    });
    const dateIndex = new Set(columns.map((column) => column.date));
    const schedules = getSchedules({ futureOnly: false, schedulableOnly: true }).filter((schedule) => dateIndex.has(schedule.date));
    const uniqueTimes = [...new Set([...HOME_BASE_TIMES, ...schedules.map((schedule) => schedule.time)])].sort();

    return {
      columns,
      rows: uniqueTimes.map((time) => ({
        time,
        label: HOME_TIME_LABELS[time] || `${time} hs`,
        cells: columns.map((column) => {
          const slotSchedules = schedules.filter((schedule) => schedule.date === column.date && schedule.time === time);

          if (!slotSchedules.length) {
            return {
              date: column.date,
              time,
              label: "Libre",
              className: "schedule-slot is-empty",
            };
          }

          return {
            date: column.date,
            time,
            label: slotSchedules.map((schedule) => schedule.classLabel).join(" / "),
            className: `schedule-slot ${getScheduleSlotToneClass(slotSchedules)}`,
          };
        }),
      })),
    };
  }

  function getReservations(filters = {}) {
    const state = loadState();
    const now = new Date();
    const statusMap = {
      pending: { label: "Pendiente", tone: "limited" },
      confirmed: { label: "Confirmada", tone: "available" },
    };

    return state.reservations
      .map((reservation) => {
        const schedule = state.schedules.find((item) => item.id === reservation.scheduleId);
        const meta = getClassMeta(reservation.classType);
        const status = reservation.status || "pending";
        const statusMeta = statusMap[status] || statusMap.pending;

        return {
          ...reservation,
          classLabel: meta.label,
          accent: meta.accent,
          status,
          statusLabel: statusMeta.label,
          statusTone: statusMeta.tone,
          schedule: schedule ? enrichSchedule(schedule, state) : null,
        };
      })
      .filter((reservation) => {
        if (filters.status && reservation.status !== filters.status) {
          return false;
        }

        if (filters.classType && reservation.classType !== filters.classType) {
          return false;
        }

        if (filters.reservableOnly) {
          const isReservable = reservation.schedule
            ? reservation.schedule.isReservable
            : isReservableClassType(reservation.classType);

          if (!isReservable) {
            return false;
          }
        }

        if (filters.futureOnly) {
          const scheduleDate = reservation.schedule
            ? scheduleToDateTime(reservation.schedule)
            : new Date(`${reservation.date}T${reservation.time}`);

          if (scheduleDate < now) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }

  function getRequests(filters = {}) {
    const state = loadState();

    return state.requests
      .map((request) => {
        const activeConflict = findActivePlanConflictInState(state, request.nationalId, request.planType);

        return {
          ...enrichRequest(request),
          hasActiveConflict: Boolean(activeConflict),
          activeConflictPlanId: activeConflict?.id || null,
          activeConflictCode: activeConflict?.accessCode || "",
          activeConflictPlanLabel: activeConflict?.planLabel || "",
        };
      })
      .filter((request) => {
        if (filters.status && request.status !== filters.status) {
          return false;
        }

        if (filters.planType && request.planType !== filters.planType) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  function createMembershipRequest(payload) {
    const state = loadState();
    const fullName = String(payload.fullName || "").trim();
    const nationalId = validateNationalId(payload.nationalId);
    const phone = validatePhone(payload.phone);
    const planType = String(payload.planType || "").trim();
    const notes = String(payload.notes || "").trim();

    if (!fullName || !nationalId || !phone || !planType) {
      throw new Error("Completá nombre, cédula, teléfono y plan.");
    }

    if (!MEMBERSHIP_PLANS[planType]) {
      throw new Error("Elegí un plan válido para enviar la solicitud.");
    }

    const request = {
      id: `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      fullName,
      nationalId,
      phone,
      planType,
      notes,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    state.requests.unshift(request);
    persistState(state);
    return enrichRequest(request);
  }

  function createReservation(payload) {
    const state = loadState();
    const identifier = validateCheckinQuery(payload.identifier);
    const fullName = String(payload.fullName || "").trim();
    const classType = String(payload.classType || "").trim();
    const date = String(payload.date || "").trim();
    const time = String(payload.time || "").trim();

    if (!fullName || !identifier || !classType || !date || !time) {
      throw new Error("Completá cédula o código, nombre, disciplina, fecha y horario.");
    }

    if (!isReservableClassType(classType)) {
      throw new Error("Elegí una disciplina válida para reservar.");
    }

    const resolved = resolveMembersByIdentifier(state, identifier);

    if (!resolved) {
      throw new Error("Necesitás una membresía activa para reservar tu lugar");
    }

    const profile = buildProfileFromMembers(resolved.members, resolved.matchedMemberId);

    if (!profile.isActive) {
      throw new Error("Necesitás una membresía activa para reservar tu lugar");
    }

    const schedule = state.schedules.find(
      (item) => item.date === date && item.time === time && item.classType === classType
    );

    if (!schedule) {
      throw new Error("Ese horario no está disponible para la disciplina elegida.");
    }

    const enrichedSchedule = enrichSchedule(schedule, state);

    if (!enrichedSchedule.isReservable) {
      throw new Error("Ese horario no está habilitado para reservas online.");
    }

    if (!enrichedSchedule.isAvailable) {
      throw new Error("Sin cupos disponibles");
    }

    const duplicate = state.reservations.find(
      (reservation) => reservation.scheduleId === schedule.id && reservation.nationalId === profile.nationalId
    );

    if (duplicate) {
      throw new Error("Ya tenés una reserva registrada para ese horario.");
    }

    const reservation = {
      id: `res-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      scheduleId: schedule.id,
      fullName,
      nationalId: profile.nationalId,
      accessCode: profile.accessCode,
      classType,
      date,
      time,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    state.reservations.push(reservation);
    persistState(state);
    return getReservations().find((item) => item.id === reservation.id) || reservation;
  }

  function cancelReservation(reservationId) {
    const state = loadState();
    const reservation = state.reservations.find((item) => item.id === reservationId);

    if (!reservation) {
      throw new Error("No encontramos esa reserva para cancelar.");
    }

    state.reservations = state.reservations.filter((item) => item.id !== reservationId);
    persistState(state);
    return reservation;
  }

  function confirmReservation(reservationId) {
    const state = loadState();
    const reservation = state.reservations.find((item) => item.id === reservationId);

    if (!reservation) {
      throw new Error("No encontramos esa reserva para confirmar.");
    }

    reservation.status = "confirmed";
    reservation.updatedAt = new Date().toISOString();
    persistState(state);
    return getReservations().find((item) => item.id === reservationId) || reservation;
  }

  function deleteMember(memberId) {
    const state = loadState();
    const member = state.members.find((item) => item.id === memberId);

    if (!member) {
      throw new Error("No encontramos ese socio para eliminar.");
    }

    state.members = state.members.filter((item) => item.id !== memberId);
    state.checkIns = state.checkIns
      .map((checkIn) => {
        if (Array.isArray(checkIn.memberIds)) {
          const memberIds = checkIn.memberIds.filter((id) => id !== memberId);

          if (!memberIds.length) {
            return null;
          }

          return {
            ...checkIn,
            memberIds,
            matchedMemberId: checkIn.matchedMemberId === memberId ? memberIds[0] || null : checkIn.matchedMemberId,
          };
        }

        if (checkIn.memberId === memberId) {
          return null;
        }

        return checkIn;
      })
      .filter(Boolean);
    persistState(state);

    return enrichMember(member);
  }

  function addSchedule(payload) {
    const state = loadState();
    const date = String(payload.date || "").trim();
    const time = String(payload.time || "").trim();
    const discipline = sanitizeDisciplineLabel(payload.discipline || payload.classType || "");
    const repeatWeekly = Boolean(payload.repeatWeekly);
    const classType = ensureSchedulableClassType(state, discipline);
    const capacity = Number(payload.capacity);

    if (!date || !time || !discipline || Number.isNaN(capacity)) {
      throw new Error("Completá fecha, hora, disciplina y capacidad.");
    }

    if (!isSchedulableClassType(classType)) {
      throw new Error("Solo podés crear horarios para disciplinas habilitadas en la agenda.");
    }

    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Ingresá un cupo válido.");
    }

    if (!repeatWeekly) {
      const duplicate = state.schedules.find(
        (schedule) => schedule.date === date && schedule.time === time && schedule.classType === classType
      );
      const recurringConflict = state.recurringSchedules.some((recurrence) => {
        const scheduleDate = parseDateKey(date);
        return recurrence.classType === classType
          && recurrence.time === time
          && scheduleDate >= parseDateKey(recurrence.startDate)
          && scheduleDate.getDay() === recurrence.weekday;
      });

      if (duplicate || recurringConflict) {
        throw new Error("Ese horario ya existe en la agenda.");
      }

      state.schedules.push({
        id: createScheduleId(date, time, classType),
        date,
        time,
        classType,
        capacity,
        origin: "manual",
        repeatWeekly: false,
        createdAt: new Date().toISOString(),
      });

      persistState(state);
      return;
    }

    const weekday = parseDateKey(date).getDay();
    const recurrenceDuplicate = state.recurringSchedules.some((recurrence) => recurrence.classType === classType && recurrence.time === time && recurrence.weekday === weekday);
    const occurrenceDates = [];

    for (let offset = 0; offset <= HORIZON_DAYS; offset += 1) {
      const nextDate = addDays(startOfToday(), offset);

      if (nextDate < parseDateKey(date) || nextDate.getDay() !== weekday) {
        continue;
      }

      occurrenceDates.push(toDateKey(nextDate));
    }

    const hasConflict = recurrenceDuplicate || state.schedules.some((schedule) => {
      const scheduleDate = parseDateKey(schedule.date);
      return schedule.classType === classType
        && schedule.time === time
        && scheduleDate >= parseDateKey(date)
        && scheduleDate.getDay() === weekday;
    }) || occurrenceDates.some((occurrenceDate) => state.schedules.some(
      (schedule) => schedule.date === occurrenceDate && schedule.time === time && schedule.classType === classType
    ));

    if (hasConflict) {
      throw new Error("Ese horario ya existe en la agenda.");
    }

    state.recurringSchedules.push({
      id: `rec-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      classType,
      weekday,
      time,
      startDate: date,
      capacity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    persistState(state);
  }

  function updateScheduleCapacity(scheduleId, capacity) {
    const state = loadState();
    const schedule = state.schedules.find((item) => item.id === scheduleId);
    const nextCapacity = Number(capacity);

    if (!schedule) {
      throw new Error("No encontramos ese horario para editar.");
    }

    if (!Number.isFinite(nextCapacity) || !Number.isInteger(nextCapacity) || nextCapacity < 1) {
      throw new Error("Ingresá un cupo válido.");
    }

    const reservedCount = countReservationsForSchedule(state, scheduleId);

    if (nextCapacity < reservedCount) {
      throw new Error(`La capacidad no puede ser menor a ${reservedCount}, que ya están reservados.`);
    }

    schedule.capacity = nextCapacity;
    schedule.updatedAt = new Date().toISOString();
    persistState(state);
    return enrichSchedule(schedule, state);
  }

  function deleteSchedule(scheduleId) {
    const state = loadState();
    const schedule = state.schedules.find((item) => item.id === scheduleId);

    if (!schedule) {
      throw new Error("No encontramos ese horario para eliminar.");
    }

    const removedReservations = state.reservations.filter((reservation) => reservation.scheduleId === scheduleId);

    state.schedules = state.schedules.filter((item) => item.id !== scheduleId);
    state.reservations = state.reservations.filter((reservation) => reservation.scheduleId !== scheduleId);

    if (schedule.origin === "official" || schedule.origin === "recurring") {
      const blockedIds = new Set(Array.isArray(state.deletedScheduleIds) ? state.deletedScheduleIds : []);
      blockedIds.add(scheduleId);
      state.deletedScheduleIds = [...blockedIds].sort();
    }

    persistState(state);

    return {
      ...enrichSchedule(schedule, {
        ...state,
        schedules: [...state.schedules, schedule],
        reservations: removedReservations,
      }),
      removedReservationsCount: removedReservations.length,
    };
  }

  function getMembers(filters = {}) {
    const state = loadState();

    return state.members
      .map((member) => enrichMember(member))
      .filter((member) => {
        if (filters.activeOnly && !member.isActive) {
          return false;
        }

        if (filters.includeScheduled === false && member.isScheduled) {
          return false;
        }

        if (filters.planType && member.planType !== filters.planType) {
          return false;
        }

        if (filters.planCategory && member.planCategory !== filters.planCategory) {
          return false;
        }

        if (filters.classType && member.relatedClassType !== filters.classType) {
          return false;
        }

        if (filters.expiresWithin && (!member.isActive || member.daysRemaining > filters.expiresWithin)) {
          return false;
        }

        if (filters.renewalCandidates && !(member.expiresSoon || (!member.isActive && !member.isScheduled && member.expiredDaysAgo <= 14))) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
  }

  function getProfiles(filters = {}) {
    const groupedProfiles = new Map();

    getMembers(filters).forEach((member) => {
      if (!groupedProfiles.has(member.nationalId)) {
        groupedProfiles.set(member.nationalId, []);
      }

      groupedProfiles.get(member.nationalId).push(member);
    });

    return [...groupedProfiles.values()]
      .map((members) => buildProfileFromMembers(members))
      .sort((left, right) => left.fullName.localeCompare(right.fullName, "es"));
  }

  function createMemberRecord(state, payload) {
    const fullName = String(payload.fullName || "").trim();
    const nationalId = validateNationalId(payload.nationalId);
    const phone = validatePhone(payload.phone);
    const planType = String(payload.planType || "").trim();
    const startDate = String(payload.startDate || toDateKey(new Date())).trim();

    if (!fullName || !nationalId || !phone || !planType || !startDate) {
      throw new Error("Completá nombre, cédula, teléfono, plan y fecha de inicio.");
    }

    if (!MEMBERSHIP_PLANS[planType]) {
      throw new Error("Elegí un plan válido para dar de alta.");
    }

    if (!payload.skipActivePlanConflictCheck && findActivePlanConflictInState(state, nationalId, planType)) {
      throw new Error(DUPLICATE_ACTIVE_PLAN_MESSAGE);
    }

    const sharedAccessCode = String(
      payload.accessCode || getCanonicalAccessCode(state, nationalId) || generateAccessCode(state, payload.codeLengths || [4, 5, 6])
    );

    const member = {
      id: `mem-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      fullName,
      nationalId,
      phone,
      planType,
      startDate,
      endDate: computePlanEndDate(planType, startDate),
      accessCode: sharedAccessCode,
      renewalCount: Number(payload.renewalCount || 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    state.members.push(member);
    syncSharedMemberIdentity(state, nationalId, fullName, phone, sharedAccessCode);
    return member;
  }

  function createMember(payload) {
    const state = loadState();
    const member = createMemberRecord(state, payload);
    persistState(state);
    return enrichMember(member);
  }

  function approveMembershipRequest(requestId, payload = {}) {
    const state = loadState();
    const request = state.requests.find((item) => item.id === requestId);

    if (!request || request.status !== "pending") {
      throw new Error("No encontramos esa solicitud pendiente.");
    }

    if (findActivePlanConflictInState(state, request.nationalId, request.planType)) {
      throw new Error(DUPLICATE_ACTIVE_PLAN_MESSAGE);
    }

    const member = createMemberRecord(state, {
      fullName: request.fullName,
      nationalId: request.nationalId,
      phone: request.phone,
      planType: request.planType,
      startDate: payload.startDate || toDateKey(new Date()),
      codeLengths: [4],
    });

    request.status = "approved";
    request.updatedAt = new Date().toISOString();
    request.processedAt = request.updatedAt;
    request.approvedMemberId = member.id;

    persistState(state);
    return {
      request: enrichRequest(request),
      member: enrichMember(member),
    };
  }

  function rejectMembershipRequest(requestId) {
    const state = loadState();
    const request = state.requests.find((item) => item.id === requestId);

    if (!request || request.status !== "pending") {
      throw new Error("No encontramos esa solicitud pendiente.");
    }

    request.status = "rejected";
    request.updatedAt = new Date().toISOString();
    request.processedAt = request.updatedAt;
    persistState(state);
    return enrichRequest(request);
  }

  function renewMembership(memberId, payload = {}) {
    const state = loadState();
    const member = state.members.find((item) => item.id === memberId);

    if (!member) {
      throw new Error("No encontramos ese socio para renovar.");
    }

    const current = enrichMember(member);
    const planType = String(payload.planType || member.planType).trim();
    const explicitStartDate = String(payload.startDate || "").trim();
    const renewalAnchor = current.isActive ? addDays(parseDateKey(member.endDate), 1) : new Date();
    const extensionStartDate = explicitStartDate || toDateKey(renewalAnchor);

    if (!MEMBERSHIP_PLANS[planType]) {
      throw new Error("Elegí un plan válido para renovar.");
    }

    const renewedMember = createMemberRecord(state, {
      fullName: member.fullName,
      nationalId: member.nationalId,
      phone: member.phone,
      planType,
      startDate: extensionStartDate,
      renewalCount: Number(member.renewalCount || 0) + 1,
      skipActivePlanConflictCheck: true,
    });

    renewedMember.lastRenewedAt = new Date().toISOString();
    renewedMember.renewedFromId = member.id;

    persistState(state);
    return enrichMember(renewedMember);
  }

  function findMemberByIdentifier(query) {
    const state = loadState();
    const normalizedQuery = stripDigits(query);

    if (!normalizedQuery) {
      return null;
    }

    const resolved = resolveMembersByIdentifier(state, normalizedQuery);
    return resolved ? buildProfileFromMembers(resolved.members, resolved.matchedMemberId) : null;
  }

  function getCheckIns(limit) {
    const state = loadState();
    const records = state.checkIns
      .map((checkIn) => {
        const memberIds = Array.isArray(checkIn.memberIds)
          ? checkIn.memberIds
          : checkIn.memberId
            ? [checkIn.memberId]
            : [];
        const directMembers = memberIds.length
          ? state.members.filter((item) => memberIds.includes(item.id))
          : checkIn.nationalId
            ? state.members.filter((item) => item.nationalId === checkIn.nationalId)
            : [];
        const members = directMembers.length
          ? state.members.filter((item) => item.nationalId === directMembers[0].nationalId)
          : [];
        const enrichedMember = members.length ? buildProfileFromMembers(members, checkIn.matchedMemberId || checkIn.memberId || null) : null;

        return {
          ...checkIn,
          member: enrichedMember,
          dateLabel: new Date(checkIn.createdAt).toLocaleDateString("es-UY", {
            day: "2-digit",
            month: "2-digit",
          }),
          timeLabel: new Date(checkIn.createdAt).toLocaleTimeString("es-UY", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return typeof limit === "number" ? records.slice(0, limit) : records;
  }

  function checkInMember(query) {
    const state = loadState();
    const normalizedQuery = validateCheckinQuery(query);
    const resolved = resolveMembersByIdentifier(state, normalizedQuery);

    if (!resolved) {
      throw new Error("No encontramos un socio con ese código o cédula.");
    }

    const profile = buildProfileFromMembers(resolved.members, resolved.matchedMemberId);
    const result = profile.isActive ? "active" : profile.isScheduled ? "scheduled" : "expired";

    state.checkIns.unshift({
      id: `chk-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      memberIds: resolved.members.map((member) => member.id),
      matchedMemberId: resolved.matchedMemberId,
      nationalId: profile.nationalId,
      query: normalizedQuery,
      result,
      createdAt: new Date().toISOString(),
    });

    state.checkIns = state.checkIns.slice(0, 120);
    persistState(state);

    return {
      ...profile,
      checkInResult: result,
    };
  }

  function getStats() {
    const members = getMembers({ includeScheduled: true });
    const requests = getRequests({ status: "pending" });
    const reservations = getReservations({ futureOnly: true });
    const futureSchedules = getSchedules({ futureOnly: true, reservableOnly: true });
    const today = toDateKey(new Date());
    const weekStart = startOfWeek(new Date());
    const weekEnd = addDays(weekStart, 7);
    const checkIns = getCheckIns();
    const byClass = reservations.reduce((accumulator, reservation) => {
      accumulator[reservation.classType] = (accumulator[reservation.classType] || 0) + 1;
      return accumulator;
    }, {});
    const topClassKey = Object.keys(byClass).sort((left, right) => byClass[right] - byClass[left])[0];
    const activeMembers = new Set(members.filter((member) => member.isActive).map((member) => member.nationalId)).size;
    const activePlans = members.filter((member) => member.isActive).length;
    const expiringThisWeek = members.filter((member) => member.isActive && member.daysRemaining <= 7).length;
    const checkInsToday = checkIns.filter((checkIn) => toDateKey(new Date(checkIn.createdAt)) === today).length;
    const reservationsToday = reservations.filter((reservation) => reservation.date === today).length;
    const reservationsWeek = reservations.filter((reservation) => {
      const scheduleDate = parseDateKey(reservation.date);
      return scheduleDate >= weekStart && scheduleDate < weekEnd;
    }).length;
    const freeSpots = futureSchedules.reduce((total, schedule) => total + schedule.remaining, 0);
    const renewalsThisWeek = members.filter((member) => {
      if (!member.lastRenewedAt) {
        return false;
      }

      const renewedAt = new Date(member.lastRenewedAt);
      return renewedAt >= weekStart && renewedAt < weekEnd;
    }).length;

    return {
      reservationsToday,
      reservationsWeek,
      freeSpots,
      classPlansToday: reservationsToday,
      classPlansWeek: reservationsWeek,
      activeClassPlans: reservations.length,
      topClass: topClassKey ? getClassMeta(topClassKey).label : "Sin datos",
      topClassCount: topClassKey ? byClass[topClassKey] : 0,
      pendingRequests: requests.length,
      activeMembers,
      activePlans,
      expiringThisWeek,
      checkInsToday,
      renewalsThisWeek,
    };
  }

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY) {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  });

  window.EstudiantesTboBooking = {
    changeEvent: CHANGE_EVENT,
    adminPin: ADMIN_PIN,
    classTypes: CLASS_TYPES,
    membershipPlans: MEMBERSHIP_PLANS,
    getSchedules,
    getScheduleBoardData,
    getReservations,
    getRequests,
    getUniqueUpcomingDates,
    getStats,
    getMembers,
    getProfiles,
    getCheckIns,
    createMembershipRequest,
    createReservation,
    approveMembershipRequest,
    rejectMembershipRequest,
    cancelReservation,
    confirmReservation,
    deleteMember,
    addSchedule,
    deleteSchedule,
    updateScheduleCapacity,
    createMember,
    renewMembership,
    checkInMember,
    findMemberByIdentifier,
    getPublicMembershipPlanEntries,
    getReservableClassEntries,
    getSchedulableClassEntries,
    getSuggestedScheduleCapacity,
    sanitizeDisciplineLabel,
    sanitizePhoneInput,
    sanitizeNationalIdInput,
    sanitizeCheckinInput,
    validatePhone,
    validateNationalId,
    validateCheckinQuery,
    computePlanEndDate,
    formatDateLabel,
    formatDateFull,
    formatCurrency,
  };
})();
