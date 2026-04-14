(() => {
  const explicitAppBase = "https://estudiantes-tbo-api.juansum742.workers.dev";

  function normalizeBase(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function isLocalHostname(hostname) {
    return hostname === "127.0.0.1" || hostname === "localhost";
  }

  function resolveConfiguredAppBase() {
    if (typeof window === "undefined") {
      return normalizeBase(explicitAppBase);
    }

    const hostname = window.location.hostname;

    if (isLocalHostname(hostname)) {
      return "http://127.0.0.1:8787";
    }

    if (!hostname.endsWith("github.io")) {
      return normalizeBase(window.location.origin);
    }

    return normalizeBase(explicitAppBase);
  }

  function resolveAppUrl(pathname = "/") {
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const appBase = resolveConfiguredAppBase();

    if (!appBase) {
      return normalizedPath;
    }

    return `${appBase}${normalizedPath}`;
  }

  const appBase = resolveConfiguredAppBase();
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const appOrigin = appBase ? new URL(appBase).origin : currentOrigin;
  const isAppOrigin = Boolean(appOrigin) && currentOrigin === appOrigin;
  const apiBase = isAppOrigin ? "" : appBase;

  window.__ESTUDIANTES_APP_BASE__ = appBase;
  window.__ESTUDIANTES_API_BASE__ = apiBase;
  window.__ESTUDIANTES_ADMIN_URL__ = resolveAppUrl("/admin");
  window.__ESTUDIANTES_PUBLIC_URL__ = resolveAppUrl("/");
  window.__ESTUDIANTES_IS_APP_ORIGIN__ = isAppOrigin;
  window.__ESTUDIANTES_RESOLVE_APP_URL__ = resolveAppUrl;
})();
