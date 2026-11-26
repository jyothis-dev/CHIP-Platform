const KEY = 'accessToken';

let accessToken = sessionStorage.getItem(KEY);
const listeners = new Set();

export function getToken() {
  return accessToken;
}

/** Lets React re-render when the token changes (login, logout, a 401). */
export function subscribeToken(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setToken(token) {
  accessToken = token;
  if (token) sessionStorage.setItem(KEY, token);
  else sessionStorage.removeItem(KEY);
  listeners.forEach((listener) => listener());
}

export function clearToken() {
  setToken(null);
}
