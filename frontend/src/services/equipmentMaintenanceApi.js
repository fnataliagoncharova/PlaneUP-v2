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

export function getEquipmentMaintenance(filters = {}) {
  return apiRequest(`/equipment-maintenance${buildQuery(filters)}`);
}

export function printMaintenanceSchedule(dateFrom, dateTo) {
  return apiRequestBlob(`/equipment-maintenance/print${buildQuery({ date_from: dateFrom, date_to: dateTo })}`);
}

export function createEquipmentMaintenance(payload) {
  return apiRequest("/equipment-maintenance", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEquipmentMaintenance(id, payload) {
  return apiRequest(`/equipment-maintenance/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteEquipmentMaintenance(id) {
  return apiRequest(`/equipment-maintenance/${id}`, {
    method: "DELETE",
  });
}
