import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api/http.js';
import { usePatients } from '@/modules/patients/hooks/usePatients.js';
import { Alert, Button, Field, PAGE_SIZE, PageHeader, Pagination, Select, Spinner } from '@/shared/ui/index.js';
import './HipRecords.css';

const HI_TYPES = [
  'ImmunizationRecord',
  'Prescription',
  'DiagnosticReport',
  'OPConsultation',
  'DischargeSummary',
  'HealthDocumentRecord',
  'WellnessRecord',
  'Invoice',
];

export default function HipRecordsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientId = searchParams.get('patientId') || '';
  const [patientPage, setPatientPage] = useState(1);
  const [contextPage, setContextPage] = useState(1);
  const [exchangePage, setExchangePage] = useState(1);
  const patients = usePatients('', patientPage);
  const readiness = useQuery({ queryKey: ['hip-readiness'], queryFn: () => http.get('/hip/readiness') });
  const exchanges = useQuery({
    queryKey: ['hip-exchanges', exchangePage],
    queryFn: () => http.get('/hip/exchanges', { params: { page: exchangePage, pageSize: PAGE_SIZE } }),
  });
  const [form, setForm] = useState({
    hiType: 'ImmunizationRecord',
    occurredAt: new Date().toISOString(),
    title: '',
    code: '',
    codeDisplay: '',
    codeSystem: 'http://snomed.info/sct',
  });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  const [bridgeMessage, setBridgeMessage] = useState('');
  const [registering, setRegistering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retryingId, setRetryingId] = useState('');
  const [retryNote, setRetryNote] = useState(null);

  const records = useQuery({
    queryKey: ['hip-records', patientId, contextPage],
    queryFn: () => http.get(`/hip/patients/${patientId}/records`, {
      params: { page: contextPage, pageSize: PAGE_SIZE },
    }),
    enabled: Boolean(patientId),
  });

  const patientRows = patients.data?.items || [];
  const selected = patientRows.find((row) => row.id === patientId);

  async function inspect() {
    setError('');
    setPreview(null);
    if (!selected) {
      setError('Select a patient first.');
      return;
    }
    try {
      const data = await http.post('/hip/bundles/inspect', {
        ...form,
        patientId: selected.id,
        patientName: selected.name,
        gender: selected.gender,
        birthDate: selected.dateOfBirth ? String(selected.dateOfBirth).slice(0, 10) : undefined,
      });
      setPreview(data);
    } catch (err) {
      setError(err.message || 'The bundle was refused');
    }
  }

  async function save() {
    if (saving) return;
    setError('');
    setSaved(null);
    setRetryNote(null);
    setSaving(true);
    try {
      const data = await http.post(`/hip/patients/${patientId}/records`, form);
      setSaved(data);
      queryClient.invalidateQueries({ queryKey: ['hip-records', patientId] });
      queryClient.invalidateQueries({ queryKey: ['hip-exchanges'] });
    } catch (err) {
      setError(err.message || 'The record was not saved');
    } finally {
      setSaving(false);
    }
  }

  async function retry(id) {
    if (retryingId) return;
    setError('');
    setSaved(null);
    setRetryNote(null);
    setRetryingId(id);
    try {
      const data = await http.post(`/hip/care-contexts/${id}/retry`);
      setRetryNote(data);
      queryClient.invalidateQueries({ queryKey: ['hip-records', patientId] });
      queryClient.invalidateQueries({ queryKey: ['hip-exchanges'] });
    } catch (err) {
      setError(err.message || 'The link could not be retried');
    } finally {
      setRetryingId('');
    }
  }

  async function registerCallback() {
    setError('');
    setBridgeMessage('');
    setRegistering(true);
    try {
      const data = await http.post('/hip/bridge/url', { confirm: true });
      setBridgeMessage(`Callback URL registered. Request ${data.requestId}.`);
      queryClient.invalidateQueries({ queryKey: ['hip-readiness'] });
    } catch (err) {
      setError(err.message || 'ABDM did not accept the callback URL');
    } finally {
      setRegistering(false);
    }
  }

  return (
    <section className="stack hip-page">
      <PageHeader title="Health records" description="Visits, linking, and what ABDM can already see." />
      {readiness.isLoading ? <Spinner label="Checking HIP readinessâ€¦" /> : null}
      {readiness.data ? (
        <Readiness
          data={readiness.data}
          registering={registering}
          onRegister={registerCallback}
        />
      ) : null}
      {bridgeMessage ? <Alert tone="ok">{bridgeMessage}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <label className="hip-field">
        <span>Patient</span>
        <Select value={patientId} onChange={(event) => {
          setContextPage(1);
          const next = new URLSearchParams(searchParams);
          if (event.target.value) next.set('patientId', event.target.value);
          else next.delete('patientId');
          setSearchParams(next);
        }}>
          <option value="">Select a patient</option>
          {patientId && !patientRows.some((row) => row.id === patientId) ? (
            <option value={patientId}>Selected patient</option>
          ) : null}
          {patientRows.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </Select>
      </label>
      {!patients.isPending && !patients.isError && (patients.data?.total || 0) > 0 ? (
        <Pagination
          page={patientPage}
          pageSize={PAGE_SIZE}
          total={patients.data.total}
          disabled={patients.isFetching}
          onPageChange={setPatientPage}
        />
      ) : null}

      {records.data ? (
        <p className="muted">
          Visits {records.data.counts.visits}. Documents {records.data.counts.documents}.
          Not findable elsewhere {records.data.counts.notFindable}.
        </p>
      ) : null}

      <div className="hip-grid">
        <Field label="HI type">
          <Select value={form.hiType} onChange={(event) => setForm({ ...form, hiType: event.target.value })}>
            {HI_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </Select>
        </Field>
        <Field label="When">
          <input className="text-input" value={form.occurredAt} onChange={(event) => setForm({ ...form, occurredAt: event.target.value })} />
        </Field>
        <Field label="Title">
          <input className="text-input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </Field>
        <Field label="Code system">
          <Select value={form.codeSystem} onChange={(event) => setForm({ ...form, codeSystem: event.target.value })}>
            <option value="http://snomed.info/sct">SNOMED CT</option>
            <option value="http://loinc.org">LOINC</option>
          </Select>
        </Field>
        <Field label="Code">
          <input className="text-input" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        </Field>
        <Field label="Code display">
          <input className="text-input" value={form.codeDisplay} onChange={(event) => setForm({ ...form, codeDisplay: event.target.value })} />
        </Field>
      </div>
      <p className="row">
        <Button type="button" variant="secondary" onClick={inspect} disabled={saving}>Inspect bundle</Button>
        <Button type="button" onClick={save} disabled={!patientId || saving} aria-busy={saving}>
          {saving ? 'Saving…' : 'Save record'}
        </Button>
      </p>
      {preview ? (
        <pre className="hip-preview">{JSON.stringify(preview, null, 2)}</pre>
      ) : null}
      {saved ? (
        <Alert tone={saved.careContext.linkStatus === 'FAILED' ? 'danger' : 'ok'}>
          Saved. Link status {saved.careContext.linkStatus}
          {saved.link.code ? ` (${saved.link.code})` : ''}
          {saved.link.message ? `: ${saved.link.message}` : ''}.
          {saved.link.hint ? ` ${saved.link.hint}` : ''}
          {saved.link.callbackWarning ? ` ${saved.link.callbackWarning}` : ''}
        </Alert>
      ) : null}
      {retryNote ? (
        <Alert tone={retryNote.link.linkStatus === 'FAILED' ? 'danger' : 'ok'}>
          Retry sent. Link status {retryNote.careContext.linkStatus}
          {retryNote.link.code ? ` (${retryNote.link.code})` : ''}
          {retryNote.link.message ? `: ${retryNote.link.message}` : ''}.
          {retryNote.link.hint ? ` ${retryNote.link.hint}` : ''}
        </Alert>
      ) : null}

      <h2>Care contexts</h2>
      {!patientId ? <p className="muted">Select a patient to see saved care contexts.</p> : null}
      <ul className="hip-list">
        {(records.data?.careContexts?.items || []).map((row) => (
          <li key={row.id}>
            <strong>{row.display}</strong>
            <span>{row.linkStatus}</span>
            <span>{row.hiType}</span>
            <span>{row.validationStatus}</span>
            {row.sourceHash ? <span>hash {row.sourceHash.slice(0, 12)}</span> : null}
            {row.byteLength ? <span>{row.byteLength} bytes</span> : null}
            {row.failure ? (
              <span className="hip-failure">
                {[row.failure.code, row.failure.message].filter(Boolean).join(': ') || 'No error recorded'}
                {row.failure.hint ? ` ${row.failure.hint}` : ''}
              </span>
            ) : null}
            {row.linkStatus === 'FAILED' || row.linkStatus === 'NOT_LINKED' ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => retry(row.id)}
                disabled={Boolean(retryingId) || row.failure?.retryable === false}
                title={row.failure?.retryable === false ? 'A retry cannot succeed. See the note above.' : undefined}
                aria-busy={retryingId === row.id}
              >
                {retryingId === row.id ? 'Linking…' : (row.linkStatus === 'NOT_LINKED' ? 'Link now' : 'Retry link')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {records.data?.careContexts?.total > 0 ? (
        <Pagination
          page={contextPage}
          pageSize={PAGE_SIZE}
          total={records.data.careContexts.total}
          disabled={records.isFetching}
          onPageChange={setContextPage}
        />
      ) : null}

      <h2>Exchanges</h2>
      <ul className="hip-list">
        {(exchanges.data?.items || []).map((row) => (
          <li key={row.requestId}>
            <strong>{row.workflow}</strong>
            <span>{row.status}</span>
            <span>request {row.requestId.slice(0, 8)}</span>
            <span>{row.callbacks.length} callback{row.callbacks.length === 1 ? '' : 's'}</span>
            {row.errorCode ? (
              <span className="hip-failure">
                {[row.errorCode, row.errorMessage].filter(Boolean).join(': ')}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {(exchanges.data?.total || 0) > 0 ? (
        <Pagination
          page={exchangePage}
          pageSize={PAGE_SIZE}
          total={exchanges.data.total}
          disabled={exchanges.isFetching}
          onPageChange={setExchangePage}
        />
      ) : null}
    </section>
  );
}

function Readiness({ data, registering, onRegister }) {
  const registeredUrl = data.bridge?.url || '';
  const callbackBase = data.callbackBase || '';
  const matches = Boolean(
    callbackBase
    && registeredUrl
    && registeredUrl.replace(/\/$/, '') === callbackBase.replace(/\/$/, ''),
  );
  return (
    <div className="hip-readiness">
      {data.blockers.map((item) => <Alert key={item} tone="danger">{item}</Alert>)}
      {data.warnings.map((item) => <Alert key={item} tone="warning">{item}</Alert>)}
      {callbackBase ? <p className="muted">Callback URL {callbackBase}</p> : null}
      {matches ? <p className="muted">This callback URL is registered on the bridge.</p> : null}
      {data.bridge?.hipServiceId ? <p className="muted">Bridge HIP service is present.</p> : null}
      {callbackBase ? (
        <Button type="button" onClick={onRegister} disabled={registering}>
          {registering ? 'Registering callback URLâ€¦' : 'Register callback URL'}
        </Button>
      ) : null}
    </div>
  );
}
