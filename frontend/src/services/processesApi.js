import { apiRequest } from "./apiClient";

export function getProcessesList() {
  return apiRequest("/processes");
}

export function getProcessItem(processId) {
  return apiRequest(`/processes/${processId}`);
}

export function createProcessItem(payload) {
  return apiRequest("/processes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProcessItem(processId, payload) {
  return apiRequest(`/processes/${processId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProcessItem(processId) {
  return apiRequest(`/processes/${processId}`, {
    method: "DELETE",
  });
}

