import { getStoredAuthToken } from "./authToken";


export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001").replace(
  /\/$/,
  "",
);

function getErrorMessage(payload, status) {
  if (!payload) {
    return `Ошибка запроса (${status})`;
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  if (Array.isArray(payload.detail) && payload.detail.length > 0) {
    return payload.detail
      .map((item) => (typeof item === "string" ? item : item?.msg))
      .filter(Boolean)
      .join("\n");
  }

  return `Ошибка запроса (${status})`;
}

function getErrorDetails(payload) {
  if (!payload) {
    return [];
  }

  if (typeof payload.detail === "string") {
    return [payload.detail];
  }

  if (Array.isArray(payload.detail)) {
    return payload.detail
      .map((item) => (typeof item === "string" ? item : item?.msg))
      .filter(Boolean);
  }

  return [];
}

async function parsePayload(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const textPayload = await response.text();
  return textPayload || null;
}

function hasHeader(headers, headerName) {
  const normalizedHeaderName = headerName.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === normalizedHeaderName);
}


function buildRequestHeaders(options = {}) {
  const headers = { ...(options.headers ?? {}) };
  const token = getStoredAuthToken();
  const hasBody = options.body !== undefined;
  const isFormDataBody = hasBody && options.body instanceof FormData;

  if (token && !hasHeader(headers, "Authorization")) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (hasBody && !isFormDataBody && !hasHeader(headers, "Content-Type")) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}


export async function apiRequest(path, options = {}) {
  const headers = buildRequestHeaders(options);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await parsePayload(response);

  if (!response.ok) {
    const error = new Error(getErrorMessage(payload, response.status));
    error.status = response.status;
    error.details = getErrorDetails(payload);
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function apiRequestBlob(path, options = {}) {
  const headers = buildRequestHeaders(options);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const payload = await parsePayload(response);
    const error = new Error(getErrorMessage(payload, response.status));
    error.status = response.status;
    error.details = getErrorDetails(payload);
    error.payload = payload;
    throw error;
  }

  return response.blob();
}
