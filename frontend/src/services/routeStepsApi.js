import { apiRequest } from "./apiClient";

export function getRouteStepsList(routeId) {
  return apiRequest(`/routes/${routeId}/steps`);
}

export function getRouteStepItem(routeStepId) {
  return apiRequest(`/route-steps/${routeStepId}`);
}

export function createRouteStepItem(routeId, payload) {
  return apiRequest(`/routes/${routeId}/steps`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRouteStepItem(routeStepId, payload) {
  return apiRequest(`/route-steps/${routeStepId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteRouteStepItem(routeStepId) {
  return apiRequest(`/route-steps/${routeStepId}`, {
    method: "DELETE",
  });
}
