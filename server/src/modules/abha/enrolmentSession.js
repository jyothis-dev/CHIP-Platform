/** In-memory only. Never persist user tokens. */
const sessions = new Map();
const TTL_MS = 15 * 60 * 1000;

export function putEnrolmentSession(transactionId, data) {
  sessions.set(transactionId, {
    ...data,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function getEnrolmentSession(transactionId) {
  const row = sessions.get(transactionId);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    sessions.delete(transactionId);
    return null;
  }
  return row;
}

export function clearEnrolmentSession(transactionId) {
  sessions.delete(transactionId);
}

export function clearAllEnrolmentSessions() {
  sessions.clear();
}
