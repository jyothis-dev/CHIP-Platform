const LABELS = {
  INIT_SENT: 'Sending',
  INIT_FAILED: 'Refused',
  REQUESTED: 'Requested',
  GRANTED: 'Granted',
  DENIED: 'Denied',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
};

const TONES = {
  INIT_FAILED: 'badge-danger',
  DENIED: 'badge-danger',
  REVOKED: 'badge-danger',
  EXPIRED: 'badge-warn',
  INIT_SENT: 'badge-warn',
};

export function StatusBadge({ status }) {
  return <span className={`badge ${TONES[status] || ''}`.trim()}>{LABELS[status] || status}</span>;
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/** The time the current status was reached, from the callback that moved it. */
export function statusTime(row) {
  const byStatus = {
    GRANTED: row.grantedAt,
    DENIED: row.deniedAt,
    EXPIRED: row.expiredAt,
    REVOKED: row.revokedAt,
  };
  return byStatus[row.status] || row.statusChangedAt || row.createdAt;
}
