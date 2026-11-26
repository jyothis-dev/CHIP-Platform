import { HI_TYPES } from '../../integrations/abdm/fhir/profiles.js';

/**
 * Enumerations from the M3 specification (m3_post_consent_v3_request_init,
 * catalogue 2026.09.16). ABDM publishes no master-data call for purposes or
 * HI types, so they are taken from the specification of the call itself.
 */
export const PURPOSES = Object.freeze({
  CAREMGT: 'Care Management',
  BTG: 'Break the Glass',
  PUBHLTH: 'Public Health',
  HPAYMT: 'Healthcare Payment',
  DSRCH: 'Disease Specific Healthcare Research',
  PATRQT: 'Self Requested',
});

export const PURPOSE_CODES = Object.keys(PURPOSES);

export const HIU_HI_TYPES = HI_TYPES;

export const ACCESS_MODES = ['VIEW', 'STORE', 'STREAM', 'QUERY'];

export const FREQUENCY_UNITS = ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'];

/** consent.patient.id pattern from the specification. */
export const ABHA_ADDRESS_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.\-!]+[a-zA-Z0-9]@(abdm|sbx)$/;

/** HI types this HIU claims for its functional test run (government entity, fast track). */
export const HIU_CLAIMED_HI_TYPES = ['ImmunizationRecord'];

export const DATA_PUSH_PATH = '/api/v3/hiu/health-information/transfer';

export const ANSWER_ROUTES = new Set([
  '/api/v3/hiu/consent/request/on-init',
  '/api/v3/hiu/consent/request/on-status',
  '/api/v3/hiu/consent/on-fetch',
  '/api/v3/hiu/health-information/on-request',
]);

export const NOTIFY_ROUTE = '/api/v3/hiu/consent/request/notify';

export const CALLBACK_ROUTES = [...ANSWER_ROUTES, NOTIFY_ROUTE];

/** Request states that never change again. */
export const TERMINAL_STATES = new Set(['INIT_FAILED', 'DENIED', 'EXPIRED', 'REVOKED']);
