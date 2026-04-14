(() => {
  if (typeof window === "undefined") {
    return;
  }

  const isGitHubPages = window.location.hostname.endsWith("github.io");
  const adminUrl = String(window.__ESTUDIANTES_ADMIN_URL__ || "").trim();

  if (!isGitHubPages || !adminUrl || window.__ESTUDIANTES_IS_APP_ORIGIN__) {
    return;
  }

  const currentPath = window.location.pathname.replace(/\/+$/, "");

  if (!currentPath.endsWith("/admin.html")) {
    return;
  }

  window.location.replace(adminUrl);
})();
