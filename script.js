const body = document.body;
const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const revealItems = document.querySelectorAll("[data-reveal]");
const counters = document.querySelectorAll(".counter");
const zoomItems = document.querySelectorAll("[data-zoom]");
const bookingApi = window.EstudiantesTboBooking;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function configureAdminLinks() {
  const adminUrl = String(window.__ESTUDIANTES_ADMIN_URL__ || "").trim();

  if (!adminUrl) {
    return;
  }

  document.querySelectorAll("[data-admin-entry]").forEach((link) => {
    link.setAttribute("href", adminUrl);
  });
}

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

      animateCounter(
        entry.target,
        Number(entry.target.dataset.counter || 0),
        entry.target.dataset.suffix || ""
      );
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

function renderScheduleSummary(summaryElement) {
  if (!bookingApi || !summaryElement) {
    return;
  }

  const stats = bookingApi.getStats();

  summaryElement.innerHTML = `
    <article class="booking-summary-card">
      <span>Horarios cargados</span>
      <strong>${stats.totalSchedules.toLocaleString("es-UY")}</strong>
    </article>
    <article class="booking-summary-card">
      <span>Disciplinas activas</span>
      <strong>${stats.activeDisciplines.toLocaleString("es-UY")}</strong>
    </article>
    <article class="booking-summary-card">
      <span>Días con clases</span>
      <strong>${stats.activeDays.toLocaleString("es-UY")}</strong>
    </article>
  `;
}

function renderScheduleCellContent(cell) {
  const items = Array.isArray(cell?.items) ? cell.items : [];

  if (items.length > 1) {
    return `
      <div class="schedule-slot-list" aria-label="${items.length} disciplinas en esta franja">
        ${items
          .map(
            (item) => `
              <span class="schedule-slot-pill accent-${escapeHtml(item.accent)}">${escapeHtml(item.label)}</span>
            `
          )
          .join("")}
      </div>
    `;
  }

  return escapeHtml(cell?.label || "Libre");
}

function getTodayWeekdayKey() {
  const weekdayKeys = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  return weekdayKeys[new Date().getDay()] || "";
}

function renderDisciplineRoster(rosterElement) {
  if (!bookingApi || !rosterElement) {
    return;
  }

  const disciplines = bookingApi.getDisciplineSummaries({ activeOnly: true });

  if (!disciplines.length) {
    rosterElement.innerHTML = `
      <article class="discipline-roster-card discipline-roster-card-empty">
        <strong>Sin disciplinas cargadas todavía</strong>
        <p>La agenda pública se actualiza automáticamente cuando el club suma nuevos horarios desde administración.</p>
      </article>
    `;
    return;
  }

  rosterElement.innerHTML = disciplines
    .map(
      (discipline) => `
        <article class="discipline-roster-card">
          <div class="discipline-roster-card-head">
            <div>
              <strong>${escapeHtml(discipline.label)}</strong>
              <p>${escapeHtml(discipline.summaryLabel)}</p>
            </div>
            <div class="discipline-roster-badges">
              <span class="discipline-roster-pill accent-${escapeHtml(discipline.accent)}">${discipline.count.toLocaleString("es-UY")} horario${discipline.count === 1 ? "" : "s"}</span>
              ${discipline.custom ? '<span class="discipline-roster-pill accent-neutral">Personalizada</span>' : ""}
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function setupScheduleBoard() {
  if (!bookingApi) {
    return;
  }

  const scheduleGrid = document.querySelector("#schedule-grid");
  const scheduleMobile = document.querySelector("#schedule-mobile");
  const scheduleMobileTabs = document.querySelector("#schedule-mobile-tabs");
  const scheduleMobilePanel = document.querySelector("#schedule-mobile-panel");
  const scheduleSummary = document.querySelector("#schedule-summary");
  const disciplineRoster = document.querySelector("#discipline-roster");
  let activeMobileDay = "";

  if (!scheduleGrid && !scheduleMobile && !disciplineRoster) {
    return;
  }

  function resolveMobileDay(board) {
    if (!board?.columns?.length) {
      return "";
    }

    const availableKeys = board.columns.map((column) => column.key);

    if (availableKeys.includes(activeMobileDay)) {
      return activeMobileDay;
    }

    const todayKey = getTodayWeekdayKey();

    if (availableKeys.includes(todayKey)) {
      return todayKey;
    }

    return availableKeys[0];
  }

  function getMobileDayEntries(board, dayKey) {
    const columnIndex = board.columns.findIndex((column) => column.key === dayKey);

    if (columnIndex < 0) {
      return [];
    }

    return board.rows
      .map((row) => ({
        slotLabel: row.label,
        cell: row.cells[columnIndex],
      }))
      .filter((entry) => Array.isArray(entry.cell?.items) && entry.cell.items.length);
  }

  function renderMobileSchedule(board) {
    if (!scheduleMobile || !scheduleMobileTabs || !scheduleMobilePanel) {
      return;
    }

    if (!board?.columns?.length || !board?.rows?.length) {
      scheduleMobileTabs.innerHTML = "";
      scheduleMobilePanel.innerHTML = `
        <article class="schedule-mobile-empty">
          <strong>Sin horarios cargados</strong>
          <p>La agenda del club se actualiza automáticamente desde la administración.</p>
        </article>
      `;
      return;
    }

    activeMobileDay = resolveMobileDay(board);
    const selectedColumn = board.columns.find((column) => column.key === activeMobileDay) || board.columns[0];
    const selectedEntries = getMobileDayEntries(board, selectedColumn.key);

    scheduleMobileTabs.innerHTML = board.columns
      .map((column) => {
        const entries = getMobileDayEntries(board, column.key);
        const count = entries.reduce((total, entry) => total + entry.cell.items.length, 0);
        const isActive = column.key === selectedColumn.key;
        return `
          <button
            class="schedule-mobile-tab${isActive ? " is-active" : ""}"
            type="button"
            role="tab"
            aria-selected="${isActive ? "true" : "false"}"
            aria-controls="schedule-mobile-panel"
            data-schedule-day="${escapeHtml(column.key)}"
          >
            <span>${escapeHtml(column.label)}</span>
            <small>${count.toLocaleString("es-UY")} clase${count === 1 ? "" : "s"}</small>
          </button>
        `;
      })
      .join("");

    if (!selectedEntries.length) {
      scheduleMobilePanel.innerHTML = `
        <div class="schedule-mobile-day-head">
          <div>
            <p class="schedule-mobile-day-kicker">Agenda del día</p>
            <strong>${escapeHtml(selectedColumn.label)}</strong>
          </div>
          <span>Sin clases</span>
        </div>
        <article class="schedule-mobile-empty">
          <strong>Sin clases cargadas para ${escapeHtml(selectedColumn.label.toLowerCase())}</strong>
          <p>Probá con otro día o consultanos por WhatsApp para conocer nuevas franjas y disciplinas.</p>
        </article>
      `;
      return;
    }

    scheduleMobilePanel.innerHTML = `
      <div class="schedule-mobile-day-head">
        <div>
          <p class="schedule-mobile-day-kicker">Agenda del día</p>
          <strong>${escapeHtml(selectedColumn.label)}</strong>
        </div>
        <span>${selectedEntries.length.toLocaleString("es-UY")} franja${selectedEntries.length === 1 ? "" : "s"}</span>
      </div>

      <div class="schedule-mobile-list">
        ${selectedEntries
          .map((entry) => {
            const items = entry.cell.items;
            const cardAccent = items.length > 1 ? "highlight" : items[0].accent;
            return `
              <article class="schedule-mobile-card accent-${escapeHtml(cardAccent)}">
                <div class="schedule-mobile-card-head">
                  <span class="schedule-mobile-time">${escapeHtml(entry.slotLabel)}</span>
                  <span class="schedule-mobile-count">${items.length.toLocaleString("es-UY")} disciplina${items.length === 1 ? "" : "s"}</span>
                </div>

                <div class="schedule-mobile-discipline-list">
                  ${items
                    .map(
                      (item) => `
                        <div class="schedule-mobile-discipline accent-${escapeHtml(item.accent)}">
                          <span class="schedule-mobile-discipline-dot" aria-hidden="true"></span>
                          <strong>${escapeHtml(item.label)}</strong>
                        </div>
                      `
                    )
                    .join("")}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderScheduleExperience() {
    const board = bookingApi.getScheduleBoardData();

    if (scheduleGrid) {
      const headers = [
        '<div class="schedule-head schedule-head-time">Turno</div>',
        ...board.columns.map((column) => `<div class="schedule-head">${escapeHtml(column.label)}</div>`),
      ];
      const rows = board.rows.flatMap((row) => [
        `<div class="schedule-time">${escapeHtml(row.label)}</div>`,
        ...row.cells.map(
          (cell) => `
            <div class="${escapeHtml(cell.className)}">
              ${renderScheduleCellContent(cell)}
            </div>
          `
        ),
      ]);

      scheduleGrid.innerHTML = [...headers, ...rows].join("");
      renderScheduleSummary(scheduleSummary);
    }

    renderMobileSchedule(board);
    renderDisciplineRoster(disciplineRoster);
  }

  scheduleMobileTabs?.addEventListener("click", (event) => {
    const dayButton = event.target.closest("[data-schedule-day]");

    if (!dayButton) {
      return;
    }

    activeMobileDay = dayButton.dataset.scheduleDay || "";
    renderScheduleExperience();
  });

  window.addEventListener(bookingApi.changeEvent, renderScheduleExperience);
  renderScheduleExperience();

  if (bookingApi.ready && typeof bookingApi.ready.then === "function") {
    bookingApi.ready
      .then(renderScheduleExperience)
      .catch(() => {
        // Si no hay backend disponible, la home sigue usando el cache local.
      });
  }
}

const onScroll = () => {
  updateHeaderState();
  updateMediaMotion();
};

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", updateMediaMotion);

setupScheduleBoard();
configureAdminLinks();
updateHeaderState();
updateMediaMotion();
