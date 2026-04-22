import { apiRequest } from "./apiClient";

export function getMachinesList() {
  return apiRequest("/machines");
}

export function getMachineItem(machineId) {
  return apiRequest(`/machines/${machineId}`);
}

export function createMachineItem(payload) {
  return apiRequest("/machines", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMachineItem(machineId, payload) {
  return apiRequest(`/machines/${machineId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteMachineItem(machineId) {
  return apiRequest(`/machines/${machineId}`, {
    method: "DELETE",
  });
}

