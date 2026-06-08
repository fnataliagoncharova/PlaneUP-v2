import { apiRequest } from "./apiClient";

function buildQuery(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }
    params.set(key, String(value));
  });

  const queryText = params.toString();
  return queryText ? `?${queryText}` : "";
}

export function getDowntimeReasons(filters = {}) {
  return apiRequest(`/downtime-reasons${buildQuery(filters)}`);
}

export function createDowntimeReason(payload) {
  return apiRequest("/downtime-reasons", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDowntimeReason(id, payload) {
  return apiRequest(`/downtime-reasons/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteDowntimeReason(id) {
  return apiRequest(`/downtime-reasons/${id}`, {
    method: "DELETE",
  });
}
