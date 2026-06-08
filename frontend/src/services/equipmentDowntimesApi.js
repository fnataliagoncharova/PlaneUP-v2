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

export function getEquipmentDowntimes(filters = {}) {
  return apiRequest(`/equipment-downtimes${buildQuery(filters)}`);
}

export function createEquipmentDowntime(payload) {
  return apiRequest("/equipment-downtimes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEquipmentDowntime(id, payload) {
  return apiRequest(`/equipment-downtimes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function closeEquipmentDowntime(id, payload) {
  return apiRequest(`/equipment-downtimes/${id}/close`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteEquipmentDowntime(id) {
  return apiRequest(`/equipment-downtimes/${id}`, {
    method: "DELETE",
  });
}
