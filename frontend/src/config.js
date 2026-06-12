function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

const fallbackBaseUrl =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "::1" ||
  window.location.protocol === "file:"
    ? "http://localhost:5000"
    : "";

const apiBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_API_URL ||
    window.EDUKIDS_API_BASE_URL ||
    window.edukidsApiBaseUrl ||
    window.EduKidsApiBaseUrl ||
    fallbackBaseUrl,
);

window.EduKidsConfig = {
  apiBaseUrl,
  resolveApiBaseUrl: () => apiBaseUrl,
};

window.EDUKIDS_API_BASE_URL = apiBaseUrl;

export const API_BASE_URL = apiBaseUrl;
