import { apiRequest, apiRequestBlob } from "./apiClient";

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

export function importInventoryBalanceDegassing(file) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest("/inventory-balance-degassing/import", {
    method: "POST",
    body: formData,
  });
}

export function downloadInventoryBalanceDegassingTemplate() {
  return apiRequestBlob("/inventory-balance-degassing/template");
}

export function getInventoryDegassingSuggestionReport(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.as_of_date) {
    searchParams.set("as_of_date", params.as_of_date);
  }

  if (params.lookback_days) {
    searchParams.set("lookback_days", String(params.lookback_days));
  }

  const query = searchParams.toString();
  return apiRequest(`/inventory-balance-degassing/suggestion-report${query ? `?${query}` : ""}`);
}

export function downloadInventoryDegassingSuggestionReport(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.as_of_date) {
    searchParams.set("as_of_date", params.as_of_date);
  }

  if (params.lookback_days) {
    searchParams.set("lookback_days", String(params.lookback_days));
  }

  const query = searchParams.toString();
  return apiRequestBlob(`/inventory-balance-degassing/suggestion-report/export${query ? `?${query}` : ""}`);
}
