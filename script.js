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

function setupScheduleBoard() {
  if (!bookingApi) {
    return;
  }

  const scheduleGrid = document.querySelector("#schedule-grid");
  const scheduleSummary = document.querySelector("#schedule-summary");

  if (!scheduleGrid) {
    return;
  }

  function renderScheduleBoard() {
    const board = bookingApi.getScheduleBoardData();
    const headers = [
      '<div class="schedule-head schedule-head-time">Turno</div>',
      ...board.columns.map((column) => `<div class="schedule-head">${escapeHtml(column.label)}</div>`),
    ];
    const rows = board.rows.flatMap((row) => [
      `<div class="schedule-time">${escapeHtml(row.label)}</div>`,
      ...row.cells.map((cell) => `<div class="${escapeHtml(cell.className)}">${escapeHtml(cell.label)}</div>`),
    ]);

    scheduleGrid.innerHTML = [...headers, ...rows].join("");
    renderScheduleSummary(scheduleSummary);
  }

  window.addEventListener(bookingApi.changeEvent, renderScheduleBoard);
  renderScheduleBoard();
}

const onScroll = () => {
  updateHeaderState();
  updateMediaMotion();
};

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", updateMediaMotion);

setupScheduleBoard();
updateHeaderState();
updateMediaMotion();
