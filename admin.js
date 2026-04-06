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

  const statActiveMembers = document.querySelector("#stat-active-members");
  const statExpiringWeek = document.querySelector("#stat-expiring-week");
  const statCheckinsDay = document.querySelector("#stat-checkins-day");
  const statDay = document.querySelector("#stat-day");
  const statSpots = document.querySelector("#stat-spots");
  const statTopClass = document.querySelector("#stat-top-class");
  const statTopClassCount = document.querySelector("#stat-top-class-count");

  const reservationsList = document.querySelector("#admin-reservations");
  const listCounter = document.querySelector("#admin-list-counter");
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
      .map(([key, value]) => `<option value="${key}">${escapeHtml(value.label)}</option>`)
      .join("");
  }

  function populatePlanOptions() {
    memberPlan.innerHTML = Object.entries(bookingApi.membershipPlans)
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
    const classLabel = planMeta.classType ? bookingApi.classTypes[planMeta.classType].label : "Acceso libre";

    membershipPreview.innerHTML = `
      <strong>${escapeHtml(planMeta.label)}</strong>
      <span>${escapeHtml(priceLabel)} | ${escapeHtml(classLabel)} | ${planMeta.durationDays} día${planMeta.durationDays === 1 ? "" : "s"} | vence el ${escapeHtml(bookingApi.formatDateFull(endDate))}</span>
    `;
  }

  function renderStats() {
    const stats = bookingApi.getStats();
    animateValue(statActiveMembers, stats.activeMembers);
    animateValue(statExpiringWeek, stats.expiringThisWeek);
    animateValue(statCheckinsDay, stats.checkInsToday);
    animateValue(statDay, stats.classPlansToday);
    animateValue(statSpots, stats.activeClassPlans);
    statTopClass.textContent = stats.topClass;
    statTopClassCount.textContent = `${stats.topClassCount} plan${stats.topClassCount === 1 ? "" : "es"} activo${stats.topClassCount === 1 ? "" : "s"}`;
  }

  function renderReservations() {
    const classPlans = bookingApi
      .getMembers({ planCategory: "clases", includeScheduled: true })
      .filter((member) => member.isActive);

    listCounter.textContent = `${classPlans.length} plan${classPlans.length === 1 ? "" : "es"}`;

    if (!classPlans.length) {
      reservationsList.innerHTML = `
        <article class="admin-empty-card">
          <strong>No hay planes de clases activos</strong>
          <p>Cuando activen un plan mensual desde la home o desde caja, lo vas a ver inmediatamente acá.</p>
        </article>
      `;
      return;
    }

    reservationsList.innerHTML = classPlans
      .map((member) => {
        const meta = bookingApi.classTypes[member.relatedClassType];
        const statusDetail = `Te quedan ${member.daysRemaining} día${member.daysRemaining === 1 ? "" : "s"}`;

        return `
          <article class="admin-reservation-card">
            <div class="admin-reservation-head">
              <div>
                <strong>${escapeHtml(member.fullName)}</strong>
                <span>CI ${escapeHtml(member.nationalId)} | ${escapeHtml(member.phone)}</span>
              </div>
              <span class="admin-class-pill accent-${meta?.accent || member.statusTone}">${escapeHtml(member.relatedClassLabel)}</span>
            </div>

            <div class="admin-reservation-grid">
              <div>
                <span>Cédula</span>
                <strong>${escapeHtml(member.nationalId)}</strong>
              </div>
              <div>
                <span>Clase</span>
                <strong>${escapeHtml(member.relatedClassLabel)}</strong>
              </div>
              <div>
                <span>Días restantes</span>
                <strong>${escapeHtml(statusDetail)}</strong>
              </div>
              <div>
                <span>Vencimiento</span>
                <strong>${escapeHtml(member.endDateLabel)}</strong>
              </div>
            </div>

            <button class="btn btn-secondary admin-btn admin-btn-danger" type="button" data-delete-member-id="${member.id}">
              Eliminar plan
            </button>
          </article>
        `;
      })
      .join("");
  }

  function renderMembers() {
    const members = bookingApi.getMembers({ includeScheduled: true });
    const visibleMembers = members.filter((member) => member.isActive || member.isScheduled);
    membersCounter.textContent = `${visibleMembers.length} socio${visibleMembers.length === 1 ? "" : "s"}`;

    if (!visibleMembers.length) {
      adminMembersList.innerHTML = `
        <article class="admin-empty-card">
          <strong>Sin socios cargados</strong>
          <p>Cuando des de alta una membresía vas a ver acá el código corto, plan, vigencia y estado del socio.</p>
        </article>
      `;
      return;
    }

    adminMembersList.innerHTML = visibleMembers
      .map((member) => `
        <article class="member-card">
          <div class="member-card-head">
            <div>
              <strong>${escapeHtml(member.fullName)}</strong>
              <span>${escapeHtml(member.planLabel)}</span>
            </div>
            <span class="admin-class-pill accent-${member.statusTone}">${escapeHtml(member.statusLabel)}</span>
          </div>

          <div class="member-card-grid">
            <div>
              <span>Cédula</span>
              <strong>${escapeHtml(member.nationalId)}</strong>
            </div>
            <div>
              <span>Código</span>
              <strong>${escapeHtml(member.accessCode)}</strong>
            </div>
            <div>
              <span>Vence</span>
              <strong>${escapeHtml(member.endDateLabel)}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>${escapeHtml(member.accessMessage)}</strong>
            </div>
          </div>

          <div class="member-card-footer">
            <span>${escapeHtml(member.planAccess)}</span>
            <div class="member-card-actions">
              <button class="btn btn-secondary admin-btn" type="button" data-renew-member-id="${member.id}">
                Renovar plan
              </button>
              <button class="btn btn-secondary admin-btn admin-btn-danger" type="button" data-delete-member-id="${member.id}">
                Eliminar
              </button>
            </div>
          </div>
        </article>
      `)
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
            <p>${escapeHtml(entry.member?.planLabel || "Sin plan")} | ${escapeHtml(entry.timeLabel)} del ${escapeHtml(entry.dateLabel)}</p>
            <span>${escapeHtml(entry.member?.accessMessage || "Registro histórico")}</span>
          </article>
        `;
      })
      .join("");
  }

  function renderCheckinAlert(member) {
    const alertClass =
      member.checkInResult === "active"
        ? "checkin-alert-success"
        : member.checkInResult === "scheduled"
          ? "checkin-alert-warning"
          : "checkin-alert-error";

    const headline =
      member.checkInResult === "active"
        ? "PLAN ACTIVO"
        : member.checkInResult === "scheduled"
          ? "PLAN AÚN NO ACTIVO"
          : "MEMBRESÍA VENCIDA";

    checkinAlert.className = `checkin-alert ${alertClass}`;
    checkinAlert.innerHTML = `
      <strong>${headline}</strong>
      <p>${escapeHtml(member.fullName)} | ${escapeHtml(member.planLabel)}</p>
      <div class="checkin-alert-grid">
        <span>${member.planCategory === "clases" ? `Clase ${escapeHtml(member.relatedClassLabel)}` : "Acceso musculación libre"}</span>
        <span>Código ${escapeHtml(member.accessCode)}</span>
        <span>Vence ${escapeHtml(member.endDateLabel)}</span>
        <span>Estado ${escapeHtml(member.statusLabel)}</span>
      </div>
      <small>${escapeHtml(member.accessMessage)}</small>
    `;
  }

  function renderDashboard() {
    renderStats();
    renderReservations();
    renderMembers();
    renderExpiring();
    renderRenewals();
    renderCheckinHistory();
  }

  dashboard.addEventListener("click", (event) => {
    const renewButton = event.target.closest("[data-renew-member-id]");
    const deleteButton = event.target.closest("[data-delete-member-id]");

    if (deleteButton) {
      const memberCard = deleteButton.closest(".member-card");
      const classPlanCard = deleteButton.closest(".admin-reservation-card");
      const memberName = memberCard?.querySelector(".member-card-head strong")?.textContent?.trim()
        || classPlanCard?.querySelector(".admin-reservation-head strong")?.textContent?.trim()
        || "este socio";

      if (!window.confirm(`Vas a eliminar la membresía de ${memberName}. También se borra su historial de check-ins.`)) {
        return;
      }

      try {
        const removed = bookingApi.deleteMember(deleteButton.dataset.deleteMemberId);
        showToast(`Membresía eliminada para ${removed.fullName}.`, "success");
      } catch (error) {
        showToast(error.message, "error");
      }

      return;
    }

    if (!renewButton) {
      return;
    }

    try {
      const renewed = bookingApi.renewMembership(renewButton.dataset.renewMemberId);
      showToast(`Membresía renovada para ${renewed.fullName}.`, "success");
      renderCheckinAlert({
        ...renewed,
        checkInResult: renewed.isActive ? "active" : renewed.isScheduled ? "scheduled" : "expired",
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
          ? `Ingreso validado para ${member.fullName}.`
          : `Atención: ${member.fullName} no tiene una membresía activa.`,
        member.checkInResult === "active" ? "success" : "error"
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
