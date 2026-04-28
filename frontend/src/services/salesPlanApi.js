import { API_BASE_URL, apiRequest, apiRequestBlob } from "./apiClient";

export function getSalesPlanList(planDate) {
  const query = planDate
    ? `?plan_date=${encodeURIComponent(planDate)}`
    : "";
  return apiRequest(`/sales-plan${query}`);
}

export function createSalesPlanItem(payload) {
  return apiRequest("/sales-plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSalesPlanItem(salesPlanId, payload) {
  return apiRequest(`/sales-plan/${salesPlanId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteSalesPlanItem(salesPlanId) {
  return apiRequest(`/sales-plan/${salesPlanId}`, {
    method: "DELETE",
  });
}

export function previewSalesPlanImport(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("import_mode", "upsert");

  return apiRequest("/sales-plan/import/preview", {
    method: "POST",
    body: formData,
  });
}

export function commitSalesPlanImport(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("import_mode", "upsert");

  return apiRequest("/sales-plan/import/commit", {
    method: "POST",
    body: formData,
  });
}

export function downloadSalesPlanImportTemplate() {
  return apiRequestBlob("/sales-plan/import/template");
}

export function getSalesPlanImportTemplateUrl() {
  return `${API_BASE_URL}/sales-plan/import/template`;
}
