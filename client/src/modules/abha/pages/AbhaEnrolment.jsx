import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/modules/auth/hooks/useAuth.jsx';
import { usePatients } from '@/modules/patients/hooks/usePatients.js';
import { useAbhaEnrolment } from '../hooks/useAbhaEnrolment.js';
import {
  DECLARATIONS,
  TERMS_TEXT,
} from '../consentCopy.js';
import {
  AADHAAR_INVALID_MESSAGE,
  abhaAddressRules,
  parseAadhaarStep,
  parseAddressStep,
  parseConsentStep,
  parseOtpStep,
} from '../validation/abhaSchemas.js';
import {
  Alert,
  Button,
  Field,
  PAGE_SIZE,
  PageHeader,
  Pagination,
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

const RESEND_LIMIT_MESSAGE = 'Maximum OTP resend attempts reached. Please try again after 30 mins';
const ADDRESS_RULES = [
  { key: 'lengthOk', label: 'length 8 to 18, including @sbx or @abdm' },
  { key: 'charsetOk', label: 'letters, digits, or both' },
  { key: 'specialsOk', label: 'at most one dot and one underscore, neither first nor last' },
];

function EyeIcon({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {open ? (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          d="M4 20L20 4"
        />
      ) : null}
    </svg>
  );
}

const emptyConsent = {
  termsAgreed: false,
  shareAadhaar: false,
  otherDocument: false,
  linkRecords: false,
  shareRecords: false,
  anonymize: false,
  workerConfirmed: false,
  beneficiaryConfirmed: false,
};

function expiryMs(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : Date.now() + 10 * 60 * 1000;
}

function OtpClock({ expiresAt, onExpired }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (expiresAt && expiresAt <= now) onExpired?.();
  }, [expiresAt, now, onExpired]);

  if (!expiresAt) return null;
  const left = Math.max(0, expiresAt - now);
  if (left === 0) {
    return <p className="abha-error">This OTP expired after 10 minutes. Request a new OTP.</p>;
  }
  const mins = Math.floor(left / 60000);
  const secs = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  return <p className="muted">OTP is valid for {mins}:{secs}.</p>;
}

function OtpResend({
  channel,
  transactionId,
  enrolment,
  onMessage,
  onError,
  onIssued,
}) {
  const [used, setUsed] = useState(0);
  const [wait, setWait] = useState(60);
  const [limitMessage, setLimitMessage] = useState('');

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setInterval(() => {
      setWait((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [wait]);

  async function onResend() {
    if (used >= 2) {
      setLimitMessage(RESEND_LIMIT_MESSAGE);
      return;
    }
    const data = await enrolment.resendOtp.mutateAsync({ transactionId, channel });
    const next = data.resendCount ?? used + 1;
    setUsed(next);
    setWait(60);
    if (next >= 2) setLimitMessage('');
    if (data.message) onMessage(data.message);
    if (data.otpExpiresAt) onIssued?.(data.otpExpiresAt);
  }

  return (
    <div className="otp-resend">
      <p className="otp-counter">OTP resends used: {used} of 2</p>
      {limitMessage ? <p className="abha-error">{limitMessage}</p> : null}
      <Button
        type="button"
        variant="secondary"
        disabled={wait > 0 || used >= 2 || enrolment.isBusy}
        onClick={() => {
          onResend().catch((err) => {
            if (err.code === 'OTP_RESEND_LIMIT') {
              setUsed(2);
              setLimitMessage(RESEND_LIMIT_MESSAGE);
            }
            onError(err.message || 'Could not resend the OTP');
          });
        }}
      >
        {used >= 2 ? 'Resend OTP' : wait > 0 ? `Resend OTP in ${wait}s` : 'Resend OTP'}
      </Button>
      {used >= 2 ? <p className="abha-error">{RESEND_LIMIT_MESSAGE}</p> : null}
    </div>
  );
}

export default function AbhaEnrolmentPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('patientId') || '';
  const headingRef = useRef(null);

  const [step, setStep] = useState(STEPS.CONSENT);
  const [patientFilter, setPatientFilter] = useState('');
  const [patientPage, setPatientPage] = useState(1);
  const [patientId, setPatientId] = useState(preselectedId);
  const [consent, setConsent] = useState(emptyConsent);
  const [aadhaar, setAadhaar] = useState('');
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [aadhaarTouched, setAadhaarTouched] = useState(false);
  const [otp, setOtp] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [transactionId, setTransactionId] = useState(null);
  const [otpMessage, setOtpMessage] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [otpExpired, setOtpExpired] = useState(false);
  const [mobileMessage, setMobileMessage] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [abhaAddress, setAbhaAddress] = useState('');
  const [addressTaken, setAddressTaken] = useState(false);
  const [result, setResult] = useState(null);
  const [card, setCard] = useState(null);
  const [cardNote, setCardNote] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const patientsQuery = usePatients(patientFilter.trim(), patientPage);
  const enrolment = useAbhaEnrolment();

  useEffect(() => {
    if (preselectedId) setPatientId(preselectedId);
  }, [preselectedId]);

  useEffect(() => {
    setPatientPage(1);
  }, [patientFilter]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const patients = patientsQuery.data?.items || [];
  const patientTotal = patientsQuery.data?.total || 0;

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === patientId) || null,
    [patients, patientId],
  );

  const addressRules = abhaAddressRules(abhaAddress);
  const aadhaarInvalid = aadhaar.length > 0 && !/^\d{12}$/.test(aadhaar);

  async function run(action) {
    setError('');
    setFieldErrors({});
    try {
      await action();
    } catch (err) {
      if (err.code === 'ABHA_ADDRESS_EXISTS') {
        setAddressTaken(true);
        setError('ABHA address already exists.');
        return;
      }
      const detail = Array.isArray(err.details) ? err.details[0]?.message : '';
      setError(detail || err.message || 'Request failed');
    }
  }

  function applyOtpExpiry(value) {
    setOtpExpiresAt(expiryMs(value));
    setOtpExpired(false);
  }

  const markOtpExpired = useCallback(() => setOtpExpired(true), []);

  function setConsentFlag(key, value) {
    setConsent((prev) => ({ ...prev, [key]: value }));
  }

  function downloadCard() {
    if (!card?.imageBase64) return;
    const link = document.createElement('a');
    link.href = `data:${card.contentType || 'image/png'};base64,${card.imageBase64}`;
    link.download = 'abha-card.png';
    link.click();
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
              ...consent,
              patientId: patientId || undefined,
            });
            if (!parsed.success) {
              const next = {};
              for (const issue of parsed.error.issues) {
                next[issue.path[0]] = issue.message;
              }
              setFieldErrors(next);
              setError(Object.values(next)[0] || 'Check the form');
              return;
            }
            setError('');
            setFieldErrors({});
            setStep(STEPS.AADHAAR);
          }}
        >
          <h2>Consent</h2>
          <p className="muted">Code abha-enrollment, version 1.4. Agree before the Aadhaar number is sent.</p>
          <div className="consent-text">
            <h3>Terms and Conditions</h3>
            <p>{TERMS_TEXT}</p>
          </div>
          <label className="field checkbox">
            <input
              type="checkbox"
              checked={consent.termsAgreed}
              onChange={(event) => setConsentFlag('termsAgreed', event.target.checked)}
            />
            <span>I agree</span>
          </label>
          <p>I hereby declare that:</p>
          {DECLARATIONS.map((item) => (
            <label className="field checkbox" key={item.id}>
              <input
                type="checkbox"
                checked={consent[item.id]}
                onChange={(event) => setConsentFlag(item.id, event.target.checked)}
              />
              <span>{item.text}</span>
            </label>
          ))}
          {consent.otherDocument ? (
            <p className="abha-error">Aadhaar enrolment leaves the other-document declaration unchecked.</p>
          ) : null}
          <label className="field checkbox">
            <input
              type="checkbox"
              checked={consent.workerConfirmed}
              onChange={(event) => setConsentFlag('workerConfirmed', event.target.checked)}
            />
            <span>
              I, {user?.name || 'staff'}, confirm that I have duly informed and explained the beneficiary of the contents of consent for aforementioned purposes.
            </span>
          </label>
          <label className="field checkbox">
            <input
              type="checkbox"
              checked={consent.beneficiaryConfirmed}
              onChange={(event) => setConsentFlag('beneficiaryConfirmed', event.target.checked)}
            />
            <span>
              I, {selectedPatient?.name || 'the beneficiary'}, have been explained about the consent as stated above and hereby provide my consent for the aforementioned purposes.
            </span>
          </label>
          {fieldErrors.termsAgreed || fieldErrors.patientId ? (
            <Alert>{fieldErrors.termsAgreed || fieldErrors.patientId}</Alert>
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
                {patientId && !patients.some((patient) => patient.id === patientId) ? (
                  <option value={patientId}>Selected patient</option>
                ) : null}
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name} ({patient.patientType})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {!patientsQuery.isPending && !patientsQuery.isError && patientTotal > 0 ? (
            <Pagination
              page={patientPage}
              pageSize={PAGE_SIZE}
              total={patientTotal}
              disabled={patientsQuery.isFetching}
              onPageChange={setPatientPage}
            />
          ) : null}
          {selectedPatient ? (
            <div className="abha-selected">
              <p>
                <span className="muted">Selected</span> {selectedPatient.name} · {selectedPatient.patientType}
              </p>
            </div>
          ) : (
            <p className="muted">
              No patient selected. <Link to="/patients">Register one first</Link>.
            </p>
          )}
          <Button type="submit">Continue</Button>
        </form>
      ) : null}

      {step === STEPS.AADHAAR ? (
        <form
          className="card stack"
          onSubmit={(event) => {
            event.preventDefault();
            setAadhaarTouched(true);
            const parsed = parseAadhaarStep({ aadhaar, mobile });
            if (!parsed.success) {
              const next = {};
              for (const issue of parsed.error.issues) {
                next[issue.path[0]] = issue.message === 'Aadhaar must be 12 digits'
                  ? AADHAAR_INVALID_MESSAGE
                  : issue.message;
              }
              if (next.aadhaar) next.aadhaar = AADHAAR_INVALID_MESSAGE;
              setFieldErrors(next);
              return;
            }
            run(async () => {
              const data = await enrolment.requestOtp.mutateAsync({
                patientId,
                aadhaar: parsed.data.aadhaar,
              });
              setTransactionId(data.transactionId);
              setOtpMessage(data.message || '');
              applyOtpExpiry(data.otpExpiresAt);
              setAadhaar('');
              setShowAadhaar(false);
              setStep(STEPS.OTP);
            });
          }}
        >
          <h2>Aadhaar</h2>
          {selectedPatient ? (
            <p className="muted">Enrolling {selectedPatient.name}</p>
          ) : null}
          <Field label="Aadhaar number" error={fieldErrors.aadhaar || (aadhaarTouched && aadhaarInvalid ? AADHAAR_INVALID_MESSAGE : '')}>
            {({ id, ...a11y }) => (
              <div className="secret-field">
                <input
                  id={id}
                  type={showAadhaar ? 'text' : 'password'}
                  value={aadhaar}
                  onChange={(event) => setAadhaar(event.target.value)}
                  onBlur={() => setAadhaarTouched(true)}
                  autoComplete="off"
                  {...a11y}
                />
                <button
                  type="button"
                  className="secret-toggle"
                  aria-label={showAadhaar ? 'Hide Aadhaar number' : 'Show Aadhaar number'}
                  aria-pressed={showAadhaar}
                  onClick={() => setShowAadhaar((current) => !current)}
                >
                  <EyeIcon open={showAadhaar} />
                </button>
              </div>
            )}
          </Field>
          <Field label="Communication mobile" error={fieldErrors.mobile}>
            {({ id, ...a11y }) => (
              <input
                id={id}
                inputMode="numeric"
                maxLength={10}
                required
                value={mobile}
                onChange={(event) => setMobile(event.target.value.replace(/\D/g, '').slice(0, 10))}
                autoComplete="off"
                {...a11y}
              />
            )}
          </Field>
          <Button type="submit" disabled={enrolment.isBusy || aadhaar.length !== 12 || mobile.length !== 10}>
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
                mobile,
                consentAccepted: true,
              });
              setOtp('');
              setResult(data);
              if (data.needsMobileVerify) {
                setMobileMessage(data.mobileMessage || '');
                applyOtpExpiry(data.otpExpiresAt);
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
          {otpMessage ? <p>{otpMessage}</p> : (
            <p className="muted">Enter the OTP sent to the Aadhaar-linked mobile.</p>
          )}
          <OtpClock expiresAt={otpExpiresAt} onExpired={markOtpExpired} />
          <Field label="OTP" error={fieldErrors.otp}>
            {({ id, ...a11y }) => (
              <input
                id={id}
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                {...a11y}
              />
            )}
          </Field>
          <Button type="submit" disabled={enrolment.isBusy || otp.length !== 6 || otpExpired}>
            Verify and enrol
          </Button>
          <OtpResend
            channel="aadhaar"
            transactionId={transactionId}
            enrolment={enrolment}
            onMessage={setOtpMessage}
            onError={setError}
            onIssued={applyOtpExpiry}
          />
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
          <h2>Communication mobile OTP</h2>
          {mobileMessage ? <p>{mobileMessage}</p> : (
            <p className="muted">Enter the OTP sent to the communication mobile.</p>
          )}
          <OtpClock expiresAt={otpExpiresAt} onExpired={markOtpExpired} />
          <Field label="OTP" error={fieldErrors.otp}>
            {({ id, ...a11y }) => (
              <input
                id={id}
                inputMode="numeric"
                maxLength={6}
                value={mobileOtp}
                onChange={(event) => setMobileOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                {...a11y}
              />
            )}
          </Field>
          <Button type="submit" disabled={enrolment.isBusy || mobileOtp.length !== 6 || otpExpired}>
            Verify mobile
          </Button>
          <OtpResend
            channel="mobile"
            transactionId={transactionId}
            enrolment={enrolment}
            onMessage={setMobileMessage}
            onError={setError}
            onIssued={applyOtpExpiry}
          />
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
              setAddressTaken(false);
              try {
                const cardData = await enrolment.loadCard.mutateAsync(transactionId);
                setCard(cardData);
                setCardNote('');
              } catch (err) {
                setCard(null);
                setCardNote(err.message || 'Card image unavailable for this session.');
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
                  value={suggestions.includes(abhaAddress) ? abhaAddress : ''}
                  onChange={(event) => {
                    setAbhaAddress(event.target.value);
                    setAddressTaken(false);
                  }}
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
                onChange={(event) => {
                  setAbhaAddress(event.target.value);
                  setAddressTaken(false);
                }}
                autoComplete="off"
                {...a11y}
              />
            )}
          </Field>
          <ul className="address-rules">
            {ADDRESS_RULES.map((rule) => (
              <li key={rule.key} className={abhaAddress && addressRules[rule.key] ? 'rule-met' : 'rule-unmet'}>
                {rule.label}
              </li>
            ))}
          </ul>
          {addressTaken ? (
            <div className="stack">
              <p className="abha-error">ABHA address already exists.</p>
              <div className="row">
                <Button
                  type="button"
                  onClick={() => run(async () => {
                    const data = await enrolment.createAddress.mutateAsync({
                      transactionId,
                      abhaAddress,
                      useExisting: true,
                    });
                    setResult((prev) => ({ ...prev, ...data }));
                    setStep(STEPS.DONE);
                  })}
                >
                  Use this address
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAbhaAddress('');
                    setAddressTaken(false);
                    setError('');
                  }}
                >
                  Create another
                </Button>
              </div>
            </div>
          ) : null}
          <Button type="submit" disabled={enrolment.isBusy || !abhaAddress}>
            Create address
          </Button>
        </form>
      ) : null}

      {step === STEPS.DONE && result ? (
        <div className="card stack abha-result">
          <h2>Enrolment result</h2>
          <p><span className="muted">ABHA number</span> {result.abhaNumber || result.profile?.abhaNumber || '—'}</p>
          <p><span className="muted">Address</span> {result.abhaAddress || result.profile?.phrAddress?.[0] || '—'}</p>
          <p><span className="muted">Name</span> {result.profile?.name || '—'}</p>
          <p><span className="muted">Date of birth</span> {result.profile?.dateOfBirth || '—'}</p>
          <p><span className="muted">Gender</span> {result.profile?.gender || '—'}</p>
          <p><span className="muted">Mobile</span> {mobile || result.profile?.mobile || '—'}</p>
          <p><span className="muted">Address line</span> {result.profile?.address || '—'}</p>
          <p><span className="muted">Status</span> {result.status}</p>
          {typeof result.isNew === 'boolean' ? (
            <p><span className="muted">New ABHA</span> {result.isNew ? 'yes' : 'existing account'}</p>
          ) : null}
          {card?.imageBase64 ? (
            <>
              <img
                className="abha-card"
                alt="ABHA card"
                src={`data:${card.contentType || 'image/png'};base64,${card.imageBase64}`}
              />
              <Button type="button" onClick={downloadCard}>Download ABHA card</Button>
            </>
          ) : (
            <p className="muted">{cardNote || 'Card image unavailable for this session. A non-KYC ABHA address cannot download a card until the details are KYC verified.'}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
