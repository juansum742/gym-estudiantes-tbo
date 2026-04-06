(function () {
  const STORAGE_KEY = "estudiantes_tbo_premium_v3";
  const LEGACY_STORAGE_KEY = "estudiantes_tbo_premium_v2";
  const CHANGE_EVENT = "estudiantes-tbo-booking:changed";
  const HORIZON_DAYS = 21;
  const ADMIN_PIN = "TBO2026";
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const CLASS_TYPES = {
    funcional: { label: "Funcional", accent: "available", capacity: 12 },
    indoor: { label: "Indoor Bike", accent: "accent", capacity: 10 },
    kick: { label: "Kick Boxing", accent: "danger", capacity: 14 },
    fullgap: { label: "FullGap", accent: "highlight", capacity: 14 },
    musculacion: { label: "Musculación Guiada", accent: "neutral", capacity: 8 },
  };

  const MEMBERSHIP_PLANS = {
    musculacion_mensual: {
      label: "Mensual musculación",
      price: 1600,
      durationDays: 30,
      category: "musculacion",
      access: "Acceso libre durante 30 días a cualquier horario.",
    },
    musculacion_semanal: {
      label: "Semanal musculación",
      price: null,
      durationDays: 7,
      category: "musculacion",
      access: "Acceso libre por 7 días consecutivos.",
    },
    pase_diario: {
      label: "Pase diario",
      price: null,
      durationDays: 1,
      category: "musculacion",
      access: "Acceso por 1 día al gimnasio.",
    },
    clase_funcional: {
      label: "Funcional mensual",
      price: null,
      durationDays: 30,
      category: "clases",
      classType: "funcional",
      access: "Suscripción mensual de Funcional por 30 días, sin reserva diaria por horario.",
    },
    clase_fullgap: {
      label: "Full Gap mensual",
      price: null,
      durationDays: 30,
      category: "clases",
      classType: "fullgap",
      access: "Suscripción mensual de Full Gap por 30 días, sin reserva diaria por horario.",
    },
    clase_indoor: {
      label: "Indoor Bike mensual",
      price: null,
      durationDays: 30,
      category: "clases",
      classType: "indoor",
      access: "Suscripción mensual de Indoor Bike por 30 días, sin reserva diaria por horario.",
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
      label: classType,
      accent: "neutral",
      capacity: 10,
    };
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
      origin: "template",
      createdAt: new Date().toISOString(),
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
      members: Array.isArray(state?.members) ? state.members : [],
      checkIns: Array.isArray(state?.checkIns) ? state.checkIns : [],
    };

    ensureFutureSchedules(safeState);
    safeState.reservations.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
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

  function computeEndDate(startDate, durationDays) {
    return toDateKey(addDays(parseDateKey(startDate), durationDays - 1));
  }

  function computePlanEndDate(planType, startDate) {
    return computeEndDate(startDate, getPlanMeta(planType).durationDays);
  }

  function generateAccessCode(state) {
    const usedCodes = new Set(state.members.map((member) => member.accessCode));
    const lengths = [4, 5, 6];

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

    return String(Date.now()).slice(-6);
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
    throw new Error("Las clases ahora se activan como plan mensual. Elegí un plan de clases y registrate con cédula.");
  }

  function cancelReservation(reservationId) {
    const state = loadState();
    state.reservations = state.reservations.filter((reservation) => reservation.id !== reservationId);
    persistState(state);
  }

  function deleteMember(memberId) {
    const state = loadState();
    const member = state.members.find((item) => item.id === memberId);

    if (!member) {
      throw new Error("No encontramos ese socio para eliminar.");
    }

    state.members = state.members.filter((item) => item.id !== memberId);
    state.checkIns = state.checkIns.filter((checkIn) => checkIn.memberId !== memberId);
    persistState(state);

    return enrichMember(member);
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

  function createMember(payload) {
    const state = loadState();
    const fullName = String(payload.fullName || "").trim();
    const nationalId = validateNationalId(payload.nationalId);
    const phone = validatePhone(payload.phone);
    const planType = String(payload.planType || "").trim();
    const startDate = String(payload.startDate || "").trim();
    const existingMember = state.members.find((member) => member.nationalId === nationalId);

    if (!fullName || !nationalId || !phone || !planType || !startDate) {
      throw new Error("Completá nombre, cédula, teléfono, plan y fecha de inicio.");
    }

    if (!MEMBERSHIP_PLANS[planType]) {
      throw new Error("Elegí un plan válido para dar de alta.");
    }

    if (existingMember) {
      throw new Error("Ya existe un socio con esa cédula. Usá renovar para extender la membresía.");
    }

    const member = {
      id: `mem-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      fullName,
      nationalId,
      phone,
      planType,
      startDate,
      endDate: computePlanEndDate(planType, startDate),
      accessCode: generateAccessCode(state),
      renewalCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    state.members.push(member);
    persistState(state);
    return enrichMember(member);
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

    member.planType = planType;
    member.startDate = explicitStartDate || (current.isActive ? member.startDate : extensionStartDate);
    member.endDate = computePlanEndDate(planType, extensionStartDate);
    member.renewalCount = Number(member.renewalCount || 0) + 1;
    member.lastRenewedAt = new Date().toISOString();
    member.updatedAt = new Date().toISOString();

    persistState(state);
    return enrichMember(member);
  }

  function findMemberByIdentifier(query) {
    const state = loadState();
    const normalizedQuery = stripDigits(query);

    if (!normalizedQuery) {
      return null;
    }

    const member = state.members.find(
      (item) => item.accessCode === normalizedQuery || item.nationalId === normalizedQuery
    );

    return member ? enrichMember(member) : null;
  }

  function getCheckIns(limit) {
    const state = loadState();
    const records = state.checkIns
      .map((checkIn) => {
        const member = state.members.find((item) => item.id === checkIn.memberId);
        const enrichedMember = member ? enrichMember(member) : null;

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

    const member = state.members.find(
      (item) => item.accessCode === normalizedQuery || item.nationalId === normalizedQuery
    );

    if (!member) {
      throw new Error("No encontramos un socio con ese código o cédula.");
    }

    const enrichedMember = enrichMember(member);
    const result = enrichedMember.isActive ? "active" : enrichedMember.isScheduled ? "scheduled" : "expired";

    state.checkIns.unshift({
      id: `chk-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      memberId: member.id,
      query: normalizedQuery,
      result,
      createdAt: new Date().toISOString(),
    });

    state.checkIns = state.checkIns.slice(0, 120);
    persistState(state);

    return {
      ...enrichedMember,
      checkInResult: result,
    };
  }

  function getStats() {
    const members = getMembers({ includeScheduled: true });
    const today = toDateKey(new Date());
    const weekStart = startOfWeek(new Date());
    const weekEnd = addDays(weekStart, 7);
    const checkIns = getCheckIns();

    const activeClassPlans = members.filter((member) => member.planCategory === "clases" && member.isActive);
    const classPlansToday = members.filter((member) => member.planCategory === "clases" && toDateKey(new Date(member.createdAt)) === today).length;
    const classPlansWeek = members.filter((member) => {
      if (member.planCategory !== "clases") {
        return false;
      }

      const createdAt = new Date(member.createdAt);
      return createdAt >= weekStart && createdAt < weekEnd;
    }).length;
    const byClass = activeClassPlans.reduce((accumulator, member) => {
      if (!member.relatedClassType) {
        return accumulator;
      }

      accumulator[member.relatedClassType] = (accumulator[member.relatedClassType] || 0) + 1;
      return accumulator;
    }, {});
    const topClassKey = Object.keys(byClass).sort((left, right) => byClass[right] - byClass[left])[0];
    const activeMembers = members.filter((member) => member.isActive).length;
    const expiringThisWeek = members.filter((member) => member.isActive && member.daysRemaining <= 7).length;
    const checkInsToday = checkIns.filter((checkIn) => toDateKey(new Date(checkIn.createdAt)) === today).length;
    const renewalsThisWeek = members.filter((member) => {
      if (!member.lastRenewedAt) {
        return false;
      }

      const renewedAt = new Date(member.lastRenewedAt);
      return renewedAt >= weekStart && renewedAt < weekEnd;
    }).length;

    return {
      reservationsToday: classPlansToday,
      reservationsWeek: classPlansWeek,
      freeSpots: activeClassPlans.length,
      classPlansToday,
      classPlansWeek,
      activeClassPlans: activeClassPlans.length,
      topClass: topClassKey ? getClassMeta(topClassKey).label : "Sin datos",
      topClassCount: topClassKey ? byClass[topClassKey] : 0,
      activeMembers,
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
    getReservations,
    getUniqueUpcomingDates,
    getStats,
    getMembers,
    getCheckIns,
    createReservation,
    cancelReservation,
    deleteMember,
    addSchedule,
    createMember,
    renewMembership,
    checkInMember,
    findMemberByIdentifier,
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
