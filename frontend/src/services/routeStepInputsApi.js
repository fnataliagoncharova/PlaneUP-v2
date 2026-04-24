import { apiRequest } from "./apiClient";

export function getRouteStepInputsList(routeStepId) {
  return apiRequest(`/route-steps/${routeStepId}/inputs`);
}

export function getRouteStepInputItem(stepInputId) {
  return apiRequest(`/route-step-inputs/${stepInputId}`);
}

export function createRouteStepInputItem(routeStepId, payload) {
  return apiRequest(`/route-steps/${routeStepId}/inputs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRouteStepInputItem(stepInputId, payload) {
  return apiRequest(`/route-step-inputs/${stepInputId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteRouteStepInputItem(stepInputId) {
  return apiRequest(`/route-step-inputs/${stepInputId}`, {
    method: "DELETE",
  });
}
