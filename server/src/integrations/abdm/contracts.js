import { AppError } from '../../shared/errors.js';
import { env } from '../../config/env.js';

/**
 * ABDM operation contracts for M1 ABHA creation (Aadhaar OTP).
 * Paths and headers come from the ABDM M1 catalogue (2026.09.16).
 * Re-verify against the live docs page before changing verifiedOn.
 * Docs: https://docs.abdm.gov.in/docs/hiecm/v3/api/m1
 */

const DOC_M1 = 'https://docs.abdm.gov.in/docs/hiecm/v3/api/m1';
const DOC_M2 = 'https://docs.abdm.gov.in/docs/hiecm/v3/api/m2';
const DOC_GATEWAY = 'https://docs.abdm.gov.in/docs/hiecm/v3/reference/authentication';
const VERIFIED_ON = '2026-09-16';

const CONTRACTS = {
  session: {
    method: 'POST',
    path: '/api/hiecm/gateway/v3/sessions',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Content-Type'],
    auth: 'none',
    docUrl: DOC_GATEWAY,
    verifiedOn: VERIFIED_ON,
  },
  certificate: {
    method: 'GET',
    path: '/abha/api/v3/profile/public/certificate',
    base: 'abha',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization'],
    auth: 'gateway',
    docUrl: DOC_M1,
    verifiedOn: VERIFIED_ON,
  },
  requestAadhaarOtp: {
    method: 'POST',
    path: '/abha/api/v3/enrollment/request/otp',
    base: 'abha',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    scope: ['abha-enrol'],
    loginHint: 'aadhaar',
    otpSystem: 'aadhaar',
    docUrl: DOC_M1,
    verifiedOn: VERIFIED_ON,
  },
  enrolByAadhaar: {
    method: 'POST',
    path: '/abha/api/v3/enrollment/enrol/byAadhaar',
    base: 'abha',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization', 'Content-Type'],
    optionalHeaders: ['BENEFIT_NAME'],
    auth: 'gateway',
    docUrl: DOC_M1,
    verifiedOn: VERIFIED_ON,
  },
  requestMobileOtp: {
    method: 'POST',
    path: '/abha/api/v3/enrollment/request/otp',
    base: 'abha',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    scope: ['abha-enrol', 'mobile-verify'],
    loginHint: 'mobile',
    otpSystem: 'abdm',
    docUrl: DOC_M1,
    verifiedOn: VERIFIED_ON,
  },
  verifyMobileOtp: {
    method: 'POST',
    path: '/abha/api/v3/enrollment/auth/byAbdm',
    base: 'abha',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    scope: ['abha-enrol', 'mobile-verify'],
    docUrl: DOC_M1,
    verifiedOn: VERIFIED_ON,
  },
  addressSuggestion: {
    method: 'GET',
    path: '/abha/api/v3/enrollment/enrol/suggestion',
    base: 'abha',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization', 'TRANSACTION_ID'],
    auth: 'gateway',
    docUrl: DOC_M1,
    verifiedOn: VERIFIED_ON,
  },
  createAbhaAddress: {
    method: 'POST',
    path: '/abha/api/v3/enrollment/enrol/abha-address',
    base: 'abha',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    // Callback requirement UNVERIFIED — keep transaction ACCEPTED until confirmed.
    requiresCallback: null,
    docUrl: DOC_M1,
    verifiedOn: VERIFIED_ON,
  },
  abhaCard: {
    method: 'GET',
    path: '/abha/api/v3/profile/account/abha-card',
    base: 'abha',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization', 'X-token'],
    auth: 'gateway+user',
    docUrl: DOC_M1,
    verifiedOn: VERIFIED_ON,
  },
  bridgeServices: {
    method: 'GET',
    path: '/api/hiecm/gateway/v3/bridge-services',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Authorization'],
    auth: 'gateway',
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
  bridgeUrl: {
    method: 'PATCH',
    path: '/api/hiecm/gateway/v3/bridge/url',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
  generateLinkToken: {
    method: 'POST',
    path: '/api/hiecm/v3/token/generate-token',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'X-HIP-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    requiresCallback: true,
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
  linkCareContext: {
    method: 'POST',
    path: '/api/hiecm/hip/v3/link/carecontext',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'X-HIP-ID', 'X-LINK-TOKEN', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    requiresCallback: true,
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
  contextNotify: {
    method: 'POST',
    path: '/api/hiecm/hip/v3/link/context/notify',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'X-HIP-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    requiresCallback: true,
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
  smsNotify: {
    method: 'POST',
    path: '/api/hiecm/hip/v3/link/patient/links/sms/notify2',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    requiresCallback: true,
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
  onDiscover: {
    method: 'POST',
    path: '/api/hiecm/user-initiated-linking/v3/patient/care-context/on-discover',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'X-HIU-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
  onInit: {
    method: 'POST',
    path: '/api/hiecm/user-initiated-linking/v3/link/care-context/on-init',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
  onConfirm: {
    method: 'POST',
    path: '/api/hiecm/user-initiated-linking/v3/link/care-context/on-confirm',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
  consentOnNotify: {
    method: 'POST',
    path: '/api/hiecm/consent/v3/request/hip/on-notify',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
  healthInformationOnRequest: {
    method: 'POST',
    path: '/api/hiecm/data-flow/v3/health-information/hip/on-request',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
  healthInformationNotify: {
    method: 'POST',
    path: '/api/hiecm/data-flow/v3/health-information/notify',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    docUrl: DOC_M2,
    verifiedOn: VERIFIED_ON,
  },
};

export function assertContractVerified(contract, name) {
  if (!contract?.verifiedOn) {
    throw new AppError(412, 'CONTRACT_UNVERIFIED', `ABDM contract is not verified: ${name}`);
  }
}

export function getContract(name) {
  const contract = CONTRACTS[name];
  if (!contract) {
    throw new AppError(500, 'CONTRACT_UNKNOWN', `Unknown ABDM contract: ${name}`);
  }
  assertContractVerified(contract, name);

  const headers = [...contract.headers];
  if (contract.optionalHeaders?.includes('BENEFIT_NAME') && env.abdmBenefitName) {
    headers.push('BENEFIT_NAME');
  }

  return {
    name,
    method: contract.method,
    path: contract.path,
    base: contract.base,
    headers,
    auth: contract.auth,
    scope: contract.scope,
    loginHint: contract.loginHint,
    otpSystem: contract.otpSystem,
    requiresCallback: contract.requiresCallback ?? null,
    benefitName: env.abdmBenefitName || null,
    docUrl: contract.docUrl,
    verifiedOn: contract.verifiedOn,
  };
}

export function listContracts() {
  return Object.keys(CONTRACTS);
}
