import { apiRequest } from "./apiClient";

export function getRoutesList() {
  return apiRequest("/routes");
}

export function getRouteItem(routeId) {
  return apiRequest(`/routes/${routeId}`);
}

export function createRouteItem(payload) {
  return apiRequest("/routes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRouteItem(routeId, payload) {
  return apiRequest(`/routes/${routeId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteRouteItem(routeId) {
  return apiRequest(`/routes/${routeId}`, {
    method: "DELETE",
  });
}

