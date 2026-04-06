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
      label: "Inscripción Funcional",
      price: null,
      durationDays: 30,
      category: "clases",
      classType: "funcional",
      access: "Inscripción por 30 días. Las clases siguen operando con reserva por cupos.",
    },
    clase_fullgap: {
      label: "Inscripción FullGap",
      price: null,
      durationDays: 30,
      category: "clases",
      classType: "fullgap",
      access: "Inscripción por 30 días. Las clases siguen operando con reserva por cupos.",
    },
    clase_indoor: {
      label: "Inscripción Indoor Bike",
      price: null,
      durationDays: 30,
      category: "clases",
      classType: "indoor",
      access: "Inscripción por 30 días. Las clases siguen operando con reserva por cupos.",
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
    const isStarted = startDate <= today;
    const isActive = isStarted && expiryEnd >= today;
    const isScheduled = !isStarted;
    const daysRemaining = isActive ? Math.floor((endOfDay(member.endDate) - today) / MS_PER_DAY) + 1 : 0;
    const daysUntilStart = isScheduled ? Math.floor((startDate - today) / MS_PER_DAY) : 0;
    const expiresSoon = isActive && daysRemaining <= 7;
    const expiredDaysAgo = !isActive && !isScheduled ? Math.abs(Math.floor((today - endOfDay(member.endDate)) / MS_PER_DAY)) : 0;

    let status = "expired";
    let statusLabel = "Vencida";
    let statusTone = "danger";
    let accessMessage = `Venció el ${formatDateFull(member.endDate)}.`;

    if (isScheduled) {
      status = "scheduled";
      statusLabel = "Programada";
      statusTone = "accent";
      accessMessage = `Inicia en ${daysUntilStart} día${daysUntilStart === 1 ? "" : "s"}.`;
    } else if (isActive) {
      status = "active";
      statusLabel = "Activa";
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
    const nationalId = stripDigits(payload.nationalId);
    const phone = String(payload.phone || "").trim();
    const planType = String(payload.planType || "").trim();
    const startDate = String(payload.startDate || "").trim();
    const planMeta = getPlanMeta(planType);
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
      endDate: computeEndDate(startDate, planMeta.durationDays),
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
    const planMeta = getPlanMeta(planType);
    const explicitStartDate = String(payload.startDate || "").trim();
    const renewalAnchor = current.isActive ? addDays(parseDateKey(member.endDate), 1) : new Date();
    const extensionStartDate = explicitStartDate || toDateKey(renewalAnchor);

    member.planType = planType;
    member.startDate = explicitStartDate || (current.isActive ? member.startDate : extensionStartDate);
    member.endDate = computeEndDate(extensionStartDate, planMeta.durationDays);
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
    const normalizedQuery = stripDigits(query);

    if (!normalizedQuery) {
      throw new Error("Ingresá un código o una cédula para validar el ingreso.");
    }

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
    const reservations = getReservations();
    const schedules = getSchedules({ futureOnly: true });
    const members = getMembers();
    const today = toDateKey(new Date());
    const weekStart = startOfWeek(new Date());
    const weekEnd = addDays(weekStart, 7);
    const checkIns = getCheckIns();

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
      reservationsToday,
      reservationsWeek,
      freeSpots,
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
    addSchedule,
    createMember,
    renewMembership,
    checkInMember,
    findMemberByIdentifier,
    formatDateLabel,
    formatDateFull,
    formatCurrency,
  };
})();
