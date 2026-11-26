import { useState } from 'react';
import {
  Alert, Button, EmptyState, Field, Spinner, Table,
} from '@/shared/ui/index.js';
import { useAuth } from '@/modules/auth/hooks/useAuth.jsx';
import { CLINICAL_ROLES, hasRole } from '@/modules/auth/hooks/roles.js';
import { useHprLookup } from '../hooks/useRegistries.js';
import { mobileSchema } from '../validation/registrySchemas.js';

const COLUMNS = [
  { key: 'hprId', label: 'HPR ID' },
  { key: 'number', label: 'HPR ID number' },
  { key: 'name', label: 'Name' },
  { key: 'methods', label: 'Login methods' },
];

function ProfessionalTable({ rows }) {
  return (
    <Table columns={COLUMNS}>
      {rows.map((row) => (
        <tr key={`${row.hprId}-${row.hprIdNumber}`}>
          <td>{row.hprId || '—'}</td>
          <td>{row.hprIdNumber || '—'}</td>
          <td>{row.name || '—'}</td>
          <td>{row.authMethods.join(', ') || '—'}</td>
        </tr>
      ))}
    </Table>
  );
}

export function ProfessionalSearch() {
  const { user } = useAuth();
  const lookup = useHprLookup();
  const clinical = hasRole(user, CLINICAL_ROLES);
  const [hprId, setHprId] = useState('');
  const [mobile, setMobile] = useState('');
  const [info, setInfo] = useState({ name: '', registrationNumber: '', state: '' });
  const [mobileError, setMobileError] = useState('');
  const [idError, setIdError] = useState('');

  function searchById(event) {
    event.preventDefault();
    const id = hprId.trim();
    if (!id) { setIdError('Enter an HPR ID'); return; }
    setIdError('');
    lookup.byId.mutate(id);
    lookup.exists.mutate(id);
  }

  function searchByMobile(event) {
    event.preventDefault();
    const parsed = mobileSchema.safeParse(mobile);
    if (!parsed.success) { setMobileError(parsed.error.issues[0].message); return; }
    setMobileError('');
    lookup.byMobile.mutate(parsed.data);
  }

  function fetchInfo(event) {
    event.preventDefault();
    const practitioner = Object.fromEntries(
      Object.entries({ id: hprId.trim(), ...info }).map(([key, value]) => [key, String(value).trim()]).filter(([, value]) => value),
    );
    if (Object.keys(practitioner).length === 0) return;
    lookup.info.mutate(practitioner);
  }

  const byId = lookup.byId.data;
  const errors = [lookup.byId.error, lookup.exists.error, lookup.byMobile.error, lookup.info.error].filter(Boolean);

  return (
    <div className="stack">
      <form className="stack registry-form" onSubmit={searchById} noValidate>
        <Field label="HPR ID" error={idError}>
          {(a11y) => (
            <input {...a11y} className="text-input" value={hprId} onChange={(event) => setHprId(event.target.value)} />
          )}
        </Field>
        <div className="row">
          <Button type="submit" disabled={lookup.byId.isPending}>Search by HPR ID</Button>
        </div>
      </form>
      {lookup.byId.isPending ? <Spinner label="Searching the registry…" /> : null}
      {byId && !byId.found ? <EmptyState>No professional with that HPR ID.</EmptyState> : null}
      {byId?.found ? <ProfessionalTable rows={[byId.professional]} /> : null}

      {clinical ? (
        <>
          <form className="stack registry-form" onSubmit={searchByMobile} noValidate>
            <Field label="Mobile number" error={mobileError}>
              {(a11y) => (
                <input
                  {...a11y}
                  className="text-input"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={10}
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value.replace(/\D/g, ''))}
                />
              )}
            </Field>
            <div className="row">
              <Button type="submit" disabled={lookup.byMobile.isPending}>Search by mobile</Button>
            </div>
          </form>
          {lookup.byMobile.data && lookup.byMobile.data.professionals.length === 0
            ? <EmptyState>No professional registered with that mobile number.</EmptyState> : null}
          {lookup.byMobile.data?.professionals.length > 0
            ? <ProfessionalTable rows={lookup.byMobile.data.professionals} /> : null}

          <form className="stack registry-form" onSubmit={fetchInfo} noValidate>
            <p className="muted">Professional information uses the HPR ID above, plus any of these.</p>
            <div className="registry-grid">
              <Field label="Name">
                {(a11y) => <input {...a11y} className="text-input" value={info.name} onChange={(event) => setInfo({ ...info, name: event.target.value })} />}
              </Field>
              <Field label="Registration number">
                {(a11y) => <input {...a11y} className="text-input" value={info.registrationNumber} onChange={(event) => setInfo({ ...info, registrationNumber: event.target.value })} />}
              </Field>
              <Field label="State">
                {(a11y) => <input {...a11y} className="text-input" value={info.state} onChange={(event) => setInfo({ ...info, state: event.target.value })} />}
              </Field>
            </div>
            <div className="row">
              <Button type="submit" variant="ghost" disabled={lookup.info.isPending}>Get professional information</Button>
            </div>
          </form>
          {lookup.info.data ? (
            <div className="stack">
              {lookup.info.data.message ? <p className="muted">{lookup.info.data.message}</p> : null}
              {lookup.info.data.practitioners
                ? <pre className="registry-json">{JSON.stringify(lookup.info.data.practitioners, null, 2)}</pre>
                : <EmptyState>The registry returned no professional information.</EmptyState>}
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted">Searching by mobile number and professional information are for clinicians and admins.</p>
      )}

      {errors.map((error) => <Alert key={error.message}>{error.message}</Alert>)}
    </div>
  );
}
