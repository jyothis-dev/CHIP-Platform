import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, EmptyState, PAGE_SIZE, PageHeader, Pagination, Select, Spinner, Table,
} from '@/shared/ui/index.js';
import { useConsentRequests, useHiuReadiness } from '../hooks/useHiu.js';
import { NewConsentRequest } from '../components/NewConsentRequest.jsx';
import { StatusBadge, formatDateTime, statusTime } from '../components/StatusBadge.jsx';
import './Consents.css';

const COLUMNS = [
  { key: 'patient', label: 'Patient' },
  { key: 'abha', label: 'ABHA address / number' },
  { key: 'types', label: 'HI types' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'range', label: 'Health info from – to' },
  { key: 'created', label: 'Created on' },
  { key: 'expiry', label: 'Consent expiry' },
  { key: 'status', label: 'Status' },
  { key: 'changed', label: 'Status at' },
];

export function ReadinessNotice() {
  const readiness = useHiuReadiness();
  const blockers = readiness.data?.blockers || [];
  if (!blockers.length) return null;
  return (
    <Alert tone="warning">
      {blockers.map((line) => <span key={line} className="hiu-line">{line}</span>)}
    </Alert>
  );
}

export default function ConsentRequestsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const list = useConsentRequests({ page, pageSize: PAGE_SIZE, status: status || undefined });
  const data = list.data;

  return (
    <section className="stack hiu-page">
      <PageHeader
        title="Consents (HIU)"
        description="Request a patient's records from other providers through their consent manager. Only a granted, unexpired, unrevoked consent shows records."
      />
      <ReadinessNotice />
      <NewConsentRequest
        initialPatientId={params.get('patientId') || ''}
        onCreated={(created) => navigate(`/consents/${created.id}`)}
      />

      <div className="row">
        <h2 className="hiu-grow">Consent requests</h2>
        <Select aria-label="Filter by status" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
          <option value="">All statuses</option>
          {['REQUESTED', 'GRANTED', 'DENIED', 'EXPIRED', 'REVOKED', 'INIT_FAILED'].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </Select>
      </div>
      {list.isLoading ? <Spinner label="Loading consent requests…" /> : null}
      <Alert>{list.error ? list.error.message : null}</Alert>
      {data && data.items.length === 0 ? <EmptyState>No consent requests yet.</EmptyState> : null}
      {data && data.items.length > 0 ? (
        <>
          <Table columns={COLUMNS}>
            {data.items.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/consents/${row.id}`}>{row.patient?.name || '—'}</Link></td>
                <td>
                  <div>{row.abhaAddress}</div>
                  <div className="muted">{row.patient?.abhaNumberMasked || ''}</div>
                </td>
                <td>{row.hiTypes.join(', ')}</td>
                <td>{row.purposeText || row.purposeCode}</td>
                <td>{formatDateTime(row.dateFrom)} – {formatDateTime(row.dateTo)}</td>
                <td>{formatDateTime(row.createdAt)}</td>
                <td>{formatDateTime(row.dataEraseAt)}</td>
                <td>
                  <StatusBadge status={row.status} />
                  {row.lastErrorMessage ? <div className="error hiu-small">{row.lastErrorCode}: {row.lastErrorMessage}</div> : null}
                </td>
                <td>{formatDateTime(statusTime(row))}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      ) : null}
    </section>
  );
}
