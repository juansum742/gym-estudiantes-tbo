(function () {
  const STORAGE_KEY = "estudiantes_tbo_campaign_controls_v1";
  const CHANGE_EVENT = "estudiantes-tbo-campaign:changed";
  const API_ENDPOINT = "/api/campaign-config";
  const DEFAULT_CONFIG = {
    motherDayCampaignEnabled: false,
    motherDayRaffleEnabled: false,
  };
  let currentConfig = { ...DEFAULT_CONFIG };

  function normalizeConfig(config) {
    const source = config || {};

    return {
      motherDayCampaignEnabled: Boolean(source.motherDayCampaignEnabled ?? DEFAULT_CONFIG.motherDayCampaignEnabled),
      motherDayRaffleEnabled: Boolean(
        source.motherDayRaffleEnabled ?? DEFAULT_CONFIG.motherDayRaffleEnabled
      ),
    };
  }

  function readLocalConfig() {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      return normalizeConfig(storedValue ? JSON.parse(storedValue) : {});
    } catch (error) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function readConfig() {
    return normalizeConfig(currentConfig);
  }

  function persistLocalConfig(config) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeConfig(config)));
    } catch (error) {
      // El sitio sigue funcionando aunque el navegador bloquee almacenamiento local.
    }
  }

  function dispatchConfigChange(config) {
    const normalizedConfig = normalizeConfig(config);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: normalizedConfig }));
    return normalizedConfig;
  }

  async function refreshConfig({ silent = true } = {}) {
    try {
      const response = await fetch(API_ENDPOINT, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No pudimos cargar la configuración de campaña.");
      }

      currentConfig = normalizeConfig(payload?.config || payload);
      persistLocalConfig(currentConfig);
      applyConfig(currentConfig);
      dispatchConfigChange(currentConfig);
      return readConfig();
    } catch (error) {
      if (!silent) {
        console.warn(error);
      }

      currentConfig = readLocalConfig();
      applyConfig(currentConfig);
      return readConfig();
    }
  }

  async function saveConfig(partialConfig, options = {}) {
    const nextConfig = normalizeConfig({ ...readConfig(), ...(partialConfig || {}) });
    const pin = String(options.pin || "").trim();

    if (pin) {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pin,
          config: nextConfig,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No pudimos guardar la configuración.");
      }

      currentConfig = normalizeConfig(payload?.config || nextConfig);
    } else {
      currentConfig = nextConfig;
    }

    persistLocalConfig(currentConfig);
    applyConfig(currentConfig);
    dispatchConfigChange(currentConfig);
    return readConfig();
  }

  function resetConfig(options = {}) {
    return saveConfig({ ...DEFAULT_CONFIG }, options);
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
    currentConfig = readLocalConfig();
    applyConfig(currentConfig);
    refreshConfig();
  }

  window.EstudiantesTboCampaign = {
    storageKey: STORAGE_KEY,
    changeEvent: CHANGE_EVENT,
    defaults: { ...DEFAULT_CONFIG },
    getConfig: readConfig,
    refreshConfig,
    saveConfig,
    resetConfig,
    applyConfig,
    shouldShowRaffle,
  };

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      currentConfig = readLocalConfig();
      applyConfig(currentConfig);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCampaignControls);
  } else {
    initCampaignControls();
  }
})();
