(function () {
  const STORAGE_KEY = "estudiantes_tbo_campaign_controls_v1";
  const CHANGE_EVENT = "estudiantes-tbo-campaign:changed";
  const INTENSITIES = ["soft", "medium", "strong"];
  const DEFAULT_CONFIG = {
    motherDayMode: false,
    showPinkDetails: true,
    showDecorations: true,
    showHeroBadge: true,
    showHeroButton: true,
    decorationIntensity: "soft",
  };

  function readConfig() {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      const storedConfig = storedValue ? JSON.parse(storedValue) : {};
      return normalizeConfig(storedConfig);
    } catch (error) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function normalizeConfig(config) {
    const nextConfig = { ...DEFAULT_CONFIG, ...(config || {}) };

    nextConfig.motherDayMode = Boolean(nextConfig.motherDayMode);
    nextConfig.showPinkDetails = Boolean(nextConfig.showPinkDetails);
    nextConfig.showDecorations = Boolean(nextConfig.showDecorations);
    nextConfig.showHeroBadge = Boolean(nextConfig.showHeroBadge);
    nextConfig.showHeroButton = Boolean(nextConfig.showHeroButton);
    nextConfig.decorationIntensity = INTENSITIES.includes(nextConfig.decorationIntensity)
      ? nextConfig.decorationIntensity
      : DEFAULT_CONFIG.decorationIntensity;

    return nextConfig;
  }

  function saveConfig(partialConfig) {
    const nextConfig = normalizeConfig({ ...readConfig(), ...(partialConfig || {}) });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
    applyConfig(nextConfig);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: nextConfig }));
    return nextConfig;
  }

  function resetConfig() {
    window.localStorage.removeItem(STORAGE_KEY);
    const nextConfig = { ...DEFAULT_CONFIG };
    applyConfig(nextConfig);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: nextConfig }));
    return nextConfig;
  }

  function createAmbientLayer() {
    const layer = document.createElement("div");
    layer.className = "campaign-ambient-layer";
    layer.setAttribute("aria-hidden", "true");

    layer.innerHTML = `
      <span class="campaign-glow campaign-glow-a"></span>
      <span class="campaign-glow campaign-glow-b"></span>
      <span class="campaign-petal campaign-petal-1"></span>
      <span class="campaign-petal campaign-petal-2"></span>
      <span class="campaign-petal campaign-petal-3"></span>
      <span class="campaign-petal campaign-petal-4"></span>
      <span class="campaign-petal campaign-petal-5"></span>
    `;

    document.body.appendChild(layer);
    return layer;
  }

  function ensureHeroBadge() {
    const heroCopy = document.querySelector(".hero-copy");

    if (!heroCopy) {
      return null;
    }

    let badge = heroCopy.querySelector(".campaign-hero-badge");

    if (!badge) {
      badge = document.createElement("a");
      badge.className = "campaign-hero-badge";
      badge.href = "#sorteo-dia-madre";
      badge.textContent = "Especial Día de la Madre · Sorteo para mamás socias";
      const title = heroCopy.querySelector(".hero-title");
      heroCopy.insertBefore(badge, title || heroCopy.firstChild);
    }

    return badge;
  }

  function ensureHeroButton() {
    const actions = document.querySelector(".hero-actions");

    if (!actions) {
      return null;
    }

    let button = actions.querySelector(".campaign-hero-button");

    if (!button) {
      button = document.createElement("a");
      button.className = "btn btn-primary campaign-hero-button";
      button.href = "#sorteo-dia-madre";
      button.textContent = "Ver sorteo";
      actions.insertBefore(button, actions.firstChild);
    }

    return button;
  }

  function removeDynamicElement(selector) {
    document.querySelectorAll(selector).forEach((element) => element.remove());
  }

  function applyConfig(inputConfig) {
    const config = normalizeConfig(inputConfig || readConfig());
    const body = document.body;

    if (!body) {
      return config;
    }

    body.classList.toggle("campaign-mother-day", config.motherDayMode);
    body.classList.toggle("campaign-pink-details", config.motherDayMode && config.showPinkDetails);
    body.classList.toggle("campaign-decorations-enabled", config.motherDayMode && config.showDecorations);
    body.classList.toggle("campaign-hero-badge-enabled", config.motherDayMode && config.showHeroBadge);
    body.classList.toggle("campaign-hero-button-enabled", config.motherDayMode && config.showHeroButton);
    body.dataset.campaignIntensity = config.decorationIntensity;

    if (config.motherDayMode && config.showDecorations) {
      if (!document.querySelector(".campaign-ambient-layer")) {
        createAmbientLayer();
      }
    } else {
      removeDynamicElement(".campaign-ambient-layer");
    }

    if (config.motherDayMode && config.showHeroBadge) {
      ensureHeroBadge();
    } else {
      removeDynamicElement(".campaign-hero-badge");
    }

    if (config.motherDayMode && config.showHeroButton) {
      ensureHeroButton();
    } else {
      removeDynamicElement(".campaign-hero-button");
    }

    return config;
  }

  function initCampaignControls() {
    applyConfig(readConfig());
  }

  window.EstudiantesTboCampaign = {
    storageKey: STORAGE_KEY,
    changeEvent: CHANGE_EVENT,
    defaults: { ...DEFAULT_CONFIG },
    getConfig: readConfig,
    saveConfig,
    resetConfig,
    applyConfig,
  };

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      applyConfig(readConfig());
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCampaignControls);
  } else {
    initCampaignControls();
  }
})();
