import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api/http.js';
import { usePatients } from '@/modules/patients/hooks/usePatients.js';
import { Alert, Button, Field, PageHeader, Select, Spinner } from '@/shared/ui/index.js';
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
  const patients = usePatients('');
  const readiness = useQuery({ queryKey: ['hip-readiness'], queryFn: () => http.get('/hip/readiness') });
  const exchanges = useQuery({ queryKey: ['hip-exchanges'], queryFn: () => http.get('/hip/exchanges') });
  const [patientId, setPatientId] = useState('');
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

  const records = useQuery({
    queryKey: ['hip-records', patientId],
    queryFn: () => http.get(`/hip/patients/${patientId}/records`),
    enabled: Boolean(patientId),
  });

  const selected = (patients.data || []).find((row) => row.id === patientId);

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
        facilityName: 'Facility',
      });
      setPreview(data);
    } catch (err) {
      setError(err.message || 'The bundle was refused');
    }
  }

  async function save() {
    setError('');
    setSaved(null);
    try {
      const data = await http.post(`/hip/patients/${patientId}/records`, form);
      setSaved(data);
      queryClient.invalidateQueries({ queryKey: ['hip-records', patientId] });
      queryClient.invalidateQueries({ queryKey: ['hip-exchanges'] });
    } catch (err) {
      setError(err.message || 'The record was not saved');
    }
  }

  return (
    <section className="stack hip-page">
      <PageHeader title="Health records" description="Visits, linking, and what ABDM can already see." />
      {readiness.isLoading ? <Spinner label="Checking HIP readiness…" /> : null}
      {readiness.data ? <Readiness data={readiness.data} /> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <label className="hip-field">
        <span>Patient</span>
        <Select value={patientId} onChange={(event) => setPatientId(event.target.value)}>
          <option value="">Select a patient</option>
          {(patients.data || []).map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </Select>
      </label>

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
        <Button type="button" variant="secondary" onClick={inspect}>Inspect bundle</Button>
        <Button type="button" onClick={save} disabled={!patientId}>Save record</Button>
      </p>
      {preview ? (
        <pre className="hip-preview">{JSON.stringify(preview, null, 2)}</pre>
      ) : null}
      {saved ? (
        <Alert tone="ok">
          Saved. Link status {saved.careContext.linkStatus}
          {saved.link.code ? ` (${saved.link.code})` : ''}.
          {saved.link.callbackWarning ? ` ${saved.link.callbackWarning}` : ''}
        </Alert>
      ) : null}

      <h2>Care contexts</h2>
      <ul className="hip-list">
        {(records.data?.careContexts || []).map((row) => (
          <li key={row.id}>
            <strong>{row.display}</strong>
            <span>{row.linkStatus}</span>
            <span>{row.hiType}</span>
            <span>{row.validationStatus}</span>
            {row.sourceHash ? <span>hash {row.sourceHash.slice(0, 12)}</span> : null}
            {row.byteLength ? <span>{row.byteLength} bytes</span> : null}
          </li>
        ))}
      </ul>

      <h2>Exchanges</h2>
      <ul className="hip-list">
        {(exchanges.data || []).map((row) => (
          <li key={row.requestId}>
            <strong>{row.workflow}</strong>
            <span>{row.status}</span>
            <span>request {row.requestId.slice(0, 8)}</span>
            <span>{row.callbacks.length} callback{row.callbacks.length === 1 ? '' : 's'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Readiness({ data }) {
  return (
    <div className="hip-readiness">
      {data.blockers.map((item) => <Alert key={item} tone="danger">{item}</Alert>)}
      {data.warnings.map((item) => <Alert key={item} tone="warning">{item}</Alert>)}
      {data.bridge?.hipServiceId ? <p className="muted">Bridge HIP service is present.</p> : null}
    </div>
  );
}
