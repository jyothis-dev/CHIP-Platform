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
const DOC_M3 = 'https://docs.abdm.gov.in/docs/hiecm/v3/api/m3/endpoints';
const M3_VERIFIED_ON = '2026-11-27';
const DOC_M4 = 'https://docs.abdm.gov.in/docs/hiecm/v3/api/m4/endpoints';
const M4_VERIFIED_ON = '2026-11-27';
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
  // M3 (HIU). Paths and headers from the M3 specification, catalogue 2026.09.16,
  // read through the abdm-docs server on 2026-11-27.
  hiuConsentInit: {
    method: 'POST',
    path: '/api/hiecm/consent/v3/request/init',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    requiresCallback: true,
    docUrl: `${DOC_M3}/m3-post-consent-v3-request-init`,
    verifiedOn: M3_VERIFIED_ON,
  },
  hiuConsentStatus: {
    method: 'POST',
    path: '/api/hiecm/consent/v3/request/status',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'X-HIU-ID', 'Authorization', 'Content-Type'],
    requiresHiuId: true,
    auth: 'gateway',
    requiresCallback: true,
    docUrl: `${DOC_M3}/m3-post-consent-v3-request-status`,
    verifiedOn: M3_VERIFIED_ON,
  },
  hiuConsentOnNotify: {
    method: 'POST',
    path: '/api/hiecm/consent/v3/request/hiu/on-notify',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    docUrl: `${DOC_M3}/m3-post-consent-v3-request-hiu-on-notify`,
    verifiedOn: M3_VERIFIED_ON,
  },
  hiuConsentFetch: {
    method: 'POST',
    path: '/api/hiecm/consent/v3/fetch',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'X-HIU-ID', 'Authorization', 'Content-Type'],
    requiresHiuId: true,
    auth: 'gateway',
    requiresCallback: true,
    docUrl: `${DOC_M3}/m3-post-consent-v3-fetch`,
    verifiedOn: M3_VERIFIED_ON,
  },
  hiuHealthInformationRequest: {
    method: 'POST',
    path: '/api/hiecm/data-flow/v3/health-information/request',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'X-HIU-ID', 'Authorization', 'Content-Type'],
    requiresHiuId: true,
    auth: 'gateway',
    requiresCallback: true,
    docUrl: `${DOC_M3}/m3-post-data-flow-v3-health-information-request`,
    verifiedOn: M3_VERIFIED_ON,
  },
  hiuHealthInformationStatus: {
    method: 'GET',
    path: '/api/hiecm/data-flow/v3/health-information/request/status/{transaction-id}',
    base: 'gateway',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'X-CM-ID', 'Authorization'],
    auth: 'gateway',
    docUrl: `${DOC_M3}/m3-get-data-flow-v3-health-information-request-status-transaction-id`,
    verifiedOn: M3_VERIFIED_ON,
  },
  // M4 (HFR / HPR registries). Host is https://apihspsbx.abdm.gov.in/v4/int with the gateway
  // session token as Bearer. Paths from the M4 specification, catalogue 2026.09.16, read
  // through the abdm-docs server on 2026-11-27. The specification lists only Authorization
  // for these operations. Whether the bridge link also needs the facility manager's
  // x-hprid-auth is UNVERIFIED (see INTEGRATION-PLAN.md, M4).
  hfrSearchFacility: {
    method: 'POST',
    path: '/FacilityManagement/v1.5/facility/search',
    base: 'hfr',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    docUrl: `${DOC_M4}/m4-post-facilitymanagement-v1-5-facility-search`,
    verifiedOn: M4_VERIFIED_ON,
  },
  hfrLgdStates: {
    method: 'GET',
    path: '/v1.5/facility/lgd/states',
    base: 'hfr',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization'],
    auth: 'gateway',
    docUrl: `${DOC_M4}/m4-get-v1-5-facility-lgd-states`,
    verifiedOn: M4_VERIFIED_ON,
  },
  hfrLgdDistricts: {
    method: 'GET',
    path: '/v1.5/facility/lgd/districts',
    base: 'hfr',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization'],
    auth: 'gateway',
    docUrl: `${DOC_M4}/m4-get-v1-5-facility-lgd-districts`,
    verifiedOn: M4_VERIFIED_ON,
  },
  hfrLgdSubdistricts: {
    method: 'GET',
    path: '/v1.5/facility/lgd/subdistricts',
    base: 'hfr',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization'],
    auth: 'gateway',
    docUrl: `${DOC_M4}/m4-get-v1-5-facility-lgd-subdistricts`,
    verifiedOn: M4_VERIFIED_ON,
  },
  hprExists: {
    method: 'GET',
    path: '/v1/search/existsByHprId/{hprId}',
    base: 'hpr',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization'],
    auth: 'gateway',
    docUrl: `${DOC_M4}/m4-get-v1-search-existsbyhprid-hprid`,
    verifiedOn: M4_VERIFIED_ON,
  },
  hprSearchById: {
    method: 'GET',
    path: '/v1/search/searchByHprId/{hprId}',
    base: 'hpr',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization'],
    auth: 'gateway',
    docUrl: `${DOC_M4}/m4-get-v1-search-searchbyhprid-hprid`,
    verifiedOn: M4_VERIFIED_ON,
  },
  hprSearchByMobile: {
    method: 'GET',
    path: '/v1/search/searchByMobile/{mobile}',
    base: 'hpr',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization'],
    auth: 'gateway',
    docUrl: `${DOC_M4}/m4-get-v1-search-searchbymobile-mobile`,
    verifiedOn: M4_VERIFIED_ON,
  },
  hprProfessionalInfo: {
    method: 'POST',
    path: '/apis/v1/doctors/fetch-professional-info',
    base: 'hpr',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    docUrl: `${DOC_M4}/m4-post-v1-doctors-fetch-professional-info`,
    verifiedOn: M4_VERIFIED_ON,
  },
  hfrBridgeLink: {
    method: 'POST',
    path: '/v1/bridges/MutipleHRPAddUpdateServices',
    base: 'hfr',
    headers: ['REQUEST-ID', 'TIMESTAMP', 'Authorization', 'Content-Type'],
    auth: 'gateway',
    docUrl: `${DOC_M4}/m4-post-v1-bridges-mutiplehrpaddupdateservices`,
    verifiedOn: M4_VERIFIED_ON,
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
    requiresHiuId: Boolean(contract.requiresHiuId),
    benefitName: env.abdmBenefitName || null,
    docUrl: contract.docUrl,
    verifiedOn: contract.verifiedOn,
  };
}

export function listContracts() {
  return Object.keys(CONTRACTS);
}
