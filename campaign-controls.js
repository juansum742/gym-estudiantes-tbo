(function () {
  const STORAGE_KEY = "estudiantes_tbo_campaign_controls_v1";
  const CHANGE_EVENT = "estudiantes-tbo-campaign:changed";
  const DEFAULT_CONFIG = {
    motherDayCampaignEnabled: false,
    motherDayRaffleEnabled: false,
  };

  function normalizeConfig(config) {
    const source = config || {};

    return {
      motherDayCampaignEnabled: Boolean(source.motherDayCampaignEnabled ?? DEFAULT_CONFIG.motherDayCampaignEnabled),
      motherDayRaffleEnabled: Boolean(
        source.motherDayRaffleEnabled ?? DEFAULT_CONFIG.motherDayRaffleEnabled
      ),
    };
  }

  function readConfig() {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      return normalizeConfig(storedValue ? JSON.parse(storedValue) : {});
    } catch (error) {
      return { ...DEFAULT_CONFIG };
    }
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

  function shouldShowRaffle(config) {
    return Boolean(config.motherDayCampaignEnabled && config.motherDayRaffleEnabled);
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
      badge = document.createElement("span");
      badge.className = "campaign-hero-badge";
      badge.textContent = "Especial Día de la Madre";
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

  function toggleHidden(selector, hidden) {
    document.querySelectorAll(selector).forEach((element) => {
      element.hidden = hidden;
      element.setAttribute("aria-hidden", String(hidden));
    });
  }

  function applyConfig(inputConfig) {
    const config = normalizeConfig(inputConfig || readConfig());
    const body = document.body;

    if (!body) {
      return config;
    }

    const campaignEnabled = config.motherDayCampaignEnabled;
    const raffleVisible = shouldShowRaffle(config);

    body.classList.toggle("campaign-mother-day", campaignEnabled);
    body.classList.toggle("campaign-pink-details", campaignEnabled);
    body.classList.toggle("campaign-decorations-enabled", campaignEnabled);
    body.dataset.campaignIntensity = campaignEnabled ? "strong" : "off";

    if (campaignEnabled) {
      if (!document.querySelector(".campaign-ambient-layer")) {
        createAmbientLayer();
      }

      ensureHeroBadge();
    } else {
      removeDynamicElement(".campaign-ambient-layer");
      removeDynamicElement(".campaign-hero-badge");
    }

    if (raffleVisible) {
      ensureHeroButton();
    } else {
      removeDynamicElement(".campaign-hero-button");
    }

    toggleHidden("[data-campaign-raffle]", !raffleVisible);
    toggleHidden("[data-campaign-nav-raffle]", !raffleVisible);

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
    shouldShowRaffle,
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
