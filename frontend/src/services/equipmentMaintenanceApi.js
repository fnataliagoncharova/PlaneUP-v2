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

export function getEquipmentMaintenance(filters = {}) {
  return apiRequest(`/equipment-maintenance${buildQuery(filters)}`);
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
