import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import './Children.css';

const empty = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  sex: 'female',
  mrn: '',
  guardianName: '',
  relationship: 'Mother',
  phone: '',
  email: '',
};

export default function ChildrenPage() {
  const { can } = useAuth();
  const [children, setChildren] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  async function load() {
    setChildren(await api('/children'));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function set(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  return (
    <section className="stack">
      <h1 className="page-title">Children</h1>
      {error ? <p className="error">{error}</p> : null}
      <div className="card">
        <table>
          <thead>
            <tr><th>Child</th><th>MRN</th><th>Date of birth</th><th>Guardian</th></tr>
          </thead>
          <tbody>
            {children.map((child) => (
              <tr key={child.id}>
                <td><Link to={`/children/${child.id}`}>{child.firstName} {child.lastName}</Link></td>
                <td>{child.mrn}</td>
                <td>{String(child.dateOfBirth).slice(0, 10)}</td>
                <td>{child.guardians?.[0]?.name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {children.length === 0 ? <p className="muted">No children registered yet.</p> : null}
      </div>
      {can('child.register') ? (
        <form
          className="card stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            const guardian = form.guardianName
              ? {
                  name: form.guardianName,
                  relationship: form.relationship,
                  phone: form.phone || undefined,
                  email: form.email || undefined,
                  isPrimary: true,
                }
              : undefined;
            try {
              await api('/children', {
                method: 'POST',
                body: {
                  firstName: form.firstName,
                  lastName: form.lastName,
                  dateOfBirth: form.dateOfBirth,
                  sex: form.sex,
                  mrn: form.mrn,
                  guardian,
                },
              });
              setForm(empty);
              await load();
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          <h2>Register a child</h2>
          <div className="form-grid two">
            <label className="field">First name<input value={form.firstName} onChange={set('firstName')} required /></label>
            <label className="field">Last name<input value={form.lastName} onChange={set('lastName')} required /></label>
            <label className="field">Date of birth<input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} required /></label>
            <label className="field">Sex
              <select value={form.sex} onChange={set('sex')}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="field">MRN<input value={form.mrn} onChange={set('mrn')} required /></label>
            <label className="field">Guardian name<input value={form.guardianName} onChange={set('guardianName')} /></label>
            <label className="field">Relationship<input value={form.relationship} onChange={set('relationship')} /></label>
            <label className="field">Guardian phone<input value={form.phone} onChange={set('phone')} /></label>
            <label className="field">Guardian email<input type="email" value={form.email} onChange={set('email')} /></label>
          </div>
          <button className="btn-primary" type="submit">Register</button>
        </form>
      ) : null}
    </section>
  );
}
