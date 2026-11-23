import { useEffect, useState } from 'react';
import { api } from '../api.js';
import './Audit.css';

export default function AuditPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/audit-logs').then(setRows).catch((err) => setError(err.message));
  }, []);

  return (
    <section className="stack">
      <h1 className="page-title">Audit log</h1>
      {error ? <p className="error">{error}</p> : null}
      <div className="card audit-table">
        <table>
          <thead>
            <tr><th>When</th><th>Action</th><th>Outcome</th><th>Entity</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{String(row.createdAt).replace('T', ' ').slice(0, 19)}</td>
                <td>{row.action}</td>
                <td>{row.outcome}</td>
                <td>{row.entityType ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
