let unauthorizedHandler = null;
let unauthorizedNotified = false;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
  unauthorizedNotified = false;
}

export function notifyUnauthorized() {
  if (unauthorizedNotified) return;
  unauthorizedNotified = true;
  unauthorizedHandler?.();
}

export function resetUnauthorizedFlag() {
  unauthorizedNotified = false;
}
