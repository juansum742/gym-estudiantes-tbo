(function () {
  const SESSION_KEY = "estudiantes_tbo_dev_tools_session_v1";
  const SESSION_PIN_KEY = "estudiantes_tbo_dev_tools_pin_v1";
  const VERIFY_ENDPOINT = "/api/campaign-config/verify";
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
  const campaignMessage = document.querySelector("#dev-campaign-message");
  const logoutButton = document.querySelector("#dev-logout");
  const campaignApi = window.EstudiantesTboCampaign;

  function hasSession() {
    return window.sessionStorage.getItem(SESSION_KEY) === "active" && Boolean(getSessionPin());
  }

  function getSessionPin() {
    return String(window.sessionStorage.getItem(SESSION_PIN_KEY) || "");
  }

  function setSession(active, pin = "") {
    if (active) {
      window.sessionStorage.setItem(SESSION_KEY, "active");
      window.sessionStorage.setItem(SESSION_PIN_KEY, pin);
      return;
    }

    window.sessionStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_PIN_KEY);
  }

  async function verifyPin(pin) {
    const response = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pin }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "No pudimos validar el PIN.");
    }

    return payload;
  }

  async function showAuthenticatedState() {
    loginPanel.hidden = true;
    controlsPanel.hidden = false;
    syncFormFromConfig();

    try {
      const config = await campaignApi?.refreshConfig?.({ silent: false });
      if (config) {
        syncFormFromConfig();
      }
    } catch (error) {
      showCampaignMessage("No pudimos cargar la configuración compartida.", true);
    }
  }

  function showLoginState() {
    loginPanel.hidden = false;
    controlsPanel.hidden = true;
    loginForm?.reset();
  }

  function setControlsBusy(isBusy) {
    Array.from(campaignForm?.elements || []).forEach((element) => {
      element.disabled = Boolean(isBusy);
    });
  }

  function showCampaignMessage(message, isError = false) {
    if (!campaignMessage) {
      return;
    }

    campaignMessage.textContent = message || "";
    campaignMessage.classList.toggle("is-error", Boolean(isError));
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

    const pin = String(new FormData(loginForm).get("pin") || "");

    try {
      await verifyPin(pin);
    } catch (error) {
      loginMessage.textContent = error instanceof Error ? error.message : "PIN incorrecto.";
      loginForm.reset();
      return;
    }

    loginMessage.textContent = "";
    setSession(true, pin);
    await showAuthenticatedState();
  });

  campaignForm?.addEventListener("change", async () => {
    if (!campaignApi) {
      return;
    }

    const optimisticConfig = getFormConfig();
    updatePanelState(optimisticConfig);
    setControlsBusy(true);
    showCampaignMessage("Guardando cambios...");

    try {
      const config = await campaignApi.saveConfig(optimisticConfig, { pin: getSessionPin() });
      syncFormFromConfig();
      updatePanelState(config);
      showCampaignMessage("Configuración guardada para PC y móvil.");
    } catch (error) {
      showCampaignMessage(
        error instanceof Error ? error.message : "No pudimos guardar la configuración.",
        true
      );
      await campaignApi.refreshConfig?.();
      syncFormFromConfig();
    } finally {
      setControlsBusy(false);
    }
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
