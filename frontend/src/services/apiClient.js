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
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(" ");
  }

  return `Ошибка запроса (${status})`;
}

async function parsePayload(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const textPayload = await response.text();
  return textPayload || null;
}

export async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  const hasBody = options.body !== undefined;
  const isFormDataBody = hasBody && options.body instanceof FormData;

  if (hasBody && !isFormDataBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await parsePayload(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, response.status));
  }

  return payload;
}

export async function apiRequestBlob(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  const hasBody = options.body !== undefined;
  const isFormDataBody = hasBody && options.body instanceof FormData;

  if (hasBody && !isFormDataBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const payload = await parsePayload(response);
    throw new Error(getErrorMessage(payload, response.status));
  }

  return response.blob();
}
