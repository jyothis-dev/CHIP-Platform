import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import './Hospitals.css';

export default function HospitalsPage() {
  const { can, switchHospital } = useAuth();
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', code: '', city: '' });

  async function load() {
    setHospitals(await api('/hospitals'));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  return (
    <section className="stack">
      <h1 className="page-title">Hospitals</h1>
      {error ? <p className="error">{error}</p> : null}
      <div className="card">
        <ul className="hospital-list">
          {hospitals.map((hospital) => (
            <li key={hospital.id}>
              <div>
                <strong>{hospital.name}</strong>
                <p className="muted">{hospital.code}{hospital.city ? ` · ${hospital.city}` : ''}</p>
              </div>
              <div className="row">
                {hospital.active ? <span className="badge">Active</span> : null}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={async () => {
                    if (!hospital.active) await switchHospital(hospital.id);
                    navigate(`/hospitals/${hospital.id}`);
                  }}
                >
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {can('hospital.manage') ? (
        <form
          className="card stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            try {
              const created = await api('/hospitals', { method: 'POST', body: form });
              await switchHospital(created.id);
              navigate(`/hospitals/${created.id}`);
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          <h2>Onboard a hospital</h2>
          <div className="form-grid two">
            <label className="field">Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label className="field">Code<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required /></label>
            <label className="field">City<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
          </div>
          <button className="btn-primary" type="submit">Create hospital</button>
        </form>
      ) : null}
    </section>
  );
}
