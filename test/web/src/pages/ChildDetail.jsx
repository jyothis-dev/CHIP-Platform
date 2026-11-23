import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import './ChildDetail.css';

export default function ChildDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const [child, setChild] = useState(null);
  const [history, setHistory] = useState([]);
  const [nextDue, setNextDue] = useState(null);
  const [error, setError] = useState('');
  const [guardian, setGuardian] = useState({ name: '', relationship: 'Father', phone: '', email: '' });
  const [dose, setDose] = useState({ vaccineCode: '', doseNumber: 1, batchNumber: '' });

  async function load() {
    const [childData, historyData, due] = await Promise.all([
      api(`/children/${id}`),
      api(`/children/${id}/vaccinations`),
      api(`/children/${id}/vaccinations/next-due`),
    ]);
    setChild(childData);
    setHistory(historyData);
    setNextDue(due);
    if (due) setDose((current) => ({ ...current, vaccineCode: due.vaccineCode, doseNumber: due.doseNumber }));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  async function record(event) {
    event.preventDefault();
    setError('');
    try {
      await api(`/children/${id}/vaccinations`, {
        method: 'POST',
        body: {
          vaccineCode: dose.vaccineCode,
          doseNumber: Number(dose.doseNumber),
          batchNumber: dose.batchNumber || undefined,
        },
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!child) return <p className="muted">Loading child…</p>;

  return (
    <section className="stack">
      <header>
        <h1 className="page-title">{child.firstName} {child.lastName}</h1>
        <p className="muted">MRN {child.mrn} · born {String(child.dateOfBirth).slice(0, 10)}</p>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <article className="card stack">
        <h2>Next due</h2>
        {nextDue ? (
          <p>
            <span className={`badge ${nextDue.status === 'overdue' ? 'badge-danger' : nextDue.status === 'upcoming' ? 'badge-warn' : ''}`}>
              {nextDue.status}
            </span>{' '}
            {nextDue.vaccineName} dose {nextDue.doseNumber} on {nextDue.dueDate}
          </p>
        ) : <p className="muted">The schedule is complete.</p>}
      </article>
      <div className="split">
        <article className="card stack">
          <h2>Guardians</h2>
          <ul className="plain-list">
            {child.guardians.map((person) => (
              <li key={person.id}>{person.name} · {person.relationship}{person.isPrimary ? ' · primary' : ''}</li>
            ))}
          </ul>
          {can('guardian.manage') ? (
            <form
              className="stack"
              onSubmit={async (event) => {
                event.preventDefault();
                await api(`/children/${id}/guardians`, {
                  method: 'POST',
                  body: {
                    ...guardian,
                    phone: guardian.phone || undefined,
                    email: guardian.email || undefined,
                    isPrimary: child.guardians.length === 0,
                  },
                });
                setGuardian({ name: '', relationship: 'Father', phone: '', email: '' });
                await load();
              }}
            >
              <label className="field">Name<input value={guardian.name} onChange={(event) => setGuardian({ ...guardian, name: event.target.value })} required /></label>
              <label className="field">Relationship<input value={guardian.relationship} onChange={(event) => setGuardian({ ...guardian, relationship: event.target.value })} required /></label>
              <label className="field">Phone<input value={guardian.phone} onChange={(event) => setGuardian({ ...guardian, phone: event.target.value })} /></label>
              <label className="field">Email<input type="email" value={guardian.email} onChange={(event) => setGuardian({ ...guardian, email: event.target.value })} /></label>
              <button className="btn-primary" type="submit">Associate guardian</button>
            </form>
          ) : null}
        </article>
        <article className="card stack">
          <h2>Vaccination history</h2>
          <table>
            <thead><tr><th>Vaccine</th><th>Dose</th><th>Given</th></tr></thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.id}>
                  <td>{record.vaccineName}</td>
                  <td>{record.doseNumber}</td>
                  <td>{String(record.administeredAt).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {can('vaccination.create') ? (
            <form className="stack" onSubmit={record}>
              <label className="field">Vaccine code<input value={dose.vaccineCode} onChange={(event) => setDose({ ...dose, vaccineCode: event.target.value })} required /></label>
              <label className="field">Dose number<input type="number" min="0" value={dose.doseNumber} onChange={(event) => setDose({ ...dose, doseNumber: event.target.value })} required /></label>
              <label className="field">Batch<input value={dose.batchNumber} onChange={(event) => setDose({ ...dose, batchNumber: event.target.value })} /></label>
              <button className="btn-primary" type="submit">Record dose</button>
            </form>
          ) : null}
        </article>
      </div>
    </section>
  );
}
