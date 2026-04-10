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

if (bookingApi) {
  const gateSection = document.querySelector("#admin-gate-section");
  const dashboard = document.querySelector("#admin-dashboard");
  const loginForm = document.querySelector("#admin-login-form");
  const loginButton = document.querySelector("#admin-login-button");
  const pinInput = document.querySelector("#admin-pin");
  const gateNote = document.querySelector("#admin-gate-note");

  const statTotalSchedules = document.querySelector("#stat-total-schedules");
  const statDisciplines = document.querySelector("#stat-disciplines");
  const statDays = document.querySelector("#stat-days");
  const statSlots = document.querySelector("#stat-slots");

  const scheduleForm = document.querySelector("#admin-schedule-form");
  const scheduleIdInput = document.querySelector("#admin-schedule-id");
  const disciplineSelect = document.querySelector("#admin-discipline");
  const weekdaySelect = document.querySelector("#admin-weekday");
  const slotSelect = document.querySelector("#admin-slot");
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
  const scheduleListState = {
    query: "",
    filter: "all",
  };

  function setFeedback(element, tone, message) {
    element.className = `booking-feedback booking-feedback-${tone}`;
    element.textContent = message;
  }

  function unlockDashboard() {
    gateSection.classList.add("is-hidden");
    dashboard.classList.remove("is-hidden");
    isDashboardUnlocked = true;
    renderDashboard();
  }

  function populateScheduleFields() {
    disciplineSelect.innerHTML = bookingApi
      .getDisciplines()
      .map(
        (discipline) =>
          `<option value="${escapeHtml(discipline.key)}">${escapeHtml(discipline.label)}</option>`
      )
      .join("");

    weekdaySelect.innerHTML = bookingApi.weekdays
      .map(
        (weekday) =>
          `<option value="${escapeHtml(weekday.key)}">${escapeHtml(weekday.label)}</option>`
      )
      .join("");

    slotSelect.innerHTML = bookingApi.timeSlots
      .map(
        (slot) =>
          `<option value="${escapeHtml(slot.key)}">${escapeHtml(slot.label)}</option>`
      )
      .join("");
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
    animateValue(statSlots, stats.baseSlots);
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
                <span class="admin-class-pill accent-neutral">${escapeHtml(schedule.weekdayLabel)}</span>
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
      "Cargá o editá una franja semanal para actualizar automáticamente la grilla azul del home."
    );
  }

  function startEditSchedule(scheduleId) {
    const schedule = bookingApi.getScheduleById(scheduleId);

    if (!schedule) {
      showToast("No encontramos ese horario para editar.", "error");
      return;
    }

    scheduleIdInput.value = schedule.id;
    disciplineSelect.value = schedule.disciplineKey;
    weekdaySelect.value = schedule.weekdayKey;
    slotSelect.value = schedule.slotKey;
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

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    toggleButtonLoading(loginButton, true);
    gateNote.textContent = "Validando acceso al panel...";

    try {
      await wait(280);

      if (pinInput.value.trim() !== bookingApi.adminPin) {
        throw new Error("PIN incorrecto. Verificá el acceso del panel.");
      }

      unlockDashboard();
      gateNote.textContent = "Acceso habilitado.";
      pinInput.value = "";
    } catch (error) {
      gateNote.textContent = error.message;
    } finally {
      toggleButtonLoading(loginButton, false);
    }
  });

  scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    toggleButtonLoading(scheduleButton, true);
    setFeedback(adminFormFeedback, "loading", "Guardando horario en la agenda...");

    try {
      await wait(240);

      const payload = {
        disciplineKey: disciplineSelect.value,
        weekdayKey: weekdaySelect.value,
        slotKey: slotSelect.value,
      };

      const isEditing = Boolean(scheduleIdInput.value);
      const schedule = isEditing
        ? bookingApi.updateSchedule(scheduleIdInput.value, payload)
        : bookingApi.createSchedule(payload);

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

  scheduleDeleteConfirm.addEventListener("click", () => {
    if (!pendingDeleteId) {
      closeScheduleDeleteModal();
      return;
    }

    try {
      bookingApi.deleteSchedule(pendingDeleteId);
      renderDashboard();
      resetScheduleForm();
      closeScheduleDeleteModal();
      showToast("Horario eliminado correctamente.", "success");
    } catch (error) {
      closeScheduleDeleteModal();
      showToast(error.message, "error");
    }
  });

  window.addEventListener(bookingApi.changeEvent, () => {
    if (!isDashboardUnlocked) {
      return;
    }

    renderDashboard();
  });
}
