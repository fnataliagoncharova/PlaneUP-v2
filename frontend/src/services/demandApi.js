import { apiRequest } from "./apiClient";

export function calculateDemand(payload) {
  return apiRequest("/demand/calculate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
