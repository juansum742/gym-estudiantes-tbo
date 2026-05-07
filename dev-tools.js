(function () {
  const SESSION_KEY = "estudiantes_tbo_dev_tools_session_v1";
  const PIN_HASH = "9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0";
  const loginPanel = document.querySelector("#dev-login-panel");
  const controlsPanel = document.querySelector("#dev-controls-panel");
  const loginForm = document.querySelector("#dev-login-form");
  const loginMessage = document.querySelector("#dev-login-message");
  const campaignForm = document.querySelector("#dev-campaign-form");
  const campaignCard = document.querySelector("#dev-campaign-card");
  const campaignState = document.querySelector("#dev-campaign-state");
  const raffleState = document.querySelector("#dev-raffle-state");
  const campaignToggleLabel = document.querySelector("#dev-campaign-toggle-label");
  const raffleToggleLabel = document.querySelector("#dev-raffle-toggle-label");
  const logoutButton = document.querySelector("#dev-logout");
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
      motherDayCampaignEnabled: data.get("motherDayCampaignEnabled") === "on",
      motherDayRaffleEnabled: data.get("motherDayRaffleEnabled") === "on",
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

    setCheckbox("motherDayCampaignEnabled", config.motherDayCampaignEnabled);
    setCheckbox("motherDayRaffleEnabled", config.motherDayRaffleEnabled);
    updatePanelState(config);
  }

  function updatePanelState(config) {
    const campaignEnabled = Boolean(config.motherDayCampaignEnabled);
    const raffleVisible = Boolean(config.motherDayCampaignEnabled && config.motherDayRaffleEnabled);

    campaignCard?.classList.toggle("is-campaign-active", campaignEnabled);

    if (campaignState) {
      campaignState.textContent = campaignEnabled ? "Campaña activa" : "Campaña desactivada";
      campaignState.classList.toggle("is-active", campaignEnabled);
    }

    if (raffleState) {
      raffleState.textContent = raffleVisible ? "Sorteo visible" : "Sorteo oculto";
      raffleState.classList.toggle("is-active", raffleVisible);
    }

    if (campaignToggleLabel) {
      campaignToggleLabel.textContent = campaignEnabled
        ? "Desactivar modo Día de la Madre"
        : "Activar modo Día de la Madre";
    }

    if (raffleToggleLabel) {
      raffleToggleLabel.textContent = config.motherDayRaffleEnabled
        ? "Ocultar sorteo Día de la Madre"
        : "Mostrar sorteo Día de la Madre";
    }
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
    updatePanelState(config);
  });

  logoutButton?.addEventListener("click", () => {
    setSession(false);
    showLoginState();
  });

  window.addEventListener(campaignApi?.changeEvent || "estudiantes-tbo-campaign:changed", (event) => {
    updatePanelState(event.detail || campaignApi?.getConfig?.() || {});
  });

  if (hasSession()) {
    showAuthenticatedState();
  } else {
    showLoginState();
  }
})();
