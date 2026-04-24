import { apiRequest } from "./apiClient";

export function getRouteStepEquipmentList(routeStepId) {
  return apiRequest(`/route-steps/${routeStepId}/equipment`);
}

export function getRouteStepEquipmentItem(stepEquipmentId) {
  return apiRequest(`/route-step-equipment/${stepEquipmentId}`);
}

export function createRouteStepEquipmentItem(routeStepId, payload) {
  return apiRequest(`/route-steps/${routeStepId}/equipment`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRouteStepEquipmentItem(stepEquipmentId, payload) {
  return apiRequest(`/route-step-equipment/${stepEquipmentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteRouteStepEquipmentItem(stepEquipmentId) {
  return apiRequest(`/route-step-equipment/${stepEquipmentId}`, {
    method: "DELETE",
  });
}
