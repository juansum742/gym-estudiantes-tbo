const bookingApi = window.EstudiantesTboBooking;
const SESSION_KEY = "estudiantes-tbo-admin-session";

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function bindValidatedField(input, syncValidity) {
  input.addEventListener("input", syncValidity);
  input.addEventListener("blur", syncValidity);
  input.addEventListener("invalid", syncValidity);
}

function animateValue(element, target) {
  const previous = Number(element.dataset.adminValue || 0);
  const duration = 700;
  const start = performance.now();

  const step = (timestamp) => {
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(previous + (target - previous) * eased);
    element.textContent = currentValue.toLocaleString("es-UY");

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.dataset.adminValue = String(target);
    }
  };

  requestAnimationFrame(step);
}

function showToast(message, tone = "success") {
  const stack = document.querySelector("#toast-stack");

  if (!stack) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  stack.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 260);
  }, 3200);
}

if (bookingApi) {
  const gateSection = document.querySelector("#admin-gate-section");
  const dashboard = document.querySelector("#admin-dashboard");
  const loginForm = document.querySelector("#admin-login-form");
  const loginButton = document.querySelector("#admin-login-button");
  const pinInput = document.querySelector("#admin-pin");
  const gateNote = document.querySelector("#admin-gate-note");

  const statPendingRequests = document.querySelector("#stat-pending-requests");
  const statActiveMembers = document.querySelector("#stat-active-members");
  const statActivePlans = document.querySelector("#stat-active-plans");
  const statExpiringWeek = document.querySelector("#stat-expiring-week");

  const pendingRequestsList = document.querySelector("#admin-requests");
  const listCounter = document.querySelector("#admin-requests-counter");
  const pendingFeedback = document.querySelector("#pending-feedback");
  const classReservationsList = document.querySelector("#class-reservations");
  const classReservationsCounter = document.querySelector("#class-reservations-counter");
  const classReservationsFeedback = document.querySelector("#class-reservations-feedback");
  const schedulesList = document.querySelector("#admin-schedules-list");
  const schedulesCounter = document.querySelector("#admin-schedules-counter");
  const scheduleForm = document.querySelector("#admin-schedule-form");
  const scheduleButton = document.querySelector("#admin-schedule-button");
  const adminDate = document.querySelector("#admin-date");
  const adminTime = document.querySelector("#admin-time");
  const adminClass = document.querySelector("#admin-class");
  const adminCapacity = document.querySelector("#admin-capacity");
  const adminFormFeedback = document.querySelector("#admin-form-feedback");

  const memberForm = document.querySelector("#admin-member-form");
  const memberButton = document.querySelector("#member-submit");
  const memberName = document.querySelector("#member-name");
  const memberId = document.querySelector("#member-id");
  const memberPhone = document.querySelector("#member-phone");
  const memberPlan = document.querySelector("#member-plan");
  const memberStart = document.querySelector("#member-start");
  const membershipPreview = document.querySelector("#membership-preview");
  const memberFormFeedback = document.querySelector("#member-form-feedback");

  const checkinForm = document.querySelector("#admin-checkin-form");
  const checkinButton = document.querySelector("#checkin-submit");
  const checkinQuery = document.querySelector("#checkin-query");
  const checkinAlert = document.querySelector("#checkin-alert");

  const membersCounter = document.querySelector("#members-counter");
  const adminMembersList = document.querySelector("#admin-members-list");
  const expiringCounter = document.querySelector("#expiring-counter");
  const expiringList = document.querySelector("#expiring-list");
  const renewalCounter = document.querySelector("#renewal-counter");
  const renewalList = document.querySelector("#renewal-list");
  const checkinCounter = document.querySelector("#checkin-counter");
  const checkinHistory = document.querySelector("#checkin-history");

  function unlockDashboard() {
    gateSection.classList.add("is-hidden");
    dashboard.classList.remove("is-hidden");
    renderDashboard();
  }

  function setFeedback(element, tone, message) {
    element.className = `booking-feedback booking-feedback-${tone}`;
    element.textContent = message;
  }

  function syncDateField(input) {
    const today = new Date();
    const minDate = toDateKey(today);
    input.min = minDate;
    input.value ||= minDate;
  }

  function syncMemberPhoneValidity() {
    memberPhone.value = bookingApi.sanitizePhoneInput(memberPhone.value);

    try {
      bookingApi.validatePhone(memberPhone.value);
      memberPhone.setCustomValidity("");
      return true;
    } catch (error) {
      memberPhone.setCustomValidity(error.message);
      return false;
    }
  }

  function syncMemberIdValidity() {
    memberId.value = bookingApi.sanitizeNationalIdInput(memberId.value);

    try {
      bookingApi.validateNationalId(memberId.value);
      memberId.setCustomValidity("");
      return true;
    } catch (error) {
      memberId.setCustomValidity(error.message);
      return false;
    }
  }

  function syncCheckinValidity() {
    checkinQuery.value = bookingApi.sanitizeCheckinInput(checkinQuery.value);

    try {
      bookingApi.validateCheckinQuery(checkinQuery.value);
      checkinQuery.setCustomValidity("");
      return true;
    } catch (error) {
      checkinQuery.setCustomValidity(error.message);
      return false;
    }
  }

  function populateClassOptions() {
    adminClass.innerHTML = Object.entries(bookingApi.classTypes)
      .filter(([, value]) => value.reservable)
      .map(([key, value]) => `<option value="${key}">${escapeHtml(value.label)}</option>`)
      .join("");
  }

  function populatePlanOptions() {
    memberPlan.innerHTML = bookingApi.getPublicMembershipPlanEntries()
      .map(([key, value]) => {
        const price = value.price ? ` | ${escapeHtml(bookingApi.formatCurrency(value.price))}` : "";
        return `<option value="${key}">${escapeHtml(value.label)}${price}</option>`;
      })
      .join("");
  }

  function updateMembershipPreview() {
    const planMeta = bookingApi.membershipPlans[memberPlan.value];

    if (!planMeta || !memberStart.value) {
      membershipPreview.textContent = "Elegí un plan para calcular automáticamente su vencimiento.";
      return;
    }

    const endDate = bookingApi.computePlanEndDate(memberPlan.value, memberStart.value);
    const priceLabel = planMeta.price ? bookingApi.formatCurrency(planMeta.price) : "Consultar";
    const classLabel = planMeta.classType
      ? bookingApi.classTypes[planMeta.classType].label
      : planMeta.category === "general"
        ? "Acceso completo"
        : "Musculación";

    membershipPreview.innerHTML = `
      <strong>${escapeHtml(planMeta.label)}</strong>
      <span>${escapeHtml(priceLabel)} | ${escapeHtml(classLabel)} | ${planMeta.durationDays} día${planMeta.durationDays === 1 ? "" : "s"} | vence el ${escapeHtml(bookingApi.formatDateFull(endDate))}</span>
    `;
  }

  function renderStats() {
    const stats = bookingApi.getStats();
    animateValue(statPendingRequests, stats.pendingRequests);
    animateValue(statActiveMembers, stats.activeMembers);
    animateValue(statActivePlans, stats.activePlans);
    animateValue(statExpiringWeek, stats.expiringThisWeek);
  }

  function renderReservations() {
    const pendingRequests = bookingApi.getRequests({ status: "pending" });

    listCounter.textContent = `${pendingRequests.length} pendiente${pendingRequests.length === 1 ? "" : "s"}`;

    if (!pendingRequests.length) {
      pendingRequestsList.innerHTML = `
        <article class="admin-empty-card">
          <strong>Sin solicitudes pendientes</strong>
          <p>Cuando llegue una nueva solicitud desde la home, vas a poder confirmarla o rechazarla desde este bloque.</p>
        </article>
      `;
      return;
    }

    pendingRequestsList.innerHTML = pendingRequests
      .map((request) => {
        const notes = [];

        if (request.notes) {
          notes.push(`<p class="admin-request-note">${escapeHtml(request.notes)}</p>`);
        }

        if (request.hasActiveConflict) {
          notes.push(`
            <p class="admin-request-note admin-request-note-warning">
              Este plan ya está activo para esta cédula con el código ${escapeHtml(request.activeConflictCode || "asignado")}.
            </p>
          `);
        }

        const notesHtml = notes.join("");
        const approveLabel = request.hasActiveConflict ? "Ya activo" : "Confirmar pago y activar";
        const approveAttributes = request.hasActiveConflict ? 'disabled aria-disabled="true"' : "";
        const conflictBadge = request.hasActiveConflict
          ? '<span class="admin-class-pill accent-limited">Ya activo</span>'
          : "";

        return `
          <article class="admin-reservation-card">
            <div class="admin-reservation-head">
              <div>
                <strong>${escapeHtml(request.fullName)}</strong>
                <span>CI ${escapeHtml(request.nationalId)} | ${escapeHtml(request.phone)}</span>
              </div>
              <div class="admin-pill-group">
                <span class="admin-class-pill accent-${request.statusTone}">${escapeHtml(request.statusLabel)}</span>
                ${conflictBadge}
              </div>
            </div>

            <div class="admin-reservation-grid">
              <div>
                <span>Plan solicitado</span>
                <strong>${escapeHtml(request.planLabel)}</strong>
              </div>
              <div>
                <span>Fecha</span>
                <strong>${escapeHtml(request.createdDateLabel)} | ${escapeHtml(request.createdTimeLabel)}</strong>
              </div>
              <div>
                <span>Cédula</span>
                <strong>${escapeHtml(request.nationalId)}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>${escapeHtml(request.statusLabel)}</strong>
              </div>
            </div>

            ${notesHtml}

            <div class="admin-request-actions">
              <button class="btn btn-primary admin-btn" type="button" data-approve-request-id="${request.id}" ${approveAttributes}>
                ${approveLabel}
              </button>
              <button class="btn btn-secondary admin-btn admin-btn-danger" type="button" data-reject-request-id="${request.id}">
                Rechazar
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderClassReservations() {
    const reservations = bookingApi.getReservations({ futureOnly: true, reservableOnly: true });
    classReservationsCounter.textContent = `${reservations.length} reserva${reservations.length === 1 ? "" : "s"}`;

    if (!reservations.length) {
      classReservationsList.innerHTML = `
        <article class="admin-empty-card">
          <strong>Sin reservas de clases</strong>
          <p>Las reservas que hagan los socios desde la home se van a mostrar acá para confirmar o cancelar.</p>
        </article>
      `;
      return;
    }

    classReservationsList.innerHTML = reservations
      .map((reservation) => {
        const confirmLabel = reservation.status === "confirmed" ? "Confirmada" : "Confirmar";
        const confirmAttributes = reservation.status === "confirmed" ? 'disabled aria-disabled="true"' : "";
        const availabilityLabel = reservation.schedule?.statusLabel || "Horario cargado";

        return `
          <article class="admin-reservation-card">
            <div class="admin-reservation-head">
              <div>
                <strong>${escapeHtml(reservation.fullName)}</strong>
                <span>CI ${escapeHtml(reservation.nationalId)} | ${escapeHtml(reservation.accessCode || "sin código")}</span>
              </div>
              <div class="admin-pill-group">
                <span class="admin-class-pill accent-${reservation.accent}">${escapeHtml(reservation.classLabel)}</span>
                <span class="admin-class-pill accent-${reservation.statusTone}">${escapeHtml(reservation.statusLabel)}</span>
              </div>
            </div>

            <div class="admin-reservation-grid">
              <div>
                <span>Disciplina</span>
                <strong>${escapeHtml(reservation.classLabel)}</strong>
              </div>
              <div>
                <span>Fecha</span>
                <strong>${escapeHtml(bookingApi.formatDateFull(reservation.date))}</strong>
              </div>
              <div>
                <span>Horario</span>
                <strong>${escapeHtml(reservation.time)}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>${escapeHtml(reservation.statusLabel)}</strong>
              </div>
              <div>
                <span>Cupos</span>
                <strong>${escapeHtml(availabilityLabel)}</strong>
              </div>
              <div>
                <span>Reserva creada</span>
                <strong>${escapeHtml(new Date(reservation.createdAt).toLocaleDateString("es-UY"))}</strong>
              </div>
            </div>

            <div class="admin-request-actions">
              <button class="btn btn-primary admin-btn" type="button" data-confirm-reservation-id="${reservation.id}" ${confirmAttributes}>
                ${confirmLabel}
              </button>
              <button class="btn btn-secondary admin-btn admin-btn-danger" type="button" data-cancel-reservation-id="${reservation.id}">
                Cancelar
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderSchedules() {
    const schedules = bookingApi.getSchedules({ futureOnly: true, reservableOnly: true });
    schedulesCounter.textContent = `${schedules.length} horario${schedules.length === 1 ? "" : "s"}`;

    if (!schedules.length) {
      schedulesList.innerHTML = `
        <article class="admin-empty-card">
          <strong>Sin horarios cargados</strong>
          <p>Usá el formulario de alta para crear bloques nuevos con sus cupos correspondientes.</p>
        </article>
      `;
      return;
    }

    schedulesList.innerHTML = schedules
      .map((schedule) => `
        <article class="admin-reservation-card">
          <div class="admin-reservation-head">
            <div>
              <strong>${escapeHtml(schedule.classLabel)}</strong>
              <span>${escapeHtml(schedule.dateLabel)} | ${escapeHtml(schedule.time)}</span>
            </div>
            <div class="admin-pill-group">
              <span class="admin-class-pill accent-${schedule.accent}">${escapeHtml(schedule.classLabel)}</span>
              <span class="admin-class-pill accent-${schedule.status === "occupied" ? "danger" : schedule.status === "limited" ? "limited" : "available"}">${escapeHtml(schedule.status === "occupied" ? "Completo" : schedule.status === "limited" ? "Últimos cupos" : "Disponible")}</span>
            </div>
          </div>

          <div class="admin-reservation-grid">
            <div>
              <span>Fecha</span>
              <strong>${escapeHtml(bookingApi.formatDateFull(schedule.date))}</strong>
            </div>
            <div>
              <span>Horario</span>
              <strong>${escapeHtml(schedule.time)}</strong>
            </div>
            <div>
              <span>Reservados</span>
              <strong>${schedule.reservedCount}</strong>
            </div>
            <div>
              <span>Cupos totales</span>
              <strong>${schedule.capacity}</strong>
            </div>
            <div>
              <span>Disponibles</span>
              <strong>${schedule.remaining}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>${escapeHtml(schedule.statusLabel)}</strong>
            </div>
          </div>

          <form class="admin-capacity-form" data-update-schedule-id="${schedule.id}">
            <label class="form-field admin-capacity-field">
              <span>Editar cupos</span>
              <input type="number" min="${Math.max(1, schedule.reservedCount)}" max="50" value="${schedule.capacity}" required>
            </label>
            <button class="btn btn-secondary admin-btn" type="submit">Guardar cupos</button>
          </form>
        </article>
      `)
      .join("");
  }

  function renderMembers() {
    const profiles = bookingApi.getProfiles({ includeScheduled: true });
    const visibleProfiles = profiles.filter((profile) => profile.isActive);
    membersCounter.textContent = `${visibleProfiles.length} socio${visibleProfiles.length === 1 ? "" : "s"}`;

    if (!visibleProfiles.length) {
      adminMembersList.innerHTML = `
        <article class="admin-empty-card">
          <strong>Sin socios cargados</strong>
          <p>Cuando des de alta una membresía vas a ver acá el código corto, plan, vigencia y estado del socio.</p>
        </article>
      `;
      return;
    }

    adminMembersList.innerHTML = visibleProfiles
      .map((profile) => {
        const visiblePlans = profile.plans.filter((plan) => plan.isActive);
        const activePlans = visiblePlans.filter((plan) => plan.isActive).length;

        return `
        <article class="member-card">
          <div class="member-card-head">
            <div>
              <strong>${escapeHtml(profile.fullName)}</strong>
              <span>${escapeHtml(visiblePlans.map((plan) => plan.planLabel).join(" + "))}</span>
            </div>
            <span class="admin-class-pill accent-${profile.statusTone}">${escapeHtml(profile.statusLabel)}</span>
          </div>

          <div class="member-card-grid">
            <div>
              <span>Cédula</span>
              <strong>${escapeHtml(profile.nationalId)}</strong>
            </div>
            <div>
              <span>Teléfono</span>
              <strong>${escapeHtml(profile.phone)}</strong>
            </div>
            <div>
              <span>Planes</span>
              <strong>${activePlans} activo${activePlans === 1 ? "" : "s"} | ${visiblePlans.length} vigente${visiblePlans.length === 1 ? "" : "s"}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>${escapeHtml(profile.accessMessage)}</strong>
            </div>
          </div>

          <div class="member-profile-list">
            ${visiblePlans.map((plan) => `
              <article class="member-profile-item accent-${plan.statusTone}">
                <div class="member-profile-item-head">
                  <div>
                    <strong>${escapeHtml(plan.planLabel)}</strong>
                    <span>${escapeHtml(plan.planCategory === "clases" ? plan.relatedClassLabel : plan.planAccess)}</span>
                  </div>
                  <span class="admin-class-pill accent-${plan.statusTone}">${escapeHtml(plan.statusLabel)}</span>
                </div>

                <div class="member-profile-item-grid">
                  <div>
                    <span>Código</span>
                    <strong>${escapeHtml(plan.accessCode)}</strong>
                  </div>
                  <div>
                    <span>Vence</span>
                    <strong>${escapeHtml(plan.endDateLabel)}</strong>
                  </div>
                  <div>
                    <span>Días restantes</span>
                    <strong>${escapeHtml(plan.accessMessage)}</strong>
                  </div>
                  <div>
                    <span>Tipo</span>
                    <strong>${escapeHtml(plan.planCategory === "clases" ? plan.relatedClassLabel : plan.planCategory === "general" ? "Acceso completo" : "Musculación")}</strong>
                  </div>
                </div>

                <div class="member-profile-item-actions">
                  <button class="btn btn-secondary admin-btn" type="button" data-renew-member-id="${plan.id}">
                    Renovar plan
                  </button>
                  <button class="btn btn-secondary admin-btn admin-btn-danger" type="button" data-delete-member-id="${plan.id}">
                    Eliminar
                  </button>
                </div>
              </article>
            `).join("")}
          </div>
        </article>
      `;
      })
      .join("");
  }

  function renderExpiring() {
    const expiringMembers = bookingApi.getMembers({ activeOnly: true, expiresWithin: 7 });
    expiringCounter.textContent = `${expiringMembers.length} caso${expiringMembers.length === 1 ? "" : "s"}`;

    if (!expiringMembers.length) {
      expiringList.innerHTML = `
        <article class="mini-status-card">
          <strong>Sin vencimientos próximos</strong>
          <p>No hay socios activos que venzan en los próximos 7 días.</p>
        </article>
      `;
      return;
    }

    expiringList.innerHTML = expiringMembers
      .map((member) => `
        <article class="mini-status-card">
          <strong>${escapeHtml(member.fullName)}</strong>
          <p>${escapeHtml(member.planLabel)} | vence el ${escapeHtml(member.endDateLabel)}.</p>
          <span>${escapeHtml(member.accessMessage)}</span>
        </article>
      `)
      .join("");
  }

  function renderRenewals() {
    const renewalCandidates = bookingApi.getMembers({ renewalCandidates: true, includeScheduled: false });
    renewalCounter.textContent = `${renewalCandidates.length} caso${renewalCandidates.length === 1 ? "" : "s"}`;

    if (!renewalCandidates.length) {
      renewalList.innerHTML = `
        <article class="mini-status-card">
          <strong>Renovaciones al día</strong>
          <p>No hay socios vencidos recientes ni por vencer que necesiten renovación inmediata.</p>
        </article>
      `;
      return;
    }

    renewalList.innerHTML = renewalCandidates
      .map((member) => `
        <article class="mini-status-card mini-status-card-action">
          <div>
            <strong>${escapeHtml(member.fullName)}</strong>
            <p>${escapeHtml(member.planLabel)} | ${escapeHtml(member.accessMessage)}</p>
          </div>
          <button class="btn btn-secondary admin-btn" type="button" data-renew-member-id="${member.id}">
            Renovar
          </button>
        </article>
      `)
      .join("");
  }

  function renderCheckinHistory() {
    const history = bookingApi.getCheckIns(12);
    const stats = bookingApi.getStats();
    checkinCounter.textContent = `${stats.checkInsToday} hoy`;

    if (!history.length) {
      checkinHistory.innerHTML = `
        <article class="mini-status-card">
          <strong>Sin check-ins todavía</strong>
          <p>Los ingresos validados desde caja se van a guardar y listar acá.</p>
        </article>
      `;
      return;
    }

    checkinHistory.innerHTML = history
      .map((entry) => {
        const tone = entry.result === "active" ? "available" : entry.result === "scheduled" ? "accent" : "danger";
        const status = entry.result === "active" ? "Activo" : entry.result === "scheduled" ? "Programado" : "Vencido";

        return `
          <article class="mini-status-card">
            <div class="mini-status-head">
              <strong>${escapeHtml(entry.member?.fullName || "Socio no disponible")}</strong>
              <span class="admin-class-pill accent-${tone}">${status}</span>
            </div>
            <p>${escapeHtml(entry.member?.planSummary || entry.member?.planLabel || "Sin plan")} | ${escapeHtml(entry.timeLabel)} del ${escapeHtml(entry.dateLabel)}</p>
            <span>${escapeHtml(entry.member?.accessMessage || "Registro histórico")}</span>
          </article>
        `;
      })
      .join("");
  }

  function getCheckinDisplayPlans(member) {
    if (Array.isArray(member.plans) && member.plans.length) {
      const activePlans = member.plans.filter((plan) => plan.isActive);

      if (activePlans.length) {
        return activePlans;
      }

      const scheduledPlans = member.plans.filter((plan) => plan.isScheduled);
      return scheduledPlans.length ? scheduledPlans : member.plans;
    }

    if (!member.planLabel) {
      return [];
    }

    return [
      {
        ...member,
        id: member.id || member.accessCode || member.planLabel,
        statusTone: member.statusTone || (member.isActive ? "available" : member.isScheduled ? "accent" : "danger"),
      },
    ];
  }

  function renderCheckinPlanList(member) {
    const displayPlans = getCheckinDisplayPlans(member);

    if (!displayPlans.length) {
      return "";
    }

    return `
      <div class="checkin-plan-list">
        ${displayPlans.map((plan) => `
          <article class="checkin-plan-item accent-${plan.statusTone}${plan.id === member.matchedPlanId ? " is-matched" : ""}">
            <div class="checkin-plan-item-head">
              <strong>${escapeHtml(plan.planLabel)}</strong>
              <span>${escapeHtml(plan.planCategory === "clases" ? plan.relatedClassLabel : plan.planCategory === "general" ? "Acceso completo" : "Musculación")}</span>
            </div>
            <div class="checkin-plan-item-meta">
              <span>Código ${escapeHtml(plan.accessCode)}</span>
              <span>Vence ${escapeHtml(plan.endDateLabel)}</span>
              <span>${escapeHtml(plan.accessMessage)}</span>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderCheckinAlert(member) {
    const displayPlans = getCheckinDisplayPlans(member);
    const activePlanCount = member.activePlanCount ?? displayPlans.filter((plan) => plan.isActive).length;
    const scheduledPlanCount = member.scheduledPlanCount ?? displayPlans.filter((plan) => plan.isScheduled).length;
    const expiredPlanCount = member.expiredPlanCount ?? displayPlans.filter((plan) => !plan.isActive && !plan.isScheduled).length;
    const alertClass =
      member.checkInResult === "active"
        ? "checkin-alert-success"
        : member.checkInResult === "scheduled"
          ? "checkin-alert-warning"
          : "checkin-alert-error";

    const headline =
      member.checkInResult === "active"
        ? activePlanCount > 1 ? "PLANES ACTIVOS" : "PLAN ACTIVO"
        : member.checkInResult === "scheduled"
          ? "PLAN AÚN NO ACTIVO"
          : "MEMBRESÍA VENCIDA";

    checkinAlert.className = `checkin-alert ${alertClass}`;
    checkinAlert.innerHTML = `
      <strong>${headline}</strong>
      <p>${escapeHtml(member.fullName)} | CI ${escapeHtml(member.nationalId)}</p>
      <div class="checkin-alert-grid">
        <span>${activePlanCount} activo${activePlanCount === 1 ? "" : "s"}</span>
        <span>${scheduledPlanCount} programado${scheduledPlanCount === 1 ? "" : "s"}</span>
        <span>${expiredPlanCount} vencido${expiredPlanCount === 1 ? "" : "s"}</span>
      </div>
      ${renderCheckinPlanList(member)}
      <small>${escapeHtml(member.accessMessage)}</small>
    `;
  }

  function renderDashboard() {
    renderStats();
    renderReservations();
    renderClassReservations();
    renderSchedules();
    renderMembers();
    renderExpiring();
    renderRenewals();
    renderCheckinHistory();
  }

  dashboard.addEventListener("click", async (event) => {
    const approveButton = event.target.closest("[data-approve-request-id]");
    const rejectButton = event.target.closest("[data-reject-request-id]");
    const confirmReservationButton = event.target.closest("[data-confirm-reservation-id]");
    const cancelReservationButton = event.target.closest("[data-cancel-reservation-id]");
    const renewButton = event.target.closest("[data-renew-member-id]");
    const deleteButton = event.target.closest("[data-delete-member-id]");

    if (approveButton) {
      try {
        setFeedback(pendingFeedback, "loading", "Confirmando pago y generando código premium...");
        await wait(380);
        const approved = bookingApi.approveMembershipRequest(approveButton.dataset.approveRequestId);
        const profile = bookingApi.findMemberByIdentifier(approved.member.nationalId) || approved.member;
        setFeedback(pendingFeedback, "success", `Pago confirmado. Código de acceso: ${approved.member.accessCode}`);
        renderCheckinAlert({
          ...profile,
          checkInResult: profile.isActive ? "active" : profile.isScheduled ? "scheduled" : "expired",
        });
        showToast(`Pago confirmado para ${approved.member.fullName}. Código ${approved.member.accessCode}.`, "success");
      } catch (error) {
        setFeedback(pendingFeedback, "error", error.message);
        showToast(error.message, "error");
      }

      return;
    }

    if (rejectButton) {
      try {
        const rejected = bookingApi.rejectMembershipRequest(rejectButton.dataset.rejectRequestId);
        setFeedback(pendingFeedback, "warning", `Solicitud rechazada para ${rejected.fullName}.`);
        showToast(`Solicitud rechazada para ${rejected.fullName}.`, "warning");
      } catch (error) {
        setFeedback(pendingFeedback, "error", error.message);
        showToast(error.message, "error");
      }

      return;
    }

    if (confirmReservationButton) {
      try {
        setFeedback(classReservationsFeedback, "loading", "Confirmando reserva de clase...");
        await wait(320);
        const reservation = bookingApi.confirmReservation(confirmReservationButton.dataset.confirmReservationId);
        setFeedback(classReservationsFeedback, "success", `Reserva confirmada para ${reservation.fullName} en ${reservation.classLabel} a las ${reservation.time}.`);
        showToast(`Reserva confirmada para ${reservation.fullName}.`, "success");
      } catch (error) {
        setFeedback(classReservationsFeedback, "error", error.message);
        showToast(error.message, "error");
      }

      return;
    }

    if (cancelReservationButton) {
      const reservationCard = cancelReservationButton.closest(".admin-reservation-card");
      const reservationName = reservationCard?.querySelector(".admin-reservation-head strong")?.textContent?.trim() || "esta reserva";

      if (!window.confirm(`Vas a cancelar la reserva de ${reservationName}. El cupo vuelve a quedar libre.`)) {
        return;
      }

      try {
        const removed = bookingApi.cancelReservation(cancelReservationButton.dataset.cancelReservationId);
        setFeedback(classReservationsFeedback, "warning", `Reserva cancelada para ${removed.fullName}. El horario volvió a quedar disponible.`);
        showToast(`Reserva cancelada para ${removed.fullName}.`, "warning");
      } catch (error) {
        setFeedback(classReservationsFeedback, "error", error.message);
        showToast(error.message, "error");
      }

      return;
    }

    if (deleteButton) {
      const memberProfileItem = deleteButton.closest(".member-profile-item");
      const memberCard = deleteButton.closest(".member-card");
      const classPlanCard = deleteButton.closest(".admin-reservation-card");
      const planName = memberProfileItem?.querySelector(".member-profile-item-head strong")?.textContent?.trim()
        || classPlanCard?.querySelector(".admin-reservation-head .admin-class-pill")?.textContent?.trim()
        || "este plan";
      const memberName = memberCard?.querySelector(".member-card-head strong")?.textContent?.trim()
        || classPlanCard?.querySelector(".admin-reservation-head strong")?.textContent?.trim()
        || "este socio";

      if (!window.confirm(`Vas a eliminar ${planName} de ${memberName}. También se ajusta su historial de check-ins.`)) {
        return;
      }

      try {
        const removed = bookingApi.deleteMember(deleteButton.dataset.deleteMemberId);
        showToast(`Plan eliminado para ${removed.fullName}.`, "success");
      } catch (error) {
        showToast(error.message, "error");
      }

      return;
    }

    if (!renewButton) {
      return;
    }

    try {
      const memberProfileItem = renewButton.closest(".member-profile-item");
      const planName = memberProfileItem?.querySelector(".member-profile-item-head strong")?.textContent?.trim();
      const renewed = bookingApi.renewMembership(renewButton.dataset.renewMemberId);
      const profile = bookingApi.findMemberByIdentifier(renewed.nationalId) || renewed;
      showToast(`Plan ${planName || renewed.planLabel} renovado para ${renewed.fullName}.`, "success");
      renderCheckinAlert({
        ...profile,
        checkInResult: profile.isActive ? "active" : profile.isScheduled ? "scheduled" : "expired",
      });
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    loginButton.classList.add("is-loading");
    loginButton.disabled = true;
    gateNote.textContent = "Validando acceso...";

    try {
      await wait(620);

      if (pinInput.value.trim() !== bookingApi.adminPin) {
        gateNote.textContent = "PIN incorrecto. Volvé a intentar.";
        showToast("PIN incorrecto.", "error");
        return;
      }

      sessionStorage.setItem(SESSION_KEY, "true");
      unlockDashboard();
      showToast("Acceso concedido al panel privado.", "success");
    } finally {
      loginButton.classList.remove("is-loading");
      loginButton.disabled = false;
    }
  });

  scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    scheduleButton.classList.add("is-loading");
    scheduleButton.disabled = true;
    setFeedback(adminFormFeedback, "loading", "Actualizando agenda premium...");

    try {
      await wait(620);

      bookingApi.addSchedule({
        date: adminDate.value,
        time: adminTime.value,
        classType: adminClass.value,
        capacity: Number(adminCapacity.value),
      });

      setFeedback(adminFormFeedback, "success", "Horario agregado. Ya quedó visible en la agenda del sitio y en este panel.");
      showToast("Nuevo horario agregado con éxito.", "success");
      scheduleForm.reset();
      syncDateField(adminDate);
      adminCapacity.value = bookingApi.classTypes[adminClass.value || "funcional"].capacity;
    } catch (error) {
      setFeedback(adminFormFeedback, "error", error.message);
      showToast(error.message, "error");
    } finally {
      scheduleButton.classList.remove("is-loading");
      scheduleButton.disabled = false;
    }
  });

  dashboard.addEventListener("submit", async (event) => {
    const capacityForm = event.target.closest("[data-update-schedule-id]");

    if (!capacityForm) {
      return;
    }

    event.preventDefault();

    const submit = capacityForm.querySelector('button[type="submit"]');
    const input = capacityForm.querySelector('input[type="number"]');

    submit.classList.add("is-loading");
    submit.disabled = true;
    setFeedback(adminFormFeedback, "loading", "Actualizando cupos del horario...");

    try {
      await wait(320);
      const updatedSchedule = bookingApi.updateScheduleCapacity(capacityForm.dataset.updateScheduleId, Number(input.value));
      setFeedback(adminFormFeedback, "success", `Cupos actualizados para ${updatedSchedule.classLabel} del ${updatedSchedule.dateLabel} a las ${updatedSchedule.time}.`);
      showToast(`Cupos actualizados para ${updatedSchedule.classLabel}.`, "success");
    } catch (error) {
      setFeedback(adminFormFeedback, "error", error.message);
      showToast(error.message, "error");
    } finally {
      submit.classList.remove("is-loading");
      submit.disabled = false;
    }
  });

  memberForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!syncMemberIdValidity()) {
      setFeedback(memberFormFeedback, "error", memberId.validationMessage);
      memberId.reportValidity();
      return;
    }

    if (!syncMemberPhoneValidity()) {
      setFeedback(memberFormFeedback, "error", memberPhone.validationMessage);
      memberPhone.reportValidity();
      return;
    }

    memberButton.classList.add("is-loading");
    memberButton.disabled = true;
    setFeedback(memberFormFeedback, "loading", "Generando membresía y código de acceso...");

    try {
      await wait(620);
      memberName.value = memberName.value.trim();

      const member = bookingApi.createMember({
        fullName: memberName.value,
        nationalId: memberId.value,
        phone: memberPhone.value,
        planType: memberPlan.value,
        startDate: memberStart.value,
      });

      setFeedback(
        memberFormFeedback,
        "success",
        member.isScheduled
          ? `Plan creado con éxito. Código ${member.accessCode}. Inicia el ${member.startDateLabel}.`
          : `Socio creado con éxito. Código ${member.accessCode}. Vence el ${member.endDateLabel}.`
      );
      showToast(`Socio ${member.fullName} creado con código ${member.accessCode}.`, "success");
      memberForm.reset();
      syncDateField(memberStart);
      updateMembershipPreview();
    } catch (error) {
      setFeedback(memberFormFeedback, "error", error.message);
      showToast(error.message, "error");
    } finally {
      memberButton.classList.remove("is-loading");
      memberButton.disabled = false;
    }
  });

  checkinForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!syncCheckinValidity()) {
      checkinAlert.className = "checkin-alert checkin-alert-error";
      checkinAlert.innerHTML = `
        <strong>DATOS INVÁLIDOS</strong>
        <p>${escapeHtml(checkinQuery.validationMessage)}</p>
        <small>Usá un código de 4 a 6 dígitos o una cédula de 7 a 8 dígitos.</small>
      `;
      checkinQuery.reportValidity();
      return;
    }

    checkinButton.classList.add("is-loading");
    checkinButton.disabled = true;

    try {
      await wait(420);
      const member = bookingApi.checkInMember(checkinQuery.value);
      renderCheckinAlert(member);
      showToast(
        member.checkInResult === "active"
          ? `Ingreso validado para ${member.fullName}. ${member.activePlanCount} plan${member.activePlanCount === 1 ? "" : "es"} activo${member.activePlanCount === 1 ? "" : "s"}.`
          : member.checkInResult === "scheduled"
            ? `${member.fullName} tiene ${member.scheduledPlanCount} plan${member.scheduledPlanCount === 1 ? "" : "es"} programado${member.scheduledPlanCount === 1 ? "" : "s"}.`
            : `Atención: ${member.fullName} no tiene una membresía activa.`,
        member.checkInResult === "active" ? "success" : member.checkInResult === "scheduled" ? "warning" : "error"
      );
      checkinForm.reset();
    } catch (error) {
      checkinAlert.className = "checkin-alert checkin-alert-error";
      checkinAlert.innerHTML = `
        <strong>VALIDACIÓN NO ENCONTRADA</strong>
        <p>${escapeHtml(error.message)}</p>
        <small>Probá con el código corto del socio o su número de cédula.</small>
      `;
      showToast(error.message, "error");
    } finally {
      checkinButton.classList.remove("is-loading");
      checkinButton.disabled = false;
    }
  });

  adminClass.addEventListener("change", () => {
    const classMeta = bookingApi.classTypes[adminClass.value];
    adminCapacity.value = classMeta.capacity;
  });

  bindValidatedField(memberPhone, syncMemberPhoneValidity);
  bindValidatedField(memberId, syncMemberIdValidity);
  bindValidatedField(checkinQuery, syncCheckinValidity);
  memberPlan.addEventListener("change", updateMembershipPreview);
  memberStart.addEventListener("change", updateMembershipPreview);

  window.addEventListener(bookingApi.changeEvent, () => {
    if (!dashboard.classList.contains("is-hidden")) {
      renderDashboard();
    }
  });

  populateClassOptions();
  populatePlanOptions();
  syncDateField(adminDate);
  syncDateField(memberStart);
  adminCapacity.value = bookingApi.classTypes[adminClass.value || "funcional"].capacity;
  updateMembershipPreview();

  if (sessionStorage.getItem(SESSION_KEY) === "true") {
    unlockDashboard();
  }
}
