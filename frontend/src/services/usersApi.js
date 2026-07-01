import { apiRequest } from "./apiClient";


export function getUsers() {
  return apiRequest("/users");
}


export function createUser(payload) {
  return apiRequest("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export function updateUser(userId, payload) {
  return apiRequest(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}


export function updateUserRole(userId, role) {
  return apiRequest(`/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}


export function updateUserProfile(userId, payload) {
  return apiRequest(`/users/${userId}/profile`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}


export function updateUserPassword(userId, password) {
  return apiRequest(`/users/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });
}


export function updateUserActive(userId, isActive) {
  return apiRequest(`/users/${userId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}
