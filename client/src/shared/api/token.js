const KEY = 'accessToken';

let accessToken = sessionStorage.getItem(KEY);

export function getToken() {
  return accessToken;
}

export function setToken(token) {
  accessToken = token;
  if (token) sessionStorage.setItem(KEY, token);
  else sessionStorage.removeItem(KEY);
}

export function clearToken() {
  setToken(null);
}
