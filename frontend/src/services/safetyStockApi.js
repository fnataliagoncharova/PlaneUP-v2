import { API_BASE_URL, apiRequest } from "./apiClient";

export function getSafetyStockList(nomenclatureId) {
  const query = nomenclatureId ? `?nomenclature_id=${encodeURIComponent(nomenclatureId)}` : "";
  return apiRequest(`/safety-stock${query}`);
}

export function createSafetyStockItem(payload) {
  return apiRequest("/safety-stock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSafetyStockItem(safetyStockId, payload) {
  return apiRequest(`/safety-stock/${safetyStockId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteSafetyStockItem(safetyStockId) {
  return apiRequest(`/safety-stock/${safetyStockId}`, {
    method: "DELETE",
  });
}

export function previewSafetyStockImport(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("import_mode", "upsert");

  return apiRequest("/safety-stock/import/preview", {
    method: "POST",
    body: formData,
  });
}

export function commitSafetyStockImport(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("import_mode", "upsert");

  return apiRequest("/safety-stock/import/commit", {
    method: "POST",
    body: formData,
  });
}

export function getSafetyStockImportTemplateUrl() {
  return `${API_BASE_URL}/safety-stock/import/template`;
}
