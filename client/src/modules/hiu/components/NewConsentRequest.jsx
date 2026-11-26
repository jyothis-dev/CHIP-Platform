import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPatients } from '@/modules/patients/api/patientsApi.js';
import { Alert, Button, Field, Select } from '@/shared/ui/index.js';
import { useCreateConsentRequest, useHiuOptions } from '../hooks/useHiu.js';
import { HI_TYPES, consentRequestSchema, toRequestBody } from '../validation/consentRequestSchema.js';

const empty = {
  patientId: '',
  purposeCode: '',
  hiTypes: [],
  dateFrom: '',
  dateTo: '',
  dataEraseAt: '',
};

function newKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

export function NewConsentRequest({ initialPatientId = '', onCreated }) {
  const [values, setValues] = useState({ ...empty, patientId: initialPatientId });
  const [errors, setErrors] = useState({});
  const [key, setKey] = useState(newKey);
  const options = useHiuOptions();
  const create = useCreateConsentRequest();
  const patients = useQuery({
    queryKey: ['hiu-patients'],
    queryFn: () => listPatients({ page: 1, pageSize: 100 }),
  });
  const withAddress = useMemo(
    () => (patients.data?.items || []).filter((patient) => patient.abha?.abhaAddress),
    [patients.data],
  );

  const set = (name) => (event) => setValues((prev) => ({ ...prev, [name]: event.target.value }));
  const toggleType = (type) => setValues((prev) => ({
    ...prev,
    hiTypes: prev.hiTypes.includes(type) ? prev.hiTypes.filter((t) => t !== type) : [...prev.hiTypes, type],
  }));

  async function submit(event) {
    event.preventDefault();
    const parsed = consentRequestSchema.safeParse(values);
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) next[issue.path[0]] = next[issue.path[0]] || issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const created = await create.mutateAsync({ body: toRequestBody(values), key });
      setKey(newKey());
      setValues({ ...empty });
      onCreated?.(created);
    } catch {
      // shown below from create.error
    }
  }

  const purposes = options.data?.purposes || [];

  return (
    <form className="card stack hiu-form" onSubmit={submit} noValidate>
      <h2>New consent request</h2>
      <div className="hiu-grid">
        <Field label="Patient (ABHA address)" error={errors.patientId}>
          {(props) => (
            <Select {...props} value={values.patientId} onChange={set('patientId')}>
              <option value="">Select a patient</option>
              {withAddress.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} · {patient.abha.abhaAddress}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Purpose of request" error={errors.purposeCode}>
          {(props) => (
            <Select {...props} value={values.purposeCode} onChange={set('purposeCode')}>
              <option value="">Select a purpose</option>
              {purposes.map((purpose) => (
                <option key={purpose.code} value={purpose.code}>{purpose.text}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Health info from" error={errors.dateFrom}>
          {(props) => <input {...props} type="datetime-local" className="text-input" value={values.dateFrom} onChange={set('dateFrom')} />}
        </Field>
        <Field label="Health info to" error={errors.dateTo}>
          {(props) => <input {...props} type="datetime-local" className="text-input" value={values.dateTo} onChange={set('dateTo')} />}
        </Field>
        <Field label="Consent expiry" error={errors.dataEraseAt}>
          {(props) => <input {...props} type="datetime-local" className="text-input" value={values.dataEraseAt} onChange={set('dataEraseAt')} />}
        </Field>
      </div>
      <fieldset className="hiu-types">
        <legend>Health information types</legend>
        {HI_TYPES.map((type) => (
          <label key={type} className="hiu-check">
            <input type="checkbox" checked={values.hiTypes.includes(type)} onChange={() => toggleType(type)} />
            {type}
          </label>
        ))}
        {errors.hiTypes ? <span className="ui-field-error" role="alert">{errors.hiTypes}</span> : null}
      </fieldset>
      {patients.isSuccess && withAddress.length === 0 ? (
        <Alert tone="warning">No patient has an ABHA address yet. Enrol one on the ABHA screen first.</Alert>
      ) : null}
      <Alert>{create.error ? `${create.error.code || 'Error'}: ${create.error.message}` : null}</Alert>
      <div className="row">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Sending…' : 'Raise consent request'}
        </Button>
      </div>
    </form>
  );
}
