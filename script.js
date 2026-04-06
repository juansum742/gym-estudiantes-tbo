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
  const nationalIdInput = document.querySelector("#booking-id");
  const nameInput = document.querySelector("#booking-name");
  const phoneInput = document.querySelector("#booking-phone");
  const feedback = document.querySelector("#booking-feedback");
  const liveList = document.querySelector("#booking-live-list");
  const submitButton = document.querySelector("#booking-submit");
  const summaryClasses = document.querySelector("#summary-classes");
  const summarySpots = document.querySelector("#summary-spots");
  const summaryOccupied = document.querySelector("#summary-occupied");

  const classPlanEntries = Object.entries(bookingApi.membershipPlans).filter(([, plan]) => plan.category === "clases");

  function setFeedback(tone, message) {
    feedback.className = `booking-feedback booking-feedback-${tone}`;
    feedback.textContent = message;
  }

  function syncDateBounds() {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    dateInput.min = todayKey;
    dateInput.value ||= todayKey;
  }

  function syncPhoneValidity() {
    phoneInput.value = bookingApi.sanitizePhoneInput(phoneInput.value);

    try {
      bookingApi.validatePhone(phoneInput.value);
      phoneInput.setCustomValidity("");
      return true;
    } catch (error) {
      phoneInput.setCustomValidity(error.message);
      return false;
    }
  }

  function syncNationalIdValidity() {
    nationalIdInput.value = bookingApi.sanitizeNationalIdInput(nationalIdInput.value);

    try {
      bookingApi.validateNationalId(nationalIdInput.value);
      nationalIdInput.setCustomValidity("");
      return true;
    } catch (error) {
      nationalIdInput.setCustomValidity(error.message);
      return false;
    }
  }

  function bindValidatedField(input, syncValidity) {
    input.addEventListener("input", syncValidity);
    input.addEventListener("blur", syncValidity);
    input.addEventListener("invalid", syncValidity);
  }

  function populateClasses(preferredPlanType) {
    const currentValue = preferredPlanType || classSelect.value;

    classSelect.innerHTML = classPlanEntries
      .map(([planType, planMeta]) => {
        return `<option value="${planType}">${escapeHtml(planMeta.label)}</option>`;
      })
      .join("");

    if (classPlanEntries.some(([planType]) => planType === currentValue)) {
      classSelect.value = currentValue;
    } else if (classPlanEntries[0]) {
      classSelect.value = classPlanEntries[0][0];
    }
  }

  function getPlanSnapshots() {
    const classMembers = bookingApi
      .getMembers({ planCategory: "clases", includeScheduled: true })
      .filter((member) => member.isActive || member.isScheduled);

    return classPlanEntries.map(([planType, planMeta]) => {
      const classMeta = bookingApi.classTypes[planMeta.classType];
      const members = classMembers.filter((member) => member.planType === planType);
      const activeCount = members.filter((member) => member.isActive).length;
      const expiringCount = members.filter((member) => member.isActive && member.daysRemaining <= 7).length;
      const scheduledCount = members.filter((member) => member.isScheduled).length;

      return {
        planType,
        ...planMeta,
        classLabel: classMeta.label,
        priceLabel: bookingApi.formatCurrency(planMeta.price),
        activeCount,
        expiringCount,
        scheduledCount,
      };
    });
  }

  function updateSummaryCards(plans) {
    const activePlans = plans.reduce((total, plan) => total + plan.activeCount, 0);
    const expiringPlans = plans.reduce((total, plan) => total + plan.expiringCount, 0);

    animateValue(summaryClasses, plans.length);
    animateValue(summarySpots, activePlans);
    animateValue(summaryOccupied, expiringPlans);
  }

  function syncSelectionFeedback() {
    const selectedPlan = bookingApi.membershipPlans[classSelect.value];

    if (!selectedPlan || !dateInput.value) {
      setFeedback("idle", "Elegí una disciplina mensual para ver su vigencia y confirmar el alta.");
      return;
    }

    const classMeta = bookingApi.classTypes[selectedPlan.classType];
    const endDate = bookingApi.computePlanEndDate(classSelect.value, dateInput.value);
    const priceLabel = bookingApi.formatCurrency(selectedPlan.price);

    setFeedback(
      "idle",
      `${classMeta.label} mensual | ${priceLabel} | inicia ${bookingApi.formatDateLabel(dateInput.value)} | vence ${bookingApi.formatDateFull(endDate)}.`
    );
  }

  function renderLiveList() {
    const plans = getPlanSnapshots();
    updateSummaryCards(plans);

    if (!plans.length) {
      liveList.innerHTML = `
        <article class="live-slot-empty">
          <strong>Sin planes cargados</strong>
          <p>No hay planes mensuales configurados para clases. Revisá la membresía de clases desde el panel admin.</p>
        </article>
      `;
      return;
    }

    liveList.innerHTML = plans
      .map((plan) => {
        const selected = plan.planType === classSelect.value ? " is-selected" : "";
        const badgeTone = plan.expiringCount > 0 ? "occupied" : plan.activeCount > 0 ? "limited" : "available";
        const badgeLabel = plan.expiringCount > 0
          ? `${plan.expiringCount} por vencer`
          : plan.activeCount > 0
            ? `${plan.activeCount} activos`
            : "Disponible";

        return `
          <button class="live-slot-card status-${badgeTone}${selected}" type="button" data-plan-type="${plan.planType}">
            <div class="live-slot-card-head">
              <span class="live-slot-class">${escapeHtml(plan.classLabel)}</span>
              <span class="slot-badge slot-badge-${badgeTone}">${escapeHtml(badgeLabel)}</span>
            </div>
            <div class="live-slot-card-main">
              <strong>${plan.durationDays} días</strong>
              <span>${escapeHtml(plan.priceLabel)} | código corto automático</span>
            </div>
            <div class="live-slot-card-meta">
              <span>${plan.activeCount} activos</span>
              <span>${plan.scheduledCount} programados</span>
            </div>
          </button>
        `;
      })
      .join("");
  }

  function renderBookingState(preferredPlanType) {
    syncDateBounds();
    populateClasses(preferredPlanType);
    renderLiveList();
    syncSelectionFeedback();
  }

  liveList.addEventListener("click", (event) => {
    const planButton = event.target.closest("[data-plan-type]");

    if (!planButton) {
      return;
    }

    classSelect.value = planButton.dataset.planType;
    renderLiveList();
    syncSelectionFeedback();
  });

  dateInput.addEventListener("change", () => {
    syncSelectionFeedback();
  });

  classSelect.addEventListener("change", () => {
    renderLiveList();
    syncSelectionFeedback();
  });

  bindValidatedField(phoneInput, syncPhoneValidity);
  bindValidatedField(nationalIdInput, syncNationalIdValidity);

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!syncNationalIdValidity()) {
      setFeedback("error", nationalIdInput.validationMessage);
      nationalIdInput.reportValidity();
      return;
    }

    if (!syncPhoneValidity()) {
      setFeedback("error", phoneInput.validationMessage);
      phoneInput.reportValidity();
      return;
    }

    submitButton.classList.add("is-loading");
    submitButton.disabled = true;
    setFeedback("loading", "Activando tu plan mensual...");

    try {
      await wait(780);
      nameInput.value = nameInput.value.trim();

      const member = bookingApi.createMember({
        fullName: nameInput.value,
        nationalId: nationalIdInput.value,
        phone: phoneInput.value,
        planType: classSelect.value,
        startDate: dateInput.value,
      });

      nameInput.value = "";
      nationalIdInput.value = "";
      phoneInput.value = "";
      renderBookingState(member.planType);
      setFeedback(
        "success",
        member.isScheduled
          ? `Plan registrado para ${member.planLabel}. Comienza el ${member.startDateLabel}. Código ${member.accessCode}.`
          : `Plan activo: ${member.planLabel}. Código ${member.accessCode}. Vence el ${member.endDateLabel}.`
      );
      showToast(
        member.isScheduled
          ? "Plan registrado con inicio programado."
          : "Plan mensual activado con éxito.",
        "success"
      );
    } catch (error) {
      setFeedback("error", error.message);
      showToast(error.message, "error");
      renderBookingState(classSelect.value);
    } finally {
      submitButton.classList.remove("is-loading");
      submitButton.disabled = false;
    }
  });

  window.addEventListener(bookingApi.changeEvent, () => {
    renderBookingState(classSelect.value);
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
