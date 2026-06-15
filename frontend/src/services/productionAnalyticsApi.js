import { apiRequest, apiRequestBlob } from "./apiClient";

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

export function getMonthlyOutputAnalytics(filters = {}) {
  return apiRequest(`/production-analytics/monthly-output${buildQuery(filters)}`);
}

export function getEquipmentMonthlyAnalytics(filters = {}) {
  return apiRequest(`/production-analytics/equipment-monthly${buildQuery(filters)}`);
}

export function printProductionAnalytics(month) {
  return apiRequestBlob(`/production-analytics/print${buildQuery({ month })}`);
}
