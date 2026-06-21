import { API_BASE_URL } from "../../config.js";

export class PetApiError extends Error {
  constructor(message, { status = 0, errorCode = "", details = null, payload = null } = {}) {
    super(message || "Request failed");
    this.name = "PetApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
    this.payload = payload;
  }
}

function getAuthToken() {
  return (
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    ""
  ).trim();
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    throw new PetApiError(payload?.message || `Request failed: ${response.status}`, {
      status: response.status,
      errorCode: payload?.errorCode || "",
      details: payload?.details || null,
      payload,
    });
  }

  return payload;
}

export function createPetHttpClient() {
  async function request(path, { method = "GET", body, headers = {}, signal } = {}) {
    const finalHeaders = {
      "Content-Type": "application/json",
      ...headers,
    };

    const token = getAuthToken();
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });

    return parseResponse(response);
  }

  return { request };
}

