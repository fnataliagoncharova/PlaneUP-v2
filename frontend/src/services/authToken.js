export const AUTH_TOKEN_STORAGE_KEY = "planeup_access_token";


export function getStoredAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}


export function setStoredAuthToken(token) {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}


export function clearStoredAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}
