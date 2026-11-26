import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/modules/auth/hooks/useAuth.jsx';
import { Alert, Button, PageHeader, Spinner } from '@/shared/ui/index.js';
import { useConsentRequest, useHiuAction } from '../hooks/useHiu.js';
import { RecordViewer } from '../components/RecordViewer.jsx';
import { StatusBadge, formatDateTime, statusTime } from '../components/StatusBadge.jsx';
import './Consents.css';

const CLINICAL = new Set(['CLINICIAN', 'ADMIN']);

function same(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function Compare({ label, requested, granted, format = (v) => v }) {
  const changed = granted !== undefined && granted !== null && !same(requested, granted);
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{format(requested)}</td>
      <td className={changed ? 'hiu-changed' : ''}>
        {granted === undefined || granted === null ? '—' : format(granted)}
        {changed ? <span className="badge badge-warn">edited by patient</span> : null}
      </td>
    </tr>
  );
}

function errorText(error) {
  return error ? `${error.code || 'Error'}: ${error.message}` : null;
}

function newKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function Artefact({ artefact, requested, actions, clinical }) {
  const [open, setOpen] = useState(false);
  const types = (list) => (list || []).join(', ');
  const latest = artefact.informationRequests[0];
  const usable = artefact.status === 'GRANTED' && artefact.fetchedAt;
  const ended = artefact.status === 'REVOKED' || artefact.status === 'EXPIRED';

  return (
    <article className="card stack">
      <div className="row">
        <h3 className="hiu-grow">
          {artefact.hipName || artefact.hipId || 'HIP not known yet'}
          <span className="muted hiu-small"> · artefact {artefact.externalArtefactId}</span>
        </h3>
        <StatusBadge status={artefact.status} />
      </div>
      {artefact.revokedAt ? <p className="muted">Revoked on {formatDateTime(artefact.revokedAt)}</p> : null}
      {artefact.expiredAt ? <p className="muted">Expired on {formatDateTime(artefact.expiredAt)}</p> : null}
      {artefact.lastErrorMessage ? <Alert>{artefact.lastErrorCode}: {artefact.lastErrorMessage}</Alert> : null}
      {!artefact.fetchedAt && !ended ? <p className="muted">Waiting for the consent artefact from ABDM…</p> : null}
      {artefact.fetchedAt ? (
        <table className="hiu-compare">
          <thead><tr><th /><th>Requested</th><th>Granted</th></tr></thead>
          <tbody>
            <Compare label="HI types" requested={requested.hiTypes} granted={artefact.hiTypes} format={types} />
            <Compare label="Health info from" requested={requested.dateFrom} granted={artefact.dateFrom} format={formatDateTime} />
            <Compare label="Health info to" requested={requested.dateTo} granted={artefact.dateTo} format={formatDateTime} />
            <Compare label="Consent expiry" requested={requested.dataEraseAt} granted={artefact.dataEraseAt} format={formatDateTime} />
          </tbody>
        </table>
      ) : null}
      {clinical ? (
        <div className="row">
          <Button variant="ghost" disabled={actions.fetch.isPending || ended} onClick={() => actions.fetch.mutate(artefact.id)}>
            Fetch artefact
          </Button>
          <Button
            disabled={!usable || actions.request.isPending}
            onClick={() => actions.request.mutate({ artefactId: artefact.id, key: newKey() })}
          >
            Request records
          </Button>
          <Button variant="ghost" onClick={() => setOpen((value) => !value)}>
            {open ? 'Hide records' : 'View records'}
          </Button>
        </div>
      ) : <p className="muted">Records are visible to clinicians only.</p>}
      {latest ? (
        <p className="muted">
          Last data request: {latest.status}
          {latest.pagesExpected ? ` · ${latest.pagesReceived} of ${latest.pagesExpected} page(s)` : ''}
          {latest.lastErrorMessage ? ` · ${latest.lastErrorCode}: ${latest.lastErrorMessage}` : ''}
          {' '}· {formatDateTime(latest.createdAt)}
        </p>
      ) : null}
      {latest?.transfers?.length ? (
        <ul className="hiu-sections">
          {latest.transfers.map((item, index) => (
            <li key={`${item.careContextReference}-${index}`}>
              {item.careContextReference || 'page'}: {item.status} {item.receiptStatus ? `(${item.receiptStatus})` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {open && clinical ? <RecordViewer artefactId={artefact.id} /> : null}
    </article>
  );
}

export default function ConsentRequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const detail = useConsentRequest(id);
  const actions = useHiuAction(id);
  const clinical = CLINICAL.has(user?.role);

  if (detail.isLoading) return <Spinner label="Loading consent request…" />;
  if (detail.error) return <Alert>{errorText(detail.error)}</Alert>;
  const row = detail.data;

  return (
    <section className="stack hiu-page">
      <p><Link to="/consents">← All consent requests</Link></p>
      <PageHeader title={`Consent request · ${row.patient?.name || row.abhaAddress}`} />
      <div className="card stack">
        <div className="row">
          <StatusBadge status={row.status} />
          <span className="muted">since {formatDateTime(statusTime(row))}</span>
          <span className="hiu-grow" />
          <Button
            variant="ghost"
            disabled={!row.externalConsentRequestId || actions.status.isPending}
            onClick={() => actions.status.mutate()}
          >
            Check status with ABDM
          </Button>
        </div>
        {row.lastErrorMessage ? <Alert>{row.lastErrorCode}: {row.lastErrorMessage}</Alert> : null}
        <Alert>{errorText(actions.status.error || actions.fetch.error || actions.request.error)}</Alert>
        <dl className="hiu-facts">
          <dt>Patient</dt><dd>{row.patient?.name || '—'}</dd>
          <dt>ABHA address</dt><dd>{row.abhaAddress}</dd>
          <dt>ABHA number</dt><dd>{row.patient?.abhaNumberMasked || '—'}</dd>
          <dt>Purpose</dt><dd>{row.purposeText || row.purposeCode}</dd>
          <dt>HI types requested</dt><dd>{row.hiTypes.join(', ')}</dd>
          <dt>Health info from – to</dt><dd>{formatDateTime(row.dateFrom)} – {formatDateTime(row.dateTo)}</dd>
          <dt>Consent created on</dt><dd>{formatDateTime(row.createdAt)}</dd>
          <dt>Consent expiry on</dt><dd>{formatDateTime(row.dataEraseAt)}</dd>
          <dt>Granted</dt><dd>{formatDateTime(row.grantedAt)}</dd>
          <dt>Denied</dt><dd>{formatDateTime(row.deniedAt)}</dd>
          <dt>Expired</dt><dd>{formatDateTime(row.expiredAt)}</dd>
          <dt>Revoked</dt><dd>{formatDateTime(row.revokedAt)}</dd>
          <dt>ABDM consent request id</dt><dd>{row.externalConsentRequestId || 'waiting for on-init'}</dd>
        </dl>
        {row.status === 'DENIED' || row.status === 'EXPIRED' ? (
          <p className="muted">No health data is accessible for this request.</p>
        ) : null}
      </div>

      <h2>Consent artefacts ({row.artefacts.length})</h2>
      {row.artefacts.length === 0 ? <p className="muted">No artefact yet. One arrives per HIP when the patient grants.</p> : null}
      {row.artefacts.map((artefact) => (
        <Artefact key={artefact.id} artefact={artefact} requested={row.requested} actions={actions} clinical={clinical} />
      ))}

      <details className="card">
        <summary>ABDM timeline ({row.timeline.length} calls)</summary>
        <ul className="hiu-sections">
          {row.timeline.map((item) => (
            <li key={item.requestId}>
              {formatDateTime(item.createdAt)} · {item.workflow} · HTTP {item.httpStatus ?? '—'} · {item.status}
              {item.lastErrorCode ? ` · ${item.lastErrorCode}` : ''}
              <span className="muted"> · REQUEST-ID {item.requestId}</span>
              {item.callbacks.map((cb) => (
                <div key={`${cb.route}-${cb.receivedAt}`} className="muted hiu-small">
                  ↳ {cb.route} · {cb.processingStatus} · {formatDateTime(cb.receivedAt)}
                </div>
              ))}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
