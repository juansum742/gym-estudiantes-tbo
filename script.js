const body = document.body;
const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const revealItems = document.querySelectorAll("[data-reveal]");
const counters = document.querySelectorAll(".counter");
const zoomItems = document.querySelectorAll("[data-zoom]");
const bookingApi = window.EstudiantesTboBooking;

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = body.classList.toggle("nav-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      body.classList.remove("nav-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  },
  {
    threshold: 0.18,
    rootMargin: "0px 0px -10% 0px",
  }
);

revealItems.forEach((item) => revealObserver.observe(item));

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.target.dataset.counted === "true") {
        return;
      }

      animateCounter(entry.target, Number(entry.target.dataset.counter || 0), entry.target.dataset.suffix || "");
      counterObserver.unobserve(entry.target);
    });
  },
  {
    threshold: 0.45,
  }
);

counters.forEach((counter) => counterObserver.observe(counter));

function animateCounter(element, target, suffix = "") {
  const duration = 1600;
  const start = performance.now();

  element.dataset.counted = "true";

  const step = (timestamp) => {
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(target * eased);

    element.textContent = `${currentValue.toLocaleString("es-UY")}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
}

function animateValue(element, target) {
  const previous = Number(element.dataset.value || 0);
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
      element.dataset.value = String(target);
    }
  };

  requestAnimationFrame(step);
}

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

const updateMediaMotion = () => {
  zoomItems.forEach((item) => {
    const rect = item.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const distance = rect.top - viewportHeight / 2;
    const ratio = distance / viewportHeight;
    const shift = Math.max(-18, Math.min(18, ratio * -18));
    const scale = Math.max(1.04, Math.min(1.14, 1.08 + ratio * -0.04));

    item.style.setProperty("--scroll-shift", `${shift}px`);
    item.style.setProperty("--scroll-scale", scale.toFixed(3));
  });
};

const updateHeaderState = () => {
  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 20);
};

function setupBookings() {
  if (!bookingApi) {
    return;
  }

  const bookingForm = document.querySelector("#booking-form");

  if (!bookingForm) {
    return;
  }

  const dateInput = document.querySelector("#booking-date");
  const classSelect = document.querySelector("#booking-class");
  const timeSelect = document.querySelector("#booking-time");
  const nameInput = document.querySelector("#booking-name");
  const phoneInput = document.querySelector("#booking-phone");
  const feedback = document.querySelector("#booking-feedback");
  const liveList = document.querySelector("#booking-live-list");
  const submitButton = document.querySelector("#booking-submit");
  const summaryClasses = document.querySelector("#summary-classes");
  const summarySpots = document.querySelector("#summary-spots");
  const summaryOccupied = document.querySelector("#summary-occupied");

  const statusLabel = {
    available: "Disponible",
    limited: "Últimos cupos",
    occupied: "Ocupado",
  };

  function setFeedback(tone, message) {
    feedback.className = `booking-feedback booking-feedback-${tone}`;
    feedback.textContent = message;
  }

  function syncDateBounds() {
    const upcomingDates = bookingApi.getUniqueUpcomingDates();

    if (!upcomingDates.length) {
      dateInput.value = "";
      return;
    }

    dateInput.min = upcomingDates[0];
    dateInput.max = upcomingDates[upcomingDates.length - 1];

    if (!upcomingDates.includes(dateInput.value)) {
      dateInput.value = upcomingDates[0];
    }
  }

  function populateClasses() {
    const currentValue = classSelect.value;
    const schedules = bookingApi.getSchedules({ futureOnly: true });
    const classTypes = [...new Set(schedules.map((schedule) => schedule.classType))];

    classSelect.innerHTML = classTypes
      .map((classType) => {
        const classMeta = bookingApi.classTypes[classType];
        return `<option value="${classType}">${escapeHtml(classMeta.label)}</option>`;
      })
      .join("");

    if (classTypes.includes(currentValue)) {
      classSelect.value = currentValue;
    }
  }

  function getFilteredSchedules() {
    return bookingApi.getSchedules({
      futureOnly: true,
      date: dateInput.value || undefined,
      classType: classSelect.value || undefined,
    });
  }

  function populateTimeOptions(preferredScheduleId) {
    const availableSchedules = bookingApi.getSchedules({
      futureOnly: true,
      date: dateInput.value || undefined,
      classType: classSelect.value || undefined,
      availableOnly: true,
    });

    if (!availableSchedules.length) {
      timeSelect.innerHTML = '<option value="">Sin horarios disponibles</option>';
      timeSelect.disabled = true;
      return;
    }

    timeSelect.disabled = false;
    timeSelect.innerHTML = availableSchedules
      .map((schedule) => {
        const selected = preferredScheduleId === schedule.id ? " selected" : "";
        return `<option value="${schedule.id}"${selected}>${escapeHtml(schedule.time)} | ${escapeHtml(schedule.classLabel)} | ${schedule.remaining} cupos</option>`;
      })
      .join("");

    if (!availableSchedules.some((schedule) => schedule.id === timeSelect.value)) {
      timeSelect.value = preferredScheduleId && availableSchedules.some((schedule) => schedule.id === preferredScheduleId)
        ? preferredScheduleId
        : availableSchedules[0].id;
    }
  }

  function updateSummaryCards(schedules) {
    const classCount = new Set(schedules.map((schedule) => schedule.classType)).size;
    const freeSpots = schedules.reduce((total, schedule) => total + schedule.remaining, 0);
    const occupiedCount = schedules.filter((schedule) => schedule.status === "occupied").length;

    animateValue(summaryClasses, classCount);
    animateValue(summarySpots, freeSpots);
    animateValue(summaryOccupied, occupiedCount);
  }

  function syncSelectionFeedback() {
    const selectedId = timeSelect.value;
    const selectedSchedule = bookingApi
      .getSchedules({ futureOnly: true, date: dateInput.value || undefined, classType: classSelect.value || undefined })
      .find((schedule) => schedule.id === selectedId);

    if (!selectedSchedule) {
      setFeedback("warning", "No quedan cupos para la combinación elegida. Probá otra fecha o clase.");
      return;
    }

    if (selectedSchedule.status === "limited") {
      setFeedback("warning", `Te queda ${selectedSchedule.remaining} cupo${selectedSchedule.remaining === 1 ? "" : "s"} en ${selectedSchedule.classLabel} a las ${selectedSchedule.time}.`);
      return;
    }

    setFeedback("idle", `${selectedSchedule.classLabel} el ${selectedSchedule.dateLabel} a las ${selectedSchedule.time}. Cupos restantes: ${selectedSchedule.remaining}.`);
  }

  function renderLiveList() {
    const schedules = getFilteredSchedules();
    const selectedId = timeSelect.value;

    updateSummaryCards(schedules);

    if (!schedules.length) {
      liveList.innerHTML = `
        <article class="live-slot-empty">
          <strong>Sin turnos en esta combinación</strong>
          <p>No hay bloques cargados para la fecha o clase elegida. Probá otra combinación o agregá horarios desde el panel admin.</p>
        </article>
      `;
      return;
    }

    liveList.innerHTML = schedules
      .map((schedule) => {
        const disabled = schedule.status === "occupied" ? " disabled" : "";
        const selected = schedule.id === selectedId ? " is-selected" : "";

        return `
          <button class="live-slot-card status-${schedule.status}${selected}" type="button" data-schedule-id="${schedule.id}"${disabled}>
            <div class="live-slot-card-head">
              <span class="live-slot-class">${escapeHtml(schedule.classLabel)}</span>
              <span class="slot-badge slot-badge-${schedule.status}">${statusLabel[schedule.status]}</span>
            </div>
            <div class="live-slot-card-main">
              <strong>${escapeHtml(schedule.time)}</strong>
              <span>${escapeHtml(schedule.dateLabel)}</span>
            </div>
            <div class="live-slot-card-meta">
              <span>${schedule.remaining} cupos</span>
              <span>Cap. ${schedule.capacity}</span>
            </div>
          </button>
        `;
      })
      .join("");
  }

  function renderBookingState(preferredScheduleId) {
    syncDateBounds();
    populateClasses();
    populateTimeOptions(preferredScheduleId);
    renderLiveList();
    syncSelectionFeedback();
  }

  liveList.addEventListener("click", (event) => {
    const slotButton = event.target.closest("[data-schedule-id]");

    if (!slotButton || slotButton.disabled) {
      return;
    }

    const slot = bookingApi
      .getSchedules({ futureOnly: true, date: dateInput.value || undefined, classType: classSelect.value || undefined })
      .find((schedule) => schedule.id === slotButton.dataset.scheduleId);

    if (!slot) {
      return;
    }

    dateInput.value = slot.date;
    classSelect.value = slot.classType;
    populateTimeOptions(slot.id);
    timeSelect.value = slot.id;
    renderLiveList();
    syncSelectionFeedback();
  });

  dateInput.addEventListener("change", () => {
    renderBookingState(timeSelect.value);
  });

  classSelect.addEventListener("change", () => {
    renderBookingState(timeSelect.value);
  });

  timeSelect.addEventListener("change", () => {
    renderLiveList();
    syncSelectionFeedback();
  });

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!timeSelect.value) {
      setFeedback("error", "Primero elegí un horario disponible.");
      showToast("No quedan cupos en esa combinación.", "error");
      return;
    }

    submitButton.classList.add("is-loading");
    submitButton.disabled = true;
    setFeedback("loading", "Procesando tu reserva...");

    try {
      await wait(780);

      const reservation = bookingApi.createReservation({
        scheduleId: timeSelect.value,
        name: nameInput.value,
        phone: phoneInput.value,
      });

      nameInput.value = "";
      phoneInput.value = "";
      renderBookingState(reservation.scheduleId);
      setFeedback("success", `Reserva confirmada para ${bookingApi.classTypes[reservation.classType].label} el ${bookingApi.formatDateLabel(reservation.date)} a las ${reservation.time}.`);
      showToast("Reserva confirmada. Tu lugar ya quedó bloqueado.", "success");
    } catch (error) {
      setFeedback("error", error.message);
      showToast(error.message, "error");
      renderBookingState(timeSelect.value);
    } finally {
      submitButton.classList.remove("is-loading");
      submitButton.disabled = false;
    }
  });

  window.addEventListener(bookingApi.changeEvent, () => {
    renderBookingState(timeSelect.value);
  });

  renderBookingState();
}

const onScroll = () => {
  updateHeaderState();
  updateMediaMotion();
};

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", updateMediaMotion);

setupBookings();
updateHeaderState();
updateMediaMotion();
