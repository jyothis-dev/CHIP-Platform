import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/modules/auth/hooks/useAuth.jsx';
import { usePatients } from '../hooks/usePatients.js';
import { useCreatePatient } from '../hooks/useCreatePatient.js';
import { parseCreatePatient } from '../validation/patientSchema.js';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Spinner,
  Table,
} from '@/shared/ui/index.js';
import './Patients.css';

const emptyForm = {
  patientType: 'MOTHER',
  name: '',
  gender: 'F',
  dateOfBirth: '',
  mobile: '',
};

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'dob', label: 'DOB' },
  { key: 'abha', label: 'ABHA' },
  { key: 'managed', label: 'Managed by' },
  { key: 'actions', label: 'Actions' },
];

export default function PatientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [selected, setSelected] = useState(null);
  const [formError, setFormError] = useState('');

  const patientsQuery = usePatients(appliedQuery);
  const createPatient = useCreatePatient();

  const filteredHint = useMemo(
    () => (appliedQuery ? `Showing matches for “${appliedQuery}”.` : 'All facility patients.'),
    [appliedQuery],
  );

  async function onRegister(event) {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});
    const parsed = parseCreatePatient(form);
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0]] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    const body = {
      patientType: parsed.data.patientType,
      name: parsed.data.name,
      gender: parsed.data.gender,
      ...(parsed.data.dateOfBirth ? { dateOfBirth: parsed.data.dateOfBirth } : {}),
      ...(parsed.data.mobile ? { mobile: parsed.data.mobile } : {}),
    };
    try {
      const created = await createPatient.mutateAsync(body);
      setForm(emptyForm);
      setSelected(created);
    } catch (err) {
      setFormError(err.message || 'Could not register patient');
    }
  }

  const patients = patientsQuery.data || [];

  return (
    <section className="patients stack">
      <PageHeader
        title="Patients"
        description={`Register a mother or child, then select one for ABHA enrolment. Acting as ${user?.name} (${user?.role}).`}
      />

      <Alert>{formError || (patientsQuery.isError ? patientsQuery.error.message : '')}</Alert>

      <form className="card stack" onSubmit={onRegister}>
        <h2>Register patient</h2>
        <div className="form-grid two">
          <Field label="Type" error={fieldErrors.patientType}>
            {({ id, ...a11y }) => (
              <Select
                id={id}
                value={form.patientType}
                onChange={(event) => setForm((prev) => ({ ...prev, patientType: event.target.value }))}
                {...a11y}
              >
                <option value="MOTHER">Mother</option>
                <option value="CHILD">Child</option>
              </Select>
            )}
          </Field>
          <Field label="Gender" error={fieldErrors.gender}>
            {({ id, ...a11y }) => (
              <Select
                id={id}
                value={form.gender}
                onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}
                {...a11y}
              >
                <option value="F">Female</option>
                <option value="M">Male</option>
                <option value="O">Other</option>
              </Select>
            )}
          </Field>
          <Field label="Full name" error={fieldErrors.name}>
            {({ id, ...a11y }) => (
              <input
                id={id}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                autoComplete="off"
                {...a11y}
              />
            )}
          </Field>
          <Field label="Date of birth" error={fieldErrors.dateOfBirth}>
            {({ id, ...a11y }) => (
              <input
                id={id}
                type="date"
                value={form.dateOfBirth}
                onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                {...a11y}
              />
            )}
          </Field>
          <Field label="Mobile (optional)" error={fieldErrors.mobile}>
            {({ id, ...a11y }) => (
              <input
                id={id}
                inputMode="numeric"
                maxLength={10}
                value={form.mobile}
                onChange={(event) => setForm((prev) => ({
                  ...prev,
                  mobile: event.target.value.replace(/\D/g, '').slice(0, 10),
                }))}
                autoComplete="off"
                {...a11y}
              />
            )}
          </Field>
        </div>
        <Button type="submit" disabled={createPatient.isPending}>
          {createPatient.isPending ? 'Saving…' : 'Register'}
        </Button>
      </form>

      <div className="card stack">
        <div className="patients-toolbar">
          <h2>Existing patients</h2>
          <form
            className="row"
            onSubmit={(event) => {
              event.preventDefault();
              setAppliedQuery(searchInput.trim());
            }}
          >
            <Field label="Search by name">
              {({ id }) => (
                <input
                  id={id}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Name contains…"
                />
              )}
            </Field>
            <Button type="submit" variant="secondary">Search</Button>
          </form>
        </div>
        <p className="muted">{filteredHint}</p>
        {patientsQuery.isPending ? <Spinner label="Loading patients…" /> : null}
        {!patientsQuery.isPending && patients.length === 0 ? (
          <EmptyState>No patients yet.</EmptyState>
        ) : null}
        {!patientsQuery.isPending && patients.length > 0 ? (
          <Table columns={columns} className="patients-table-wrap">
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td>{patient.name}</td>
                <td>{patient.patientType}</td>
                <td>{patient.dateOfBirth ? String(patient.dateOfBirth).slice(0, 10) : '—'}</td>
                <td>
                  <span className="badge">
                    {patient.abha?.verificationStatus || 'NONE'}
                  </span>
                </td>
                <td>
                  {patient.managedBy
                    ? `${patient.managedBy.name} (${patient.managedBy.role})`
                    : '—'}
                </td>
                <td className="patients-actions">
                  <Button variant="secondary" onClick={() => setSelected(patient)}>
                    Profile
                  </Button>
                  <Button onClick={() => navigate(`/abha?patientId=${patient.id}`)}>
                    Select for ABHA
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : null}
      </div>

      {selected ? (
        <div className="card stack">
          <h2>Patient summary</h2>
          <p><span className="muted">Name</span> {selected.name}</p>
          <p><span className="muted">Type</span> {selected.patientType}</p>
          <p>
            <span className="muted">Managed by</span>{' '}
            {selected.managedBy
              ? `${selected.managedBy.name} (${selected.managedBy.role})`
              : '—'}
          </p>
          <p>
            <span className="muted">ABHA</span>{' '}
            {selected.abha?.abhaNumberMasked || selected.abha?.verificationStatus || 'NONE'}
          </p>
          <p className="row">
            <Link className="btn-primary" to={`/abha?patientId=${selected.id}`}>
              Continue to ABHA
            </Link>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </p>
        </div>
      ) : null}
    </section>
  );
}
