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

export function getProductionActuals(filters = {}) {
  return apiRequest(`/production-actuals${buildQuery(filters)}`);
}

export function createProductionActual(payload) {
  return apiRequest("/production-actuals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProductionActual(id, payload) {
  return apiRequest(`/production-actuals/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProductionActual(id) {
  return apiRequest(`/production-actuals/${id}`, {
    method: "DELETE",
  });
}
