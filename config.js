window.__ESTUDIANTES_API_BASE__ = (() => {
  const explicitBase = "";

  if (explicitBase) {
    return explicitBase.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    if (hostname === "127.0.0.1" || hostname === "localhost") {
      return "http://127.0.0.1:8787";
    }
  }

  return "";
})();
