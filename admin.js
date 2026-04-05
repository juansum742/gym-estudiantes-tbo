const bookingApi = window.EstudiantesTboBooking;
const SESSION_KEY = "estudiantes-tbo-admin-session";

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
  const statDay = document.querySelector("#stat-day");
  const statWeek = document.querySelector("#stat-week");
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

  function unlockDashboard() {
    gateSection.classList.add("is-hidden");
    dashboard.classList.remove("is-hidden");
    renderDashboard();
  }

  function setFormFeedback(tone, message) {
    adminFormFeedback.className = `booking-feedback booking-feedback-${tone}`;
    adminFormFeedback.textContent = message;
  }

  function populateClassOptions() {
    adminClass.innerHTML = Object.entries(bookingApi.classTypes)
      .map(([key, value]) => `<option value="${key}">${escapeHtml(value.label)}</option>`)
      .join("");
  }

  function syncDateField() {
    const today = new Date();
    const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    adminDate.min = minDate;
    adminDate.value ||= minDate;
  }

  function renderStats() {
    const stats = bookingApi.getStats();
    animateValue(statDay, stats.reservationsToday);
    animateValue(statWeek, stats.reservationsWeek);
    animateValue(statSpots, stats.freeSpots);
    statTopClass.textContent = stats.topClass;
    statTopClassCount.textContent = `${stats.topClassCount} reserva${stats.topClassCount === 1 ? "" : "s"}`;
  }

  function renderReservations() {
    const reservations = bookingApi.getReservations();
    listCounter.textContent = `${reservations.length} reserva${reservations.length === 1 ? "" : "s"}`;

    if (!reservations.length) {
      reservationsList.innerHTML = `
        <article class="admin-empty-card">
          <strong>No hay reservas activas</strong>
          <p>Cuando alguien reserve desde la home, vas a verlo inmediatamente acá.</p>
        </article>
      `;
      return;
    }

    reservationsList.innerHTML = reservations
      .map((reservation) => {
        const meta = bookingApi.classTypes[reservation.classType];
        const phoneLink = reservation.phone.replace(/\s+/g, "");

        return `
          <article class="admin-reservation-card">
            <div class="admin-reservation-head">
              <div>
                <strong>${escapeHtml(reservation.name)}</strong>
                <span>${escapeHtml(reservation.phone)}</span>
              </div>
              <span class="admin-class-pill accent-${meta.accent}">${escapeHtml(reservation.classLabel)}</span>
            </div>

            <div class="admin-reservation-grid">
              <div>
                <span>Fecha</span>
                <strong>${escapeHtml(bookingApi.formatDateLabel(reservation.date))}</strong>
              </div>
              <div>
                <span>Hora</span>
                <strong>${escapeHtml(reservation.time)}</strong>
              </div>
              <div>
                <span>Teléfono directo</span>
                <a href="tel:${escapeHtml(phoneLink)}">${escapeHtml(reservation.phone)}</a>
              </div>
            </div>

            <button class="btn btn-secondary admin-btn admin-cancel-button" type="button" data-reservation-id="${reservation.id}">
              Cancelar reserva
            </button>
          </article>
        `;
      })
      .join("");
  }

  function renderDashboard() {
    renderStats();
    renderReservations();
  }

  reservationsList.addEventListener("click", (event) => {
    const cancelButton = event.target.closest("[data-reservation-id]");

    if (!cancelButton) {
      return;
    }

    bookingApi.cancelReservation(cancelButton.dataset.reservationId);
    showToast("Reserva cancelada y cupo liberado.", "success");
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
    setFormFeedback("loading", "Creando horario premium...");

    try {
      await wait(620);

      bookingApi.addSchedule({
        date: adminDate.value,
        time: adminTime.value,
        classType: adminClass.value,
        capacity: Number(adminCapacity.value),
      });

      setFormFeedback("success", "Horario agregado. Ya está disponible en la home y en este panel.");
      showToast("Nuevo horario agregado con éxito.", "success");
      scheduleForm.reset();
      syncDateField();
      adminCapacity.value = bookingApi.classTypes[adminClass.value || "funcional"].capacity;
    } catch (error) {
      setFormFeedback("error", error.message);
      showToast(error.message, "error");
    } finally {
      scheduleButton.classList.remove("is-loading");
      scheduleButton.disabled = false;
    }
  });

  adminClass.addEventListener("change", () => {
    const classMeta = bookingApi.classTypes[adminClass.value];
    adminCapacity.value = classMeta.capacity;
  });

  window.addEventListener(bookingApi.changeEvent, () => {
    if (!dashboard.classList.contains("is-hidden")) {
      renderDashboard();
    }
  });

  populateClassOptions();
  syncDateField();
  adminCapacity.value = bookingApi.classTypes[adminClass.value || "funcional"].capacity;

  if (sessionStorage.getItem(SESSION_KEY) === "true") {
    unlockDashboard();
  }
}
