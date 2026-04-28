import { API_BASE_URL, apiRequest } from "./apiClient";

export function getInventoryBalanceList(asOfDate) {
  const query = asOfDate ? `?as_of_date=${encodeURIComponent(asOfDate)}` : "";
  return apiRequest(`/inventory-balance${query}`);
}

export function getInventoryBalanceDates() {
  return apiRequest("/inventory-balance/dates");
}

export function createInventoryBalanceItem(payload) {
  return apiRequest("/inventory-balance", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateInventoryBalanceItem(balanceId, payload) {
  return apiRequest(`/inventory-balance/${balanceId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteInventoryBalanceItem(balanceId) {
  return apiRequest(`/inventory-balance/${balanceId}`, {
    method: "DELETE",
  });
}

export function previewInventoryBalanceImport(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("import_mode", "upsert");

  return apiRequest("/inventory-balance/import/preview", {
    method: "POST",
    body: formData,
  });
}

export function commitInventoryBalanceImport(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("import_mode", "upsert");

  return apiRequest("/inventory-balance/import/commit", {
    method: "POST",
    body: formData,
  });
}

export function getInventoryBalanceImportTemplateUrl() {
  return `${API_BASE_URL}/inventory-balance/import/template`;
}
