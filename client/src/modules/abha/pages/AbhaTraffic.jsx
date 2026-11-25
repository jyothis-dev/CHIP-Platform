import { useState } from 'react';
import { useAuth } from '@/modules/auth/hooks/useAuth.jsx';
import { useAbhaTraces } from '../hooks/useAbhaTraces.js';
import {
  Alert,
  Button,
  EmptyState,
  PageHeader,
  Spinner,
  Table,
} from '@/shared/ui/index.js';
import './AbhaTraffic.css';

const columns = [
  { key: 'when', label: 'When' },
  { key: 'method', label: 'Method' },
  { key: 'path', label: 'Path' },
  { key: 'status', label: 'Status' },
  { key: 'latency', label: 'Time' },
];

function pretty(value) {
  if (value == null) return '—';
  return JSON.stringify(value, null, 2);
}

export default function AbhaTrafficPage() {
  const { user } = useAuth();
  const tracesQuery = useAbhaTraces();
  const [selectedId, setSelectedId] = useState(null);
  const rows = tracesQuery.data || [];
  const selected = rows.find((row) => row.id === selectedId) || null;
  const disabled = tracesQuery.error?.code === 'TRACE_DISABLED';

  return (
    <section className="abha-traffic stack">
      <PageHeader
        title="ABHA traffic"
        description={`Redacted ABHA requests and responses for development. Viewing as ${user?.name} (${user?.role}).`}
      />

      <div className="row">
        <Button type="button" onClick={() => tracesQuery.refetch()} disabled={tracesQuery.isFetching}>
          {tracesQuery.isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <Alert>
        {disabled
          ? 'ABHA traffic tracing is off. Restart the API with ABDM_TRACE=true.'
          : (tracesQuery.isError ? tracesQuery.error.message : '')}
      </Alert>

      <div className="card trace-table-wrap">
        {tracesQuery.isPending ? <Spinner label="Loading ABHA traffic…" /> : null}
        {!tracesQuery.isPending && rows.length === 0 ? (
          <EmptyState>No ABHA calls yet. Request an OTP and refresh this page.</EmptyState>
        ) : null}
        {!tracesQuery.isPending && rows.length > 0 ? (
          <Table columns={columns}>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="trace-row"
                onClick={() => setSelectedId((current) => (current === row.id ? null : row.id))}
              >
                <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                <td>{row.method}</td>
                <td><code>{row.path}</code></td>
                <td>
                  <span className={`badge ${row.status == null || row.status >= 400 ? 'badge-danger' : ''}`}>
                    {row.status ?? 'failed'}
                  </span>
                </td>
                <td>{row.latencyMs != null ? `${row.latencyMs} ms` : '—'}</td>
              </tr>
            ))}
          </Table>
        ) : null}
      </div>

      {selected ? (
        <div className="card trace-detail">
          <h3>{selected.method} {selected.path}</h3>
          <p className="muted">Request id {selected.requestId}</p>
          {selected.errorMessage ? <p className="error">{selected.errorMessage}</p> : null}
          <h3>Request</h3>
          <pre>{pretty(selected.requestBody)}</pre>
          <h3>Response</h3>
          <pre>{pretty(selected.responseBody)}</pre>
        </div>
      ) : null}
    </section>
  );
}
