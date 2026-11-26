import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert, Button, Field, PageHeader, Spinner, Table,
} from '@/shared/ui/index.js';
import { useAuth } from '@/modules/auth/hooks/useAuth.jsx';
import { ADMIN_ROLES, hasRole } from '@/modules/auth/hooks/roles.js';
import { RegistryReadiness } from '../components/RegistryReadiness.jsx';
import { useBridgeStatus, useLinkBridge, useOwnFacility } from '../hooks/useRegistries.js';
import { HIP_NAME_MAX, hipNameSchema } from '../validation/registrySchemas.js';
import '../registries.css';

const SERVICE_COLUMNS = [
  { key: 'id', label: 'Service ID' },
  { key: 'types', label: 'Roles' },
];

export default function FacilityLinkPage() {
  const { user } = useAuth();
  const isAdmin = hasRole(user, ADMIN_ROLES);
  const own = useOwnFacility();
  const facility = own.data;
  const status = useBridgeStatus(facility?.hfrId ? facility.id : null);
  const link = useLinkBridge(facility?.id);
  const [roles, setRoles] = useState({ HIP: true, HIU: true });
  const [hipName, setHipName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [nameError, setNameError] = useState('');
  const [result, setResult] = useState(null);

  const chosen = Object.keys(roles).filter((role) => roles[role]);

  async function submit(event) {
    event.preventDefault();
    setResult(null);
    const parsed = hipNameSchema.safeParse(hipName);
    if (!parsed.success) { setNameError(parsed.error.issues[0].message); return; }
    setNameError('');
    if (chosen.length === 0 || !confirmed) return;
    try {
      setResult(await link.mutateAsync({ roles: chosen, hipName: parsed.data, confirm: true }));
    } catch {
      // Shown from link.error below.
    }
  }

  return (
    <section className="stack registry-page">
      <PageHeader
        title="Facility and bridge link"
        description="Link this facility to the CHIP bridge as a HIP (shares records) and an HIU (reads records). Each role is its own entry."
      />
      <RegistryReadiness />
      {own.isLoading ? <Spinner label="Loading the facility…" /> : null}
      <Alert>{own.error ? own.error.message : null}</Alert>

      {facility ? (
        <div className="card stack">
          <h2>{facility.name}</h2>
          <p>
            HFR ID: {facility.hfrId ? <strong>{facility.hfrId}</strong> : <span className="muted">not saved</span>}
            {facility.hfrStatus ? <span className="muted"> ({facility.hfrStatus})</span> : null}
          </p>
          {!facility.hfrId ? (
            <p className="muted">
              Find the facility on <Link to="/registry">Registry lookup</Link> and save its ID first. A facility still in Draft has no ID to link.
            </p>
          ) : null}
        </div>
      ) : null}

      {facility?.hfrId ? (
        <div className="card stack">
          <h2>Roles on the bridge</h2>
          {status.isLoading ? <Spinner label="Reading bridge-services…" /> : null}
          <Alert>{status.error ? status.error.message : null}</Alert>
          {status.data ? (
            <>
              <p>
                Active roles for this facility:{' '}
                {status.data.roles.length ? <strong>{status.data.roles.join(', ')}</strong> : <span className="muted">none</span>}
              </p>
              {status.data.warnings.map((line) => <Alert key={line} tone="warning">{line}</Alert>)}
              <p className="muted">
                Copy these into <code>server/.env</code> and restart the server. CHIP does not write them for you.
              </p>
              <ul className="registry-ids">
                <li>ABDM_HIP_ID={status.data.suggested.hipId || <span className="muted">(not linked as HIP)</span>}</li>
                <li>ABDM_HIU_ID={status.data.suggested.hiuId || <span className="muted">(not linked as HIU)</span>}</li>
              </ul>
              {status.data.services.length > 0 ? (
                <Table columns={SERVICE_COLUMNS}>
                  {status.data.services.map((service) => (
                    <tr key={service.id}>
                      <td>{service.id}</td>
                      <td>{service.types.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </Table>
              ) : null}
              <div className="row">
                <Button type="button" variant="ghost" disabled={status.isFetching} onClick={() => status.refetch()}>Check again</Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {facility?.hfrId && isAdmin ? (
        <form className="card stack registry-form" onSubmit={submit} noValidate>
          <h2>Link or update</h2>
          <fieldset className="registry-roles">
            <legend>Roles</legend>
            {['HIP', 'HIU'].map((role) => (
              <label key={role}>
                <input
                  type="checkbox"
                  checked={roles[role]}
                  onChange={(event) => setRoles({ ...roles, [role]: event.target.checked })}
                />
                {' '}{role === 'HIP' ? 'HIP (share records)' : 'HIU (read records)'}
              </label>
            ))}
          </fieldset>
          <Field label={`HIP name shown to patients (up to ${HIP_NAME_MAX} characters)`} error={nameError}>
            {(a11y) => (
              <input
                {...a11y}
                className="text-input"
                maxLength={HIP_NAME_MAX}
                value={hipName}
                onChange={(event) => setHipName(event.target.value)}
              />
            )}
          </Field>
          <label>
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            {' '}I understand this changes the facility link in the ABDM registry.
          </label>
          <div className="row">
            <Button type="submit" disabled={link.isPending || chosen.length === 0 || !confirmed}>Link facility</Button>
          </div>
          <Alert>{link.error ? link.error.message : null}</Alert>
          {result ? (
            <Alert tone={result.confirmed ? 'ok' : 'warning'}>
              {result.confirmed
                ? `ABDM lists ${result.confirmedRoles.join(' and ')} for this facility.`
                : result.warnings.join(' ')}
            </Alert>
          ) : null}
        </form>
      ) : null}
      {facility?.hfrId && !isAdmin ? <p className="muted">Only an admin can change the link.</p> : null}
    </section>
  );
}
