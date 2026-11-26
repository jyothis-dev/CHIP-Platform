import { useState } from 'react';
import { Alert, EmptyState, Spinner } from '@/shared/ui/index.js';
import { useArtefactRecords } from '../hooks/useHiu.js';
import { formatDateTime } from './StatusBadge.jsx';

/** Shows records for one artefact. A revoked or expired consent says so rather than showing an empty list. */
export function RecordViewer({ artefactId, enabled = true }) {
  const records = useArtefactRecords(artefactId, enabled);
  const [raw, setRaw] = useState({});

  if (records.isLoading) return <Spinner label="Loading records…" />;
  if (records.error) {
    const ended = records.error.code === 'CONSENT_REVOKED' || records.error.code === 'CONSENT_EXPIRED';
    const at = records.error.details?.at;
    return (
      <Alert tone={ended ? 'warning' : 'danger'}>
        {ended
          ? `${records.error.code === 'CONSENT_REVOKED' ? 'Consent revoked' : 'Consent expired'}${at ? ` on ${formatDateTime(at)}` : ''}. Records received under it are no longer shown.`
          : `${records.error.code || 'Error'}: ${records.error.message}`}
      </Alert>
    );
  }
  const items = records.data?.items || [];
  if (items.length === 0) return <EmptyState>No records received under this consent yet.</EmptyState>;

  return (
    <ul className="hiu-records">
      {items.map((item) => (
        <li key={item.id} className="card stack">
          <div className="row">
            <strong className="hiu-grow">{item.summary.title || item.hiType}</strong>
            <span className="badge">{item.hiType}</span>
            <span className={`badge ${item.validationStatus === 'VALID' ? '' : 'badge-warn'}`}>{item.validationStatus}</span>
          </div>
          <p className="muted">
            Care context {item.careContextReference} · received {formatDateTime(item.receivedAt)}
            {item.summary.date ? ` · document date ${formatDateTime(item.summary.date)}` : ''}
            {item.checksumOk ? ' · checksum matched' : ''}
          </p>
          {item.summary.sections.length ? (
            <ul className="hiu-sections">
              {item.summary.sections.map((section, index) => (
                <li key={`${section.title}-${index}`}>{section.title || 'Section'} ({section.entries} entr{section.entries === 1 ? 'y' : 'ies'})</li>
              ))}
            </ul>
          ) : null}
          {item.validationProblems.length ? (
            <details>
              <summary>Validation notes</summary>
              <ul>{item.validationProblems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
            </details>
          ) : null}
          <button type="button" className="btn-ghost" onClick={() => setRaw((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}>
            {raw[item.id] ? 'Hide FHIR bundle' : 'Show FHIR bundle'}
          </button>
          {raw[item.id] ? <pre className="hiu-json">{JSON.stringify(item.bundle, null, 2)}</pre> : null}
        </li>
      ))}
    </ul>
  );
}
