import { apiRequest } from "./apiClient";


export function loginUser(username, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}


export function getCurrentUser() {
  return apiRequest("/auth/me");
}
