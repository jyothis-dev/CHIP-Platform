import { useState } from 'react';
import { useAuth } from '@/modules/auth/hooks/useAuth.jsx';
import { useActivityLog } from '../hooks/useActivityLog.js';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Spinner,
  Table,
} from '@/shared/ui/index.js';
import './ActivityLog.css';

const emptyFilters = {
  action: '',
  resourceType: '',
  outcome: '',
  limit: 100,
};

const columns = [
  { key: 'when', label: 'When' },
  { key: 'message', label: 'Message' },
  { key: 'actor', label: 'Actor' },
  { key: 'action', label: 'Action' },
  { key: 'resource', label: 'Resource' },
  { key: 'outcome', label: 'Outcome' },
];

export default function ActivityLogPage() {
  const { user } = useAuth();
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const logQuery = useActivityLog(filters);
  const rows = logQuery.data || [];

  return (
    <section className="activity stack">
      <PageHeader
        title="Activity log"
        description={`Facility activity with plain-language messages. Viewing as ${user?.name} (${user?.role}).`}
      />

      <Alert>{logQuery.isError ? logQuery.error.message : ''}</Alert>

      <form
        className="card row activity-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({ ...draft, limit: 100 });
        }}
      >
        <Field label="Action">
          {({ id }) => (
            <input
              id={id}
              value={draft.action}
              onChange={(event) => setDraft((prev) => ({ ...prev, action: event.target.value }))}
              placeholder="patient.create"
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Resource type">
          {({ id }) => (
            <input
              id={id}
              value={draft.resourceType}
              onChange={(event) => setDraft((prev) => ({
                ...prev,
                resourceType: event.target.value,
              }))}
              placeholder="patient"
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Outcome">
          {({ id }) => (
            <Select
              id={id}
              value={draft.outcome}
              onChange={(event) => setDraft((prev) => ({ ...prev, outcome: event.target.value }))}
            >
              <option value="">Any</option>
              <option value="success">success</option>
              <option value="denied">denied</option>
              <option value="failure">failure</option>
            </Select>
          )}
        </Field>
        <Button type="submit" disabled={logQuery.isFetching}>
          {logQuery.isFetching ? 'Loading…' : 'Apply filters'}
        </Button>
      </form>

      <div className="card activity-table-wrap">
        {logQuery.isPending ? <Spinner label="Loading activity…" /> : null}
        {!logQuery.isPending && rows.length === 0 ? (
          <EmptyState>No activity yet for this facility.</EmptyState>
        ) : null}
        {!logQuery.isPending && rows.length > 0 ? (
          <Table columns={columns}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                <td className="activity-message">{row.message}</td>
                <td>{row.actor ? `${row.actor.name} (${row.actor.role})` : '—'}</td>
                <td><code>{row.action}</code></td>
                <td>
                  {row.resourceType || '—'}
                  {row.resourceId ? ` · ${row.resourceId.slice(0, 8)}…` : ''}
                </td>
                <td>
                  <span className={`badge ${row.outcome === 'denied' || row.outcome === 'failure' ? 'badge-danger' : ''}`}>
                    {row.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        ) : null}
      </div>
    </section>
  );
}
