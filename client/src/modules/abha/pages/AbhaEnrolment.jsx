import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/modules/auth/hooks/useAuth.jsx';
import { usePatients } from '@/modules/patients/hooks/usePatients.js';
import { useAbhaEnrolment } from '../hooks/useAbhaEnrolment.js';
import {
  parseAadhaarStep,
  parseAddressStep,
  parseConsentStep,
  parseOtpStep,
} from '../validation/abhaSchemas.js';
import {
  Alert,
  Button,
  Field,
  PageHeader,
  Select,
  Spinner,
} from '@/shared/ui/index.js';
import './AbhaEnrolment.css';

const STEPS = {
  CONSENT: 'consent',
  AADHAAR: 'aadhaar',
  OTP: 'otp',
  MOBILE: 'mobile',
  ADDRESS: 'address',
  DONE: 'done',
};

export default function AbhaEnrolmentPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('patientId') || '';
  const headingRef = useRef(null);

  const [step, setStep] = useState(STEPS.CONSENT);
  const [patientFilter, setPatientFilter] = useState('');
  const [patientId, setPatientId] = useState(preselectedId);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [transactionId, setTransactionId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [abhaAddress, setAbhaAddress] = useState('');
  const [result, setResult] = useState(null);
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const patientsQuery = usePatients('');
  const enrolment = useAbhaEnrolment();

  useEffect(() => {
    if (preselectedId) setPatientId(preselectedId);
  }, [preselectedId]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const patients = patientsQuery.data || [];
  const filteredPatients = useMemo(() => {
    const q = patientFilter.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((patient) => patient.name.toLowerCase().includes(q));
  }, [patients, patientFilter]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === patientId) || null,
    [patients, patientId],
  );

  async function run(action) {
    setError('');
    setFieldErrors({});
    try {
      await action();
    } catch (err) {
      setError(err.message || 'Request failed');
    }
  }

  return (
    <section className="abha stack">
      <div tabIndex={-1} ref={headingRef}>
        <PageHeader
          title="ABHA enrolment"
          description={`Aadhaar OTP creation only. Select a registered patient first. Acting as ${user?.name} (${user?.role}).`}
        />
      </div>

      <Alert>{error || (patientsQuery.isError ? patientsQuery.error.message : '')}</Alert>
      {patientsQuery.isPending ? <Spinner label="Loading patients…" /> : null}

      {step === STEPS.CONSENT && !patientsQuery.isPending ? (
        <form
          className="card stack"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseConsentStep({
              consentAccepted: consentAccepted || undefined,
              patientId: patientId || undefined,
            });
            if (!parsed.success) {
              const next = {};
              for (const issue of parsed.error.issues) {
                next[issue.path[0]] = issue.message;
              }
              setFieldErrors(next);
              setError(next.consentAccepted || next.patientId || 'Check the form');
              return;
            }
            setError('');
            setFieldErrors({});
            setStep(STEPS.AADHAAR);
          }}
        >
          <h2>Consent</h2>
          <label className="field checkbox">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
            />
            <span>
              The patient consents to ABHA enrolment (code abha-enrollment, version 1.4).
            </span>
          </label>
          {fieldErrors.consentAccepted ? (
            <Alert>{fieldErrors.consentAccepted}</Alert>
          ) : null}
          <Field label="Filter patients">
            {({ id }) => (
              <input
                id={id}
                value={patientFilter}
                onChange={(event) => setPatientFilter(event.target.value)}
                placeholder="Type a name…"
                autoComplete="off"
              />
            )}
          </Field>
          <Field label="Patient" error={fieldErrors.patientId}>
            {({ id, ...a11y }) => (
              <Select
                id={id}
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                {...a11y}
              >
                <option value="">Select a patient</option>
                {filteredPatients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name} ({patient.patientType})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {selectedPatient ? (
            <div className="abha-selected">
              <p>
                <span className="muted">Selected</span> {selectedPatient.name} · {selectedPatient.patientType}
              </p>
              <p>
                <span className="muted">Managed by</span>{' '}
                {selectedPatient.managedBy
                  ? `${selectedPatient.managedBy.name} (${selectedPatient.managedBy.role})`
                  : '—'}
              </p>
            </div>
          ) : (
            <p className="muted">
              No patient selected. <Link to="/patients">Register one first</Link>.
            </p>
          )}
          <Button type="submit" disabled={!consentAccepted || !patientId}>
            Continue
          </Button>
        </form>
      ) : null}

      {step === STEPS.AADHAAR ? (
        <form
          className="card stack"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseAadhaarStep({ aadhaar, mobile });
            if (!parsed.success) {
              const next = {};
              for (const issue of parsed.error.issues) {
                next[issue.path[0]] = issue.message;
              }
              setFieldErrors(next);
              return;
            }
            run(async () => {
              const data = await enrolment.requestOtp.mutateAsync({
                patientId,
                aadhaar: parsed.data.aadhaar,
              });
              setTransactionId(data.transactionId);
              setAadhaar('');
              setStep(STEPS.OTP);
            });
          }}
        >
          <h2>Aadhaar</h2>
          {selectedPatient ? (
            <p className="muted">
              Enrolling {selectedPatient.name}
              {selectedPatient.managedBy
                ? ` · managed by ${selectedPatient.managedBy.name}`
                : ''}
            </p>
          ) : null}
          <Field label="Aadhaar number" error={fieldErrors.aadhaar}>
            {({ id, ...a11y }) => (
              <input
                id={id}
                inputMode="numeric"
                pattern="\d{12}"
                maxLength={12}
                value={aadhaar}
                onChange={(event) => setAadhaar(event.target.value.replace(/\D/g, '').slice(0, 12))}
                autoComplete="off"
                {...a11y}
              />
            )}
          </Field>
          <Field label="Communication mobile (optional)" error={fieldErrors.mobile}>
            {({ id, ...a11y }) => (
              <input
                id={id}
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={(event) => setMobile(event.target.value.replace(/\D/g, '').slice(0, 10))}
                autoComplete="off"
                {...a11y}
              />
            )}
          </Field>
          <Button type="submit" disabled={enrolment.isBusy || aadhaar.length !== 12}>
            Request OTP
          </Button>
        </form>
      ) : null}

      {step === STEPS.OTP ? (
        <form
          className="card stack"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseOtpStep({ otp });
            if (!parsed.success) {
              setFieldErrors({ otp: parsed.error.issues[0]?.message });
              return;
            }
            run(async () => {
              const data = await enrolment.verifyOtp.mutateAsync({
                transactionId,
                otp: parsed.data.otp,
                consentAccepted: true,
                ...(mobile ? { mobile } : {}),
              });
              setOtp('');
              setResult(data);
              if (data.needsMobileVerify) {
                setStep(STEPS.MOBILE);
              } else {
                const suggested = await enrolment.loadSuggestions.mutateAsync(transactionId);
                setSuggestions(suggested.suggestions || []);
                setStep(STEPS.ADDRESS);
              }
            });
          }}
        >
          <h2>Aadhaar OTP</h2>
          <p className="muted">Transaction {transactionId}</p>
          <Field label="OTP" error={fieldErrors.otp}>
            {({ id, ...a11y }) => (
              <input
                id={id}
                inputMode="numeric"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                autoComplete="one-time-code"
                {...a11y}
              />
            )}
          </Field>
          <Button type="submit" disabled={enrolment.isBusy}>
            Verify and enrol
          </Button>
        </form>
      ) : null}

      {step === STEPS.MOBILE ? (
        <form
          className="card stack"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseOtpStep({ otp: mobileOtp });
            if (!parsed.success) {
              setFieldErrors({ otp: parsed.error.issues[0]?.message });
              return;
            }
            run(async () => {
              await enrolment.verifyMobile.mutateAsync({
                transactionId,
                otp: parsed.data.otp,
              });
              setMobileOtp('');
              const suggested = await enrolment.loadSuggestions.mutateAsync(transactionId);
              setSuggestions(suggested.suggestions || []);
              setStep(STEPS.ADDRESS);
            });
          }}
        >
          <h2>Mobile OTP</h2>
          <Field label="OTP sent to the communication mobile" error={fieldErrors.otp}>
            {({ id, ...a11y }) => (
              <input
                id={id}
                inputMode="numeric"
                value={mobileOtp}
                onChange={(event) => setMobileOtp(event.target.value)}
                autoComplete="one-time-code"
                {...a11y}
              />
            )}
          </Field>
          <Button type="submit" disabled={enrolment.isBusy}>
            Verify mobile
          </Button>
        </form>
      ) : null}

      {step === STEPS.ADDRESS ? (
        <form
          className="card stack"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseAddressStep({ abhaAddress });
            if (!parsed.success) {
              setFieldErrors({ abhaAddress: parsed.error.issues[0]?.message });
              return;
            }
            run(async () => {
              const data = await enrolment.createAddress.mutateAsync({
                transactionId,
                abhaAddress: parsed.data.abhaAddress,
              });
              setResult((prev) => ({ ...prev, ...data }));
              try {
                const cardData = await enrolment.loadCard.mutateAsync(transactionId);
                setCard(cardData);
              } catch {
                setCard(null);
              }
              setStep(STEPS.DONE);
            });
          }}
        >
          <h2>ABHA address</h2>
          {suggestions.length > 0 ? (
            <Field label="Suggestions">
              {({ id }) => (
                <Select
                  id={id}
                  value={abhaAddress}
                  onChange={(event) => setAbhaAddress(event.target.value)}
                >
                  <option value="">Select an address</option>
                  {suggestions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <Field label="ABHA address" error={fieldErrors.abhaAddress}>
            {({ id, ...a11y }) => (
              <input
                id={id}
                value={abhaAddress}
                onChange={(event) => setAbhaAddress(event.target.value)}
                autoComplete="off"
                {...a11y}
              />
            )}
          </Field>
          <Button type="submit" disabled={enrolment.isBusy || !abhaAddress}>
            Create address
          </Button>
        </form>
      ) : null}

      {step === STEPS.DONE && result ? (
        <div className="card stack abha-result">
          <h2>Enrolment result</h2>
          <p><span className="muted">Masked ABHA</span> {result.abhaNumberMasked || '—'}</p>
          <p><span className="muted">Address</span> {result.abhaAddress || '—'}</p>
          <p><span className="muted">Status</span> {result.status}</p>
          {typeof result.isNew === 'boolean' ? (
            <p><span className="muted">New ABHA</span> {result.isNew ? 'yes' : 'existing account'}</p>
          ) : null}
          {card?.imageBase64 ? (
            <img
              className="abha-card"
              alt="ABHA card"
              src={`data:${card.contentType || 'image/png'};base64,${card.imageBase64}`}
            />
          ) : (
            <p className="muted">Card image unavailable for this session.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
