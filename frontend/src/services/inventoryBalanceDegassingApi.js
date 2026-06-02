import { apiRequest } from "./apiClient";

export function getInventoryBalanceDegassing(filters = {}) {
  const params = new URLSearchParams();

  if (filters.as_of_date) {
    params.set("as_of_date", filters.as_of_date);
  }

  if (filters.nomenclature_id) {
    params.set("nomenclature_id", String(filters.nomenclature_id));
  }

  const query = params.toString();
  return apiRequest(`/inventory-balance-degassing${query ? `?${query}` : ""}`);
}

export function createInventoryBalanceDegassing(payload) {
  return apiRequest("/inventory-balance-degassing", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateInventoryBalanceDegassing(balanceDegassingId, payload) {
  return apiRequest(`/inventory-balance-degassing/${balanceDegassingId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteInventoryBalanceDegassing(balanceDegassingId) {
  return apiRequest(`/inventory-balance-degassing/${balanceDegassingId}`, {
    method: "DELETE",
  });
}
