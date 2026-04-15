const bookingApi = window.EstudiantesTboBooking;

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function animateValue(element, target) {
  const previous = Number(element.dataset.adminValue || 0);
  const duration = 650;
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

function toggleButtonLoading(button, isLoading) {
  if (!button) {
    return;
  }

  button.classList.toggle("is-loading", isLoading);
  button.disabled = isLoading;
}

function bindPasswordPeekButtons(root = document) {
  root.querySelectorAll("[data-password-peek]").forEach((button) => {
    if (button.dataset.peekBound === "true") {
      return;
    }

    const targetId = String(button.dataset.passwordTarget || "").trim();
    const input = targetId ? document.getElementById(targetId) : null;

    if (!input) {
      return;
    }

    const hide = () => {
      if (input.type !== "password") {
        input.type = "password";
      }

      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    };

    const show = () => {
      if (input.disabled) {
        return;
      }

      input.type = "text";
      button.classList.add("is-active");
      button.setAttribute("aria-pressed", "true");
    };

    button.__hidePasswordPeek = hide;
    button.setAttribute("aria-pressed", "false");

    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      event.preventDefault();
      show();

      if (typeof button.setPointerCapture === "function") {
        try {
          button.setPointerCapture(event.pointerId);
        } catch (error) {
          // Algunos navegadores pueden rechazar el capture; no rompemos la UX.
        }
      }
    });

    button.addEventListener("pointerup", hide);
    button.addEventListener("pointercancel", hide);
    button.addEventListener("lostpointercapture", hide);
    button.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") {
        hide();
      }
    });
    button.addEventListener("blur", hide);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
    button.addEventListener("keydown", (event) => {
      if (event.key !== " " && event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      show();
    });
    button.addEventListener("keyup", (event) => {
      if (event.key === " " || event.key === "Enter") {
        hide();
      }
    });

    button.dataset.peekBound = "true";
  });
}

function hidePasswordPeekButtons(root = document) {
  root.querySelectorAll("[data-password-peek]").forEach((button) => {
    if (typeof button.__hidePasswordPeek === "function") {
      button.__hidePasswordPeek();
    }
  });
}

bindPasswordPeekButtons();

if (bookingApi) {
  const gateSection = document.querySelector("#admin-gate-section");
  const dashboard = document.querySelector("#admin-dashboard");
  const securitySection = document.querySelector("#admin-security-section");
  const securityAuthView = document.querySelector("#admin-security-auth-view");
  const securityRecoveryView = document.querySelector("#admin-security-recovery-view");
  const loginForm = document.querySelector("#admin-login-form");
  const loginButton = document.querySelector("#admin-login-button");
  const securityButton = document.querySelector("#admin-security-button");
  const logoutButton = document.querySelector("#admin-logout-button");
  const securityBackButton = document.querySelector("#admin-security-back");
  const recoveryOpenButton = document.querySelector("#admin-recovery-open");
  const recoveryBackButton = document.querySelector("#admin-recovery-back-button");
  const pinInput = document.querySelector("#admin-pin");
  const gateNote = document.querySelector("#admin-gate-note");
  const passwordForm = document.querySelector("#admin-password-form");
  const passwordCurrentInput = document.querySelector("#admin-password-current");
  const passwordNextInput = document.querySelector("#admin-password-next");
  const passwordRepeatInput = document.querySelector("#admin-password-repeat");
  const passwordButton = document.querySelector("#admin-password-button");
  const passwordFeedback = document.querySelector("#admin-password-feedback");
  const securityStatusCard = document.querySelector("#admin-security-status-card");
  const securityStatusTitle = document.querySelector("#admin-security-status-title");
  const securityStatusCopy = document.querySelector("#admin-security-status-copy");
  const securityQuestionsForm = document.querySelector("#admin-security-questions-form");
  const securityAnswerFirstPet = document.querySelector("#security-answer-first-pet");
  const securityAnswerBirthCity = document.querySelector("#security-answer-birth-city");
  const securityAnswerPrimarySchool = document.querySelector("#security-answer-primary-school");
  const securityQuestionsCurrentPassword = document.querySelector("#security-questions-current-password");
  const securityQuestionsButton = document.querySelector("#admin-security-questions-button");
  const securityClearButton = document.querySelector("#admin-security-clear-button");
  const securityQuestionsFeedback = document.querySelector("#admin-security-questions-feedback");
  const recoveryStatusCopy = document.querySelector("#admin-recovery-status-copy");
  const recoveryForm = document.querySelector("#admin-recovery-form");
  const recoveryAnswerFirstPet = document.querySelector("#recovery-answer-first-pet");
  const recoveryAnswerBirthCity = document.querySelector("#recovery-answer-birth-city");
  const recoveryAnswerPrimarySchool = document.querySelector("#recovery-answer-primary-school");
  const recoveryVerifyButton = document.querySelector("#admin-recovery-verify-button");
  const recoveryResetForm = document.querySelector("#admin-recovery-reset-form");
  const recoveryNextPassword = document.querySelector("#admin-recovery-next-password");
  const recoveryRepeatPassword = document.querySelector("#admin-recovery-repeat-password");
  const recoveryResetButton = document.querySelector("#admin-recovery-reset-button");
  const recoveryFeedback = document.querySelector("#admin-recovery-feedback");

  const statTotalSchedules = document.querySelector("#stat-total-schedules");
  const statDisciplines = document.querySelector("#stat-disciplines");
  const statDays = document.querySelector("#stat-days");
  const statSlots = document.querySelector("#stat-slots");

  const scheduleForm = document.querySelector("#admin-schedule-form");
  const scheduleIdInput = document.querySelector("#admin-schedule-id");
  const disciplineSelect = document.querySelector("#admin-discipline");
  const disciplineCustomField = document.querySelector("#admin-discipline-custom-field");
  const disciplineCustomInput = document.querySelector("#admin-discipline-custom");
  const disciplineSuggestionList = document.querySelector("#admin-discipline-suggestions");
  const weekdaySelect = document.querySelector("#admin-weekday");
  const slotSelect = document.querySelector("#admin-slot");
  const slotCustomField = document.querySelector("#admin-slot-custom-field");
  const slotCustomInput = document.querySelector("#admin-slot-custom");
  const slotSuggestionList = document.querySelector("#admin-slot-suggestions");
  const scheduleButton = document.querySelector("#admin-schedule-button");
  const cancelEditButton = document.querySelector("#admin-cancel-edit");
  const adminFormFeedback = document.querySelector("#admin-form-feedback");

  const scheduleCounter = document.querySelector("#admin-schedules-counter");
  const scheduleSearch = document.querySelector("#schedule-search");
  const scheduleFilterTabs = document.querySelector("#schedule-filter-tabs");
  const schedulesList = document.querySelector("#admin-schedules-list");
  const disciplineSummary = document.querySelector("#admin-discipline-summary");

  const scheduleDeleteModal = document.querySelector("#schedule-delete-modal");
  const scheduleDeleteModalCopy = document.querySelector("#schedule-delete-modal-copy");
  const scheduleDeleteConfirm = document.querySelector("#schedule-delete-confirm");

  let pendingDeleteId = "";
  let isDashboardUnlocked = false;
  let activeView = "gate";
  let recoveryVerified = false;
  let securityStatus = {
    configured: false,
    questions: [],
  };
  const scheduleListState = {
    query: "",
    filter: "all",
  };

  function setFeedback(element, tone, message) {
    element.className = `booking-feedback booking-feedback-${tone}`;
    element.textContent = message;
  }

  function setSectionVisibility(section, shouldShow) {
    if (!section) {
      return;
    }

    section.classList.toggle("is-hidden", !shouldShow);
  }

  function focusRecoveryAnswers() {
    window.setTimeout(() => {
      recoveryForm?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
      recoveryAnswerFirstPet?.focus({ preventScroll: true });
    }, 60);
  }

  function syncView() {
    setSectionVisibility(gateSection, activeView === "gate");
    setSectionVisibility(dashboard, activeView === "dashboard" && isDashboardUnlocked);
    setSectionVisibility(securitySection, activeView === "security-auth" || activeView === "security-recovery");
    setSectionVisibility(securityAuthView, activeView === "security-auth" && isDashboardUnlocked);
    setSectionVisibility(securityRecoveryView, activeView === "security-recovery");

    securityButton?.classList.toggle("is-hidden", !isDashboardUnlocked);
    securityButton?.classList.toggle("is-active", activeView === "security-auth");
    logoutButton?.classList.toggle("is-hidden", !isDashboardUnlocked);

    if (securityBackButton) {
      securityBackButton.textContent = activeView === "security-recovery" ? "Volver al acceso" : "Volver al panel";
    }
  }

  function openDashboardView() {
    if (!isDashboardUnlocked) {
      activeView = "gate";
    } else {
      activeView = "dashboard";
      renderDashboard();
    }

    syncView();
  }

  async function openSecurityView(mode = "auth") {
    activeView = mode === "recovery" ? "security-recovery" : "security-auth";
    syncView();

    if (activeView === "security-auth") {
      await loadSecurityStatus();
      return;
    }

    resetRecoveryForms();
    await loadRecoveryStatus();
  }

  function unlockDashboard() {
    isDashboardUnlocked = true;
    resetPasswordForm();
    resetSecurityQuestionsForm();
    activeView = "dashboard";
    syncView();
    renderDashboard();
  }

  function lockDashboard(message = "Ingresá tu clave para abrir el panel administrativo.") {
    isDashboardUnlocked = false;
    activeView = "gate";
    closeScheduleDeleteModal();
    resetScheduleForm();
    resetPasswordForm();
    resetSecurityQuestionsForm();
    resetRecoveryForms();
    gateNote.textContent = message;
    syncView();
  }

  function setConditionalFieldVisibility(field, input, shouldShow) {
    field.classList.toggle("is-hidden", !shouldShow);
    input.disabled = !shouldShow;
    input.required = shouldShow;

    if (!shouldShow) {
      input.value = "";
    }
  }

  function updateDisciplineMode() {
    setConditionalFieldVisibility(
      disciplineCustomField,
      disciplineCustomInput,
      disciplineSelect.value === bookingApi.customDisciplineValue
    );
  }

  function updateSlotMode() {
    setConditionalFieldVisibility(
      slotCustomField,
      slotCustomInput,
      slotSelect.value === bookingApi.customSlotValue
    );
  }

  function buildDisciplineOptions(selectedValue = "") {
    const disciplines = bookingApi.getDisciplines();
    const baseDisciplines = disciplines.filter((discipline) => !discipline.custom);
    const customDisciplines = disciplines.filter((discipline) => discipline.custom);
    const allValues = new Set(disciplines.map((discipline) => discipline.key));

    if (disciplineSuggestionList) {
      disciplineSuggestionList.innerHTML = disciplines
        .map((discipline) => `<option value="${escapeHtml(discipline.label)}"></option>`)
        .join("");
    }

    disciplineSelect.innerHTML = `
      <optgroup label="Disciplinas del club">
        ${baseDisciplines.map((discipline) => `<option value="${escapeHtml(discipline.key)}">${escapeHtml(discipline.label)}</option>`).join("")}
      </optgroup>
      ${customDisciplines.length ? `
      <optgroup label="Disciplinas personalizadas">
        ${customDisciplines.map((discipline) => `<option value="${escapeHtml(discipline.key)}">${escapeHtml(discipline.label)}</option>`).join("")}
      </optgroup>` : ""}
      <option value="${escapeHtml(bookingApi.customDisciplineValue)}">Agregar nueva disciplina</option>
    `;

    disciplineSelect.value = allValues.has(selectedValue) ? selectedValue : baseDisciplines[0]?.key || bookingApi.customDisciplineValue;
    updateDisciplineMode();
  }

  function buildSlotOptions(selectedValue = "") {
    const slots = bookingApi.getTimeSlots();
    const baseSlots = slots.filter((slot) => !slot.custom);
    const customSlots = slots.filter((slot) => slot.custom);
    const allValues = new Set(slots.map((slot) => slot.key));

    if (slotSuggestionList) {
      slotSuggestionList.innerHTML = slots
        .map((slot) => `<option value="${escapeHtml(slot.label)}"></option>`)
        .join("");
    }

    slotSelect.innerHTML = `
      <optgroup label="Franjas base del club">
        ${baseSlots.map((slot) => `<option value="${escapeHtml(slot.key)}">${escapeHtml(slot.label)}</option>`).join("")}
      </optgroup>
      ${customSlots.length ? `
      <optgroup label="Franjas personalizadas">
        ${customSlots.map((slot) => `<option value="${escapeHtml(slot.key)}">${escapeHtml(slot.label)}</option>`).join("")}
      </optgroup>` : ""}
      <option value="${escapeHtml(bookingApi.customSlotValue)}">Otra franja personalizada</option>
    `;

    slotSelect.value = allValues.has(selectedValue) ? selectedValue : baseSlots[0]?.key || bookingApi.customSlotValue;
    updateSlotMode();
  }

  function populateScheduleFields(selected = {}) {
    buildDisciplineOptions(selected.disciplineKey || "");

    weekdaySelect.innerHTML = bookingApi.weekdays
      .map((weekday) => `<option value="${escapeHtml(weekday.key)}">${escapeHtml(weekday.label)}</option>`)
      .join("");

    weekdaySelect.value = selected.weekdayKey || bookingApi.weekdays[0]?.key || "";
    buildSlotOptions(selected.slotKey || "");
  }

  function getFormPayload() {
    const disciplineValue = disciplineSelect.value === bookingApi.customDisciplineValue
      ? disciplineCustomInput.value
      : disciplineSelect.value;
    const slotValue = slotSelect.value === bookingApi.customSlotValue
      ? slotCustomInput.value
      : slotSelect.value;

    return {
      weekdayKey: weekdaySelect.value,
      disciplineValue,
      slotValue,
    };
  }

  function renderFilterTabs() {
    const tabs = [
      { key: "all", label: "Todos" },
      ...bookingApi.getDisciplines().map((discipline) => ({
        key: discipline.key,
        label: discipline.label,
      })),
    ];

    scheduleFilterTabs.innerHTML = tabs
      .map(
        (tab) => `
          <button class="admin-filter-tab${scheduleListState.filter === tab.key ? " is-active" : ""}" type="button" data-schedule-filter="${escapeHtml(tab.key)}">
            ${escapeHtml(tab.label)}
          </button>
        `
      )
      .join("");
  }

  function renderStats() {
    const stats = bookingApi.getStats();
    animateValue(statTotalSchedules, stats.totalSchedules);
    animateValue(statDisciplines, stats.activeDisciplines);
    animateValue(statDays, stats.activeDays);
    animateValue(statSlots, stats.availableSlots);
  }

  function renderDisciplineSummary() {
    const summaries = bookingApi.getDisciplineSummaries();

    disciplineSummary.innerHTML = summaries
      .map(
        (discipline) => `
          <article class="mini-status-card">
            <div class="mini-status-head">
              <div>
                <strong>${escapeHtml(discipline.label)}</strong>
                <p>${escapeHtml(discipline.summaryLabel)}</p>
              </div>
              <span class="admin-class-pill accent-${escapeHtml(discipline.accent)}">${discipline.count.toLocaleString("es-UY")}</span>
            </div>
          </article>
        `
      )
      .join("");
  }

  function getFilteredSchedules() {
    const schedules = bookingApi.getSchedules();
    const normalizedQuery = String(scheduleListState.query || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    return schedules.filter((schedule) => {
      if (scheduleListState.filter !== "all" && schedule.disciplineKey !== scheduleListState.filter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchIndex = [
        schedule.disciplineLabel,
        schedule.weekdayLabel,
        schedule.slotLabel,
      ]
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      return searchIndex.includes(normalizedQuery);
    });
  }

  function renderSchedules() {
    const schedules = getFilteredSchedules();
    scheduleCounter.textContent = `${schedules.length} horario${schedules.length === 1 ? "" : "s"}`;

    if (!schedules.length) {
      schedulesList.innerHTML = `
        <article class="admin-empty-card">
          <strong>Sin horarios para mostrar</strong>
          <p>${scheduleListState.query || scheduleListState.filter !== "all" ? "No encontramos horarios que coincidan con esa búsqueda o filtro." : "Usá el formulario para cargar la agenda semanal del club."}</p>
        </article>
      `;
      return;
    }

    schedulesList.innerHTML = schedules
      .map(
        (schedule) => `
          <article class="admin-schedule-card">
            <div class="admin-schedule-head">
              <div>
                <strong>${escapeHtml(schedule.disciplineLabel)}</strong>
                <span>${escapeHtml(schedule.weekdayLabel)} | ${escapeHtml(schedule.slotLabel)}</span>
              </div>
              <div class="admin-pill-group">
                <span class="admin-class-pill accent-${escapeHtml(schedule.accent)}">${escapeHtml(schedule.disciplineLabel)}</span>
                ${schedule.isCustomDiscipline ? '<span class="admin-class-pill accent-neutral">Personalizada</span>' : ""}
                ${schedule.isCustomSlot ? '<span class="admin-class-pill accent-neutral">Franja personalizada</span>' : ""}
              </div>
            </div>

            <div class="admin-schedule-grid">
              <div>
                <span>Disciplina</span>
                <strong>${escapeHtml(schedule.disciplineLabel)}</strong>
              </div>
              <div>
                <span>Día</span>
                <strong>${escapeHtml(schedule.weekdayLabel)}</strong>
              </div>
              <div>
                <span>Franja</span>
                <strong>${escapeHtml(schedule.slotLabel)}</strong>
              </div>
            </div>

            <div class="admin-card-actions">
              <button class="btn btn-secondary admin-btn" type="button" data-edit-schedule-id="${escapeHtml(schedule.id)}">
                Editar
              </button>
              <button class="btn btn-secondary admin-btn admin-btn-danger" type="button" data-delete-schedule-id="${escapeHtml(schedule.id)}">
                🗑️ Eliminar
              </button>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderDashboard() {
    renderFilterTabs();
    renderStats();
    renderDisciplineSummary();
    renderSchedules();
  }

  function resetScheduleForm() {
    scheduleIdInput.value = "";
    scheduleForm.reset();
    populateScheduleFields();
    cancelEditButton.classList.add("is-hidden");
    scheduleButton.querySelector(".btn-text").textContent = "Guardar horario";
    setFeedback(
      adminFormFeedback,
      "idle",
      "Combiná franjas base, franjas personalizadas, disciplinas del club o nuevas disciplinas para actualizar la grilla azul del home."
    );
  }

  function resetPasswordForm() {
    if (!passwordForm || !passwordFeedback) {
      return;
    }

    passwordForm.reset();
    hidePasswordPeekButtons(passwordForm);
    setFeedback(
      passwordFeedback,
      "idle",
      "Elegí una clave nueva con al menos 7 caracteres que combine letras y números. Al confirmarla, el panel te pedirá ingresar otra vez."
    );
  }

  function resetSecurityQuestionsForm() {
    securityQuestionsForm?.reset();
    hidePasswordPeekButtons(securityQuestionsForm);

    if (!securityQuestionsFeedback) {
      return;
    }

    setFeedback(
      securityQuestionsFeedback,
      "idle",
      "Guardá 3 respuestas privadas para habilitar la recuperación. Se almacenan con hash seguro y nunca vuelven a mostrarse."
    );
  }

  function resetRecoveryForms() {
    recoveryVerified = false;
    recoveryForm?.reset();
    recoveryResetForm?.reset();
    hidePasswordPeekButtons(recoveryForm);
    hidePasswordPeekButtons(recoveryResetForm);
    recoveryForm?.classList.remove("is-hidden");
    recoveryResetForm?.classList.add("is-hidden");

    if (recoveryFeedback) {
      setFeedback(
        recoveryFeedback,
        "idle",
        "La recuperación queda habilitada solo si las 3 respuestas coinciden con las que configuraste previamente."
      );
    }
  }

  function getSecurityAnswersPayload(prefix = "security") {
    const isRecovery = prefix === "recovery";

    return {
      first_pet: isRecovery ? recoveryAnswerFirstPet.value : securityAnswerFirstPet.value,
      birth_city: isRecovery ? recoveryAnswerBirthCity.value : securityAnswerBirthCity.value,
      primary_school: isRecovery ? recoveryAnswerPrimarySchool.value : securityAnswerPrimarySchool.value,
    };
  }

  function renderSecurityStatus(status) {
    securityStatus = status || {
      configured: false,
      questions: [],
    };

    if (!securityStatusCard || !securityStatusTitle || !securityStatusCopy || !securityClearButton) {
      return;
    }

    securityStatusCard.classList.toggle("is-ready", Boolean(securityStatus.configured));
    securityStatusCard.classList.toggle("is-pending", !securityStatus.configured);
    securityStatusTitle.textContent = securityStatus.configured ? "Recuperación activa" : "Recuperación pendiente";
    securityStatusCopy.textContent = securityStatus.configured
      ? "Las 3 preguntas ya están configuradas. Si querés, podés actualizarlas o desactivar la recuperación desde acá."
      : "Todavía no configuraste las preguntas de seguridad. Completalas para habilitar la recuperación segura del panel.";
    securityClearButton.classList.toggle("is-hidden", !securityStatus.configured);
  }

  async function loadSecurityStatus() {
    if (!isDashboardUnlocked) {
      return;
    }

    try {
      const status = await bookingApi.getSecurityStatus();
      renderSecurityStatus(status);
    } catch (error) {
      renderSecurityStatus({ configured: false, questions: [] });
      setFeedback(securityQuestionsFeedback, "error", error.message);
    }
  }

  async function loadRecoveryStatus() {
    try {
      const status = await bookingApi.getRecoveryStatus();
      securityStatus = status;
      const isConfigured = Boolean(status?.configured);

      recoveryStatusCopy.textContent = isConfigured
        ? "Respondé correctamente las 3 preguntas de seguridad para habilitar una nueva contraseña."
        : "Todavía no hay preguntas de seguridad configuradas. Ingresá al panel y cargalas desde la sección Seguridad.";

      recoveryForm.classList.toggle("is-hidden", !isConfigured || recoveryVerified);
      recoveryResetForm.classList.toggle("is-hidden", !recoveryVerified);
      recoveryVerifyButton.disabled = !isConfigured;
      resetRecoveryForms();

      if (!isConfigured) {
        setFeedback(recoveryFeedback, "warning", "La recuperación todavía no está disponible. Primero configurá las preguntas desde Seguridad.");
        recoveryForm.classList.add("is-hidden");
        return;
      }

      focusRecoveryAnswers();
    } catch (error) {
      setFeedback(recoveryFeedback, "error", error.message);
      recoveryForm.classList.add("is-hidden");
      recoveryResetForm.classList.add("is-hidden");
    }
  }

  function startEditSchedule(scheduleId) {
    const schedule = bookingApi.getScheduleById(scheduleId);

    if (!schedule) {
      showToast("No encontramos ese horario para editar.", "error");
      return;
    }

    scheduleIdInput.value = schedule.id;
    populateScheduleFields({
      disciplineKey: schedule.disciplineKey,
      weekdayKey: schedule.weekdayKey,
      slotKey: schedule.slotKey,
    });
    cancelEditButton.classList.remove("is-hidden");
    scheduleButton.querySelector(".btn-text").textContent = "Guardar cambios";
    setFeedback(
      adminFormFeedback,
      "warning",
      `Editando ${schedule.disciplineLabel} del ${schedule.weekdayLabel} a las ${schedule.slotLabel}.`
    );

    window.scrollTo({
      top: scheduleForm.getBoundingClientRect().top + window.scrollY - 120,
      behavior: "smooth",
    });
  }

  function closeScheduleDeleteModal() {
    pendingDeleteId = "";
    scheduleDeleteModal.classList.add("is-hidden");
    scheduleDeleteModal.hidden = true;
    scheduleDeleteModal.setAttribute("aria-hidden", "true");
  }

  function openScheduleDeleteModal(scheduleId) {
    const schedule = bookingApi.getScheduleById(scheduleId);

    if (!schedule) {
      showToast("No encontramos ese horario para eliminar.", "error");
      return;
    }

    pendingDeleteId = schedule.id;
    scheduleDeleteModalCopy.textContent = `Si confirmás, ${schedule.disciplineLabel} del ${schedule.weekdayLabel} en la franja ${schedule.slotLabel} desaparece del panel y de la grilla pública.`;
    scheduleDeleteModal.hidden = false;
    scheduleDeleteModal.classList.remove("is-hidden");
    scheduleDeleteModal.setAttribute("aria-hidden", "false");
    scheduleDeleteConfirm.focus();
  }

  populateScheduleFields();
  resetScheduleForm();
  resetPasswordForm();
  resetSecurityQuestionsForm();
  resetRecoveryForms();
  syncView();

  disciplineSelect.addEventListener("change", updateDisciplineMode);
  slotSelect.addEventListener("change", updateSlotMode);

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    toggleButtonLoading(loginButton, true);
    gateNote.textContent = "Validando acceso seguro...";

    try {
      await wait(280);
      await bookingApi.login(pinInput.value.trim());

      unlockDashboard();
      gateNote.textContent = "Acceso habilitado y protegido por el servidor.";
      pinInput.value = "";
    } catch (error) {
      gateNote.textContent = error.message;
    } finally {
      toggleButtonLoading(loginButton, false);
    }
  });

  recoveryOpenButton?.addEventListener("click", async () => {
    await openSecurityView("recovery");
  });

  securityButton?.addEventListener("click", async () => {
    await openSecurityView("auth");
  });

  securityBackButton?.addEventListener("click", () => {
    if (activeView === "security-recovery") {
      activeView = "gate";
      syncView();
      return;
    }

    openDashboardView();
  });

  recoveryBackButton?.addEventListener("click", () => {
    activeView = "gate";
    syncView();
  });

  scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    toggleButtonLoading(scheduleButton, true);
    setFeedback(adminFormFeedback, "loading", "Guardando horario en la agenda...");

    try {
      await wait(240);

      const payload = getFormPayload();
      const isEditing = Boolean(scheduleIdInput.value);
      const schedule = isEditing
        ? await bookingApi.updateSchedule(scheduleIdInput.value, payload)
        : await bookingApi.createSchedule(payload);

      renderDashboard();
      resetScheduleForm();
      setFeedback(
        adminFormFeedback,
        "success",
        `${schedule.disciplineLabel} quedó ${isEditing ? "actualizado" : "cargado"} para ${schedule.weekdayLabel} en ${schedule.slotLabel}.`
      );
      showToast(`Horario ${isEditing ? "actualizado" : "guardado"} correctamente.`, "success");
    } catch (error) {
      setFeedback(adminFormFeedback, "error", error.message);
      showToast(error.message, "error");
    } finally {
      toggleButtonLoading(scheduleButton, false);
    }
  });

  passwordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    toggleButtonLoading(passwordButton, true);
    setFeedback(passwordFeedback, "loading", "Actualizando la clave segura del panel...");

    try {
      await wait(220);
      const response = await bookingApi.changePassword({
        currentPassword: passwordCurrentInput.value,
        newPassword: passwordNextInput.value,
        confirmPassword: passwordRepeatInput.value,
      });

      resetPasswordForm();
      lockDashboard(response?.message || "Clave actualizada. Ingresá nuevamente con la nueva contraseña.");
      showToast("Clave actualizada correctamente. Volvé a ingresar.", "success");
      pinInput?.focus();
    } catch (error) {
      setFeedback(passwordFeedback, "error", error.message);
      showToast(error.message, "error");
    } finally {
      toggleButtonLoading(passwordButton, false);
    }
  });

  securityQuestionsForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    toggleButtonLoading(securityQuestionsButton, true);
    securityClearButton.disabled = true;
    setFeedback(securityQuestionsFeedback, "loading", "Guardando preguntas de seguridad...");

    try {
      await wait(220);
      const response = await bookingApi.saveSecurityQuestions({
        currentPassword: securityQuestionsCurrentPassword.value,
        answers: getSecurityAnswersPayload("security"),
      });

      renderSecurityStatus(response);
      resetSecurityQuestionsForm();
      setFeedback(securityQuestionsFeedback, "success", "Las preguntas de seguridad quedaron guardadas correctamente.");
      showToast("Preguntas de seguridad actualizadas.", "success");
    } catch (error) {
      setFeedback(securityQuestionsFeedback, "error", error.message);
      showToast(error.message, "error");
    } finally {
      toggleButtonLoading(securityQuestionsButton, false);
      securityClearButton.disabled = false;
    }
  });

  securityClearButton?.addEventListener("click", async () => {
    securityQuestionsButton.disabled = true;
    securityClearButton.disabled = true;
    setFeedback(securityQuestionsFeedback, "loading", "Desactivando la recuperación segura...");

    try {
      await wait(220);
      const response = await bookingApi.clearSecurityQuestions({
        currentPassword: securityQuestionsCurrentPassword.value,
      });

      renderSecurityStatus(response);
      resetSecurityQuestionsForm();
      setFeedback(securityQuestionsFeedback, "success", "La recuperación por preguntas quedó desactivada.");
      showToast("Recuperación desactivada.", "success");
    } catch (error) {
      setFeedback(securityQuestionsFeedback, "error", error.message);
      showToast(error.message, "error");
    } finally {
      securityQuestionsButton.disabled = false;
      securityClearButton.disabled = !securityStatus.configured;
    }
  });

  recoveryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    toggleButtonLoading(recoveryVerifyButton, true);
    setFeedback(recoveryFeedback, "loading", "Validando respuestas de seguridad...");

    try {
      await wait(220);
      await bookingApi.verifyRecoveryAnswers({
        answers: getSecurityAnswersPayload("recovery"),
      });

      recoveryVerified = true;
      recoveryForm.classList.add("is-hidden");
      recoveryResetForm.classList.remove("is-hidden");
      recoveryStatusCopy.textContent = "Respuestas validadas. Definí una nueva contraseña para recuperar el acceso.";
      setFeedback(recoveryFeedback, "success", "Respuestas verificadas. Ahora definí una nueva clave.");
      window.setTimeout(() => {
        recoveryResetForm?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
        recoveryNextPassword?.focus({ preventScroll: true });
      }, 60);
      showToast("Respuestas verificadas.", "success");
    } catch (error) {
      setFeedback(recoveryFeedback, "error", error.message);
      showToast(error.message, "error");
    } finally {
      toggleButtonLoading(recoveryVerifyButton, false);
    }
  });

  recoveryResetForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    toggleButtonLoading(recoveryResetButton, true);
    setFeedback(recoveryFeedback, "loading", "Guardando la nueva clave...");

    try {
      await wait(220);
      const response = await bookingApi.resetPasswordWithRecovery({
        newPassword: recoveryNextPassword.value,
        confirmPassword: recoveryRepeatPassword.value,
      });

      resetRecoveryForms();
      lockDashboard(response?.message || "Acceso recuperado. Ingresá con tu nueva clave.");
      showToast("Acceso recuperado correctamente.", "success");
      pinInput?.focus();
    } catch (error) {
      setFeedback(recoveryFeedback, "error", error.message);
      showToast(error.message, "error");
    } finally {
      toggleButtonLoading(recoveryResetButton, false);
    }
  });

  cancelEditButton.addEventListener("click", () => {
    resetScheduleForm();
  });

  scheduleSearch.addEventListener("input", () => {
    scheduleListState.query = scheduleSearch.value;
    renderSchedules();
  });

  scheduleFilterTabs.addEventListener("click", (event) => {
    const filterButton = event.target.closest("[data-schedule-filter]");

    if (!filterButton) {
      return;
    }

    scheduleListState.filter = filterButton.dataset.scheduleFilter;
    renderDashboard();
  });

  schedulesList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-schedule-id]");
    const deleteButton = event.target.closest("[data-delete-schedule-id]");

    if (editButton) {
      startEditSchedule(editButton.dataset.editScheduleId);
      return;
    }

    if (deleteButton) {
      openScheduleDeleteModal(deleteButton.dataset.deleteScheduleId);
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-close-schedule-modal]")) {
      return;
    }

    closeScheduleDeleteModal();
  });

  scheduleDeleteConfirm.addEventListener("click", async () => {
    if (!pendingDeleteId) {
      closeScheduleDeleteModal();
      return;
    }

    try {
      await bookingApi.deleteSchedule(pendingDeleteId);
      renderDashboard();
      resetScheduleForm();
      closeScheduleDeleteModal();
      showToast("Horario eliminado correctamente.", "success");
    } catch (error) {
      closeScheduleDeleteModal();
      showToast(error.message, "error");
    }
  });

  logoutButton?.addEventListener("click", async () => {
    logoutButton.disabled = true;
    securityButton.disabled = true;

    try {
      await bookingApi.logout();
      lockDashboard("Sesión cerrada correctamente.");
      showToast("Sesión cerrada.", "success");
    } finally {
      logoutButton.disabled = false;
      securityButton.disabled = false;
    }
  });

  window.addEventListener(bookingApi.changeEvent, () => {
    if (!isDashboardUnlocked) {
      return;
    }

    const currentEditingId = scheduleIdInput.value;
    const currentEditingSchedule = currentEditingId ? bookingApi.getScheduleById(currentEditingId) : null;
    renderDashboard();

    if (currentEditingSchedule) {
      populateScheduleFields({
        disciplineKey: currentEditingSchedule.disciplineKey,
        weekdayKey: currentEditingSchedule.weekdayKey,
        slotKey: currentEditingSchedule.slotKey,
      });
    }
  });

  window.addEventListener(bookingApi.authChangeEvent, (event) => {
    if (event.detail?.authenticated) {
      return;
    }

    const reason = String(event.detail?.reason || "");

    if (reason === "logout" || reason === "password-changed" || reason === "password-recovered") {
      return;
    }

    if (isDashboardUnlocked || activeView === "security-auth") {
      lockDashboard("La sesión del panel venció. Ingresá nuevamente.");
      showToast("Tu sesión venció. Volvé a ingresar.", "error");
    }
  });

  if (bookingApi.ready && typeof bookingApi.ready.then === "function") {
    bookingApi.ready
      .then(async () => {
        populateScheduleFields();

        try {
          const restored = await bookingApi.restoreSession();

          if (restored) {
            unlockDashboard();
            gateNote.textContent = "Sesión restaurada correctamente.";
            return;
          }
        } catch (error) {
          // Si no hay cookie válida o la sesión expiró, dejamos el login visible.
        }

        lockDashboard("Ingresá tu clave para abrir el panel administrativo.");
      })
      .catch(() => {
        lockDashboard("No pudimos conectar con el panel seguro. Verificá la API.");
      });
  }
}
