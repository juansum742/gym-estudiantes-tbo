(function () {
  const SESSION_KEY = "estudiantes_tbo_dev_tools_session_v1";
  const PIN_HASH = "9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0";
  const loginPanel = document.querySelector("#dev-login-panel");
  const controlsPanel = document.querySelector("#dev-controls-panel");
  const loginForm = document.querySelector("#dev-login-form");
  const loginMessage = document.querySelector("#dev-login-message");
  const campaignForm = document.querySelector("#dev-campaign-form");
  const statusElement = document.querySelector("#dev-status");
  const logoutButton = document.querySelector("#dev-logout");
  const resetButton = document.querySelector("#dev-reset");
  const campaignApi = window.EstudiantesTboCampaign;

  function bytesToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function hashPin(pin) {
    const encodedPin = new TextEncoder().encode(pin);
    const digest = await window.crypto.subtle.digest("SHA-256", encodedPin);
    return bytesToHex(digest);
  }

  function hasSession() {
    return window.sessionStorage.getItem(SESSION_KEY) === "active";
  }

  function setSession(active) {
    if (active) {
      window.sessionStorage.setItem(SESSION_KEY, "active");
      return;
    }

    window.sessionStorage.removeItem(SESSION_KEY);
  }

  function showAuthenticatedState() {
    loginPanel.hidden = true;
    controlsPanel.hidden = false;
    syncFormFromConfig();
  }

  function showLoginState() {
    loginPanel.hidden = false;
    controlsPanel.hidden = true;
    loginForm?.reset();
  }

  function getFormConfig() {
    const data = new FormData(campaignForm);

    return {
      motherDayMode: data.get("motherDayMode") === "on",
      showPinkDetails: data.get("showPinkDetails") === "on",
      showDecorations: data.get("showDecorations") === "on",
      showHeroBadge: data.get("showHeroBadge") === "on",
      showHeroButton: data.get("showHeroButton") === "on",
      decorationIntensity: String(data.get("decorationIntensity") || "soft"),
    };
  }

  function setCheckbox(name, checked) {
    const input = campaignForm?.elements?.[name];

    if (input) {
      input.checked = Boolean(checked);
    }
  }

  function syncFormFromConfig() {
    if (!campaignApi || !campaignForm) {
      return;
    }

    const config = campaignApi.getConfig();

    setCheckbox("motherDayMode", config.motherDayMode);
    setCheckbox("showPinkDetails", config.showPinkDetails);
    setCheckbox("showDecorations", config.showDecorations);
    setCheckbox("showHeroBadge", config.showHeroBadge);
    setCheckbox("showHeroButton", config.showHeroButton);
    campaignForm.elements.decorationIntensity.value = config.decorationIntensity;
    updateStatus(config);
  }

  function updateStatus(config) {
    if (!statusElement) {
      return;
    }

    const intensityLabel = {
      soft: "sutil",
      medium: "media",
      strong: "destacada",
    }[config.decorationIntensity] || "sutil";

    statusElement.textContent = config.motherDayMode
      ? `Modo Día de la Madre activo con intensidad ${intensityLabel}.`
      : "Modo Día de la Madre desactivado.";
  }

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!window.crypto?.subtle) {
      loginMessage.textContent = "Este navegador no permite validar el PIN de forma segura.";
      return;
    }

    const pin = String(new FormData(loginForm).get("pin") || "");
    const pinHash = await hashPin(pin);

    if (pinHash !== PIN_HASH) {
      loginMessage.textContent = "PIN incorrecto.";
      loginForm.reset();
      return;
    }

    loginMessage.textContent = "";
    setSession(true);
    showAuthenticatedState();
  });

  campaignForm?.addEventListener("change", () => {
    if (!campaignApi) {
      return;
    }

    const config = campaignApi.saveConfig(getFormConfig());
    updateStatus(config);
  });

  campaignForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!campaignApi) {
      return;
    }

    const config = campaignApi.saveConfig(getFormConfig());
    updateStatus(config);
  });

  resetButton?.addEventListener("click", () => {
    if (!campaignApi) {
      return;
    }

    const config = campaignApi.resetConfig();
    syncFormFromConfig(config);
  });

  logoutButton?.addEventListener("click", () => {
    setSession(false);
    showLoginState();
  });

  window.addEventListener(campaignApi?.changeEvent || "estudiantes-tbo-campaign:changed", (event) => {
    updateStatus(event.detail || campaignApi?.getConfig?.() || {});
  });

  if (hasSession()) {
    showAuthenticatedState();
  } else {
    showLoginState();
  }
})();
