import { randomUUID } from 'node:crypto';
import { AppError } from '../../shared/errors.js';
import { logAudit } from '../../shared/audit.js';
import { getContract } from '../../integrations/abdm/contracts.js';
import { abdmRequest } from '../../integrations/abdm/client.js';
import { encryptForAbha } from '../../integrations/abdm/crypto.js';
import {
  encryptAbhaNumberAtRest,
  hashAbhaNumber,
  maskAbhaNumber,
  currentEncKeyVersion,
} from './abha.crypto.js';
import {
  putEnrolmentSession,
  getEnrolmentSession,
  clearEnrolmentSession,
} from './enrolmentSession.js';
import * as repo from './abha.repository.js';

function abdmErrorCode(body) {
  const raw = body?.error?.code || body?.code || body?.errorCode || '';
  return String(raw).replace(/:\s*$/, '').trim() || 'ABDM_ERROR';
}

async function requirePatient(patientId, facilityId) {
  const patient = await repo.findPatientById(patientId);
  if (!patient) {
    throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found');
  }
  if (patient.facilityId !== facilityId) {
    throw new AppError(403, 'FORBIDDEN', 'Patient is outside your facility');
  }
  return patient;
}

function extractAbhaNumber(body) {
  return body?.healthIdNumber
    || body?.ABHANumber
    || body?.abhaNumber
    || body?.accounts?.[0]?.ABHANumber
    || null;
}

function extractTokens(body) {
  const token = body?.tokens?.token
    || body?.token
    || body?.XToken
    || null;
  const refreshToken = body?.tokens?.refreshToken || body?.refreshToken || null;
  return { token, refreshToken };
}

export async function requestAadhaarOtp({
  patientId,
  aadhaar,
  actorId,
  facilityId,
  correlationId,
  idempotencyKey,
  http,
}) {
  const patient = await requirePatient(patientId, facilityId);

  const route = 'POST /abha/enrolment/otp';
  const idem = await repo.assertIdempotency({
    key: idempotencyKey,
    userId: actorId,
    route,
    body: { patientId, aadhaar: '[redacted]' },
  });
  if (idem?.existing) {
    const existing = await repo.findTransaction(idem.existing.responseRef);
    if (existing) {
      return { transactionId: existing.id, status: existing.status };
    }
  }

  const encryptedAadhaar = await encryptForAbha(aadhaar, { http });
  const contract = getContract('requestAadhaarOtp');
  const txnSeed = randomUUID();

  const transaction = await repo.createTransaction({
    requestId: randomUUID(),
    milestone: 'M1',
    workflow: 'abha.enrol.aadhaar_otp',
    direction: 'OUTBOUND',
    status: 'INITIATED',
    correlationId: correlationId || randomUUID(),
    evidenceLabel: 'IMPLEMENTED_NOT_SANDBOX_TESTED',
    safeMetadata: { patientId, step: 'request_otp' },
  });

  const result = await abdmRequest({
    contract,
    http,
    body: {
      txnId: txnSeed,
      scope: contract.scope,
      loginHint: contract.loginHint,
      loginId: encryptedAadhaar,
      otpSystem: contract.otpSystem,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    await repo.updateTransaction(transaction.id, {
      status: 'FAILED',
      lastErrorCode: abdmErrorCode(result.body),
      safeMetadata: { patientId, step: 'request_otp', requestId: result.requestId },
    });
    throw new AppError(502, 'ABHA_OTP_REQUEST_FAILED', 'Could not request Aadhaar OTP');
  }

  const externalTxnId = result.body?.txnId || txnSeed;
  await repo.updateTransaction(transaction.id, {
    status: 'ACCEPTED',
    externalTxnId,
    safeMetadata: { patientId, step: 'request_otp', requestId: result.requestId },
  });

  if (idempotencyKey && idem?.hash) {
    await repo.saveIdempotency({
      key: idempotencyKey,
      userId: actorId,
      route,
      requestBodyHash: idem.hash,
      responseRef: transaction.id,
    });
  }

  await logAudit({
    actorId,
    facilityId,
    action: 'abha.enrol.otp_request',
    resourceType: 'patient',
    resourceId: patientId,
    outcome: 'success',
    correlationId: transaction.correlationId,
    message: `ABHA OTP requested for patient ${patient.name}.`,
  });

  return { transactionId: transaction.id, status: 'ACCEPTED' };
}

export async function verifyAadhaarOtp({
  transactionId,
  otp,
  mobile,
  consentAccepted,
  actorId,
  facilityId,
  correlationId,
  http,
}) {
  if (!consentAccepted) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ABHA enrolment consent is required');
  }

  const transaction = await repo.findTransaction(transactionId);
  if (!transaction || transaction.workflow !== 'abha.enrol.aadhaar_otp') {
    throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Enrolment transaction not found');
  }

  const patientId = transaction.safeMetadata?.patientId;
  if (!patientId) {
    throw new AppError(409, 'TRANSACTION_INVALID', 'Enrolment transaction is missing patient context');
  }
  const patient = await requirePatient(patientId, facilityId);

  if (!transaction.externalTxnId) {
    throw new AppError(409, 'TRANSACTION_NOT_READY', 'OTP was not requested for this transaction');
  }

  const contract = getContract('enrolByAadhaar');
  if (!contract.benefitName) {
    throw new AppError(
      503,
      'ABDM_BENEFIT_NAME_MISSING',
      'ABDM benefit name is not configured; enrol cannot proceed',
    );
  }

  const encryptedOtp = await encryptForAbha(otp, { http });
  const result = await abdmRequest({
    contract,
    http,
    body: {
      authData: {
        authMethods: ['otp'],
        otp: {
          txnId: transaction.externalTxnId,
          otpValue: encryptedOtp,
          mobile: mobile || undefined,
        },
      },
      consent: {
        code: 'abha-enrollment',
        version: '1.4',
      },
    },
  });

  if (result.status < 200 || result.status >= 300) {
    const code = abdmErrorCode(result.body);
    await repo.updateTransaction(transaction.id, {
      status: 'FAILED',
      lastErrorCode: code,
      safeMetadata: {
        ...transaction.safeMetadata,
        step: 'verify_otp',
        requestId: result.requestId,
      },
    });
    throw new AppError(400, 'ABHA_OTP_INVALID', 'The OTP could not be verified', {
      details: [{ path: 'otp', message: 'Invalid or expired OTP' }],
    });
  }

  const abhaNumber = extractAbhaNumber(result.body);
  if (!abhaNumber) {
    await repo.updateTransaction(transaction.id, {
      status: 'FAILED',
      lastErrorCode: 'ABHA_NUMBER_MISSING',
    });
    throw new AppError(502, 'ABHA_ENROL_INCOMPLETE', 'Enrolment response did not include an ABHA number');
  }

  const isNew = result.body?.isNew !== false && result.body?.isNew !== 'false';
  const keyVersion = currentEncKeyVersion();
  const masked = maskAbhaNumber(abhaNumber);

  await repo.upsertAbhaIdentity({
    patientId,
    abhaNumberEnc: encryptAbhaNumberAtRest(abhaNumber),
    encKeyVersion: keyVersion,
    abhaNumberHash: hashAbhaNumber(abhaNumber),
    hashKeyVersion: keyVersion,
    abhaNumberMasked: masked,
    abhaAddress: result.body?.preferredAbhaAddress || null,
    verificationStatus: 'VERIFIED',
    verifiedAt: new Date(),
  });

  const { token, refreshToken } = extractTokens(result.body);
  putEnrolmentSession(transaction.id, {
    userToken: token,
    refreshToken,
    abhaNumberMasked: masked,
    externalTxnId: result.body?.txnId || transaction.externalTxnId,
    patientId,
    needsMobileVerify: Boolean(mobile),
  });

  await repo.updateTransaction(transaction.id, {
    status: 'ACCEPTED',
    externalTxnId: result.body?.txnId || transaction.externalTxnId,
    externalStatus: isNew ? 'NEW' : 'EXISTING',
    safeMetadata: {
      patientId,
      step: 'verify_otp',
      requestId: result.requestId,
      isNew,
      abhaNumberMasked: masked,
    },
  });

  await logAudit({
    actorId,
    facilityId,
    action: 'abha.enrol.verify',
    resourceType: 'patient',
    resourceId: patientId,
    outcome: 'success',
    correlationId: correlationId || transaction.correlationId,
    message: `ABHA enrolment verified for patient ${patient.name}.`,
  });

  // Request communication mobile OTP when a mobile was supplied.
  if (mobile) {
    const mobileContract = getContract('requestMobileOtp');
    const encMobile = await encryptForAbha(mobile, { http });
    const mobileResult = await abdmRequest({
      contract: mobileContract,
      http,
      body: {
        txnId: result.body?.txnId || transaction.externalTxnId,
        scope: mobileContract.scope,
        loginHint: mobileContract.loginHint,
        loginId: encMobile,
        otpSystem: mobileContract.otpSystem,
      },
    });
    if (mobileResult.status >= 200 && mobileResult.status < 300) {
      await repo.updateTransaction(transaction.id, {
        externalTxnId: mobileResult.body?.txnId || transaction.externalTxnId,
        safeMetadata: {
          patientId,
          step: 'mobile_otp_requested',
          requestId: mobileResult.requestId,
          isNew,
          abhaNumberMasked: masked,
        },
      });
    }
  }

  return {
    status: 'ACCEPTED',
    abhaNumberMasked: masked,
    isNew,
    needsMobileVerify: Boolean(mobile),
  };
}

export async function verifyMobileOtp({
  transactionId,
  otp,
  actorId,
  facilityId,
  http,
}) {
  const transaction = await repo.findTransaction(transactionId);
  if (!transaction) {
    throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Enrolment transaction not found');
  }
  const patientId = transaction.safeMetadata?.patientId;
  const patient = await requirePatient(patientId, facilityId);

  const session = getEnrolmentSession(transactionId);
  const contract = getContract('verifyMobileOtp');
  const encryptedOtp = await encryptForAbha(otp, { http });

  const result = await abdmRequest({
    contract,
    http,
    body: {
      scope: contract.scope,
      authData: {
        authMethods: ['otp'],
        otp: {
          txnId: transaction.externalTxnId,
          otpValue: encryptedOtp,
        },
      },
    },
  });

  if (result.status < 200 || result.status >= 300) {
    await repo.updateTransaction(transaction.id, {
      status: 'FAILED',
      lastErrorCode: abdmErrorCode(result.body),
    });
    throw new AppError(400, 'ABHA_OTP_INVALID', 'The mobile OTP could not be verified');
  }

  if (session) {
    putEnrolmentSession(transactionId, {
      ...session,
      needsMobileVerify: false,
      externalTxnId: result.body?.txnId || session.externalTxnId,
    });
  }

  await repo.updateTransaction(transaction.id, {
    status: 'ACCEPTED',
    externalTxnId: result.body?.txnId || transaction.externalTxnId,
    safeMetadata: {
      ...transaction.safeMetadata,
      step: 'mobile_verified',
      requestId: result.requestId,
    },
  });

  await logAudit({
    actorId,
    facilityId,
    action: 'abha.enrol.mobile_verify',
    resourceType: 'patient',
    resourceId: patientId,
    outcome: 'success',
    correlationId: transaction.correlationId,
    message: `ABHA mobile OTP verified for patient ${patient.name}.`,
  });

  return { status: 'ACCEPTED' };
}

export async function suggestAddress({ transactionId, facilityId, http }) {
  const transaction = await repo.findTransaction(transactionId);
  if (!transaction) {
    throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Enrolment transaction not found');
  }
  await requirePatient(transaction.safeMetadata?.patientId, facilityId);

  const contract = getContract('addressSuggestion');
  const result = await abdmRequest({
    contract,
    http,
    transactionId: transaction.externalTxnId,
  });

  if (result.status < 200 || result.status >= 300) {
    throw new AppError(502, 'ABHA_SUGGESTION_FAILED', 'Could not load ABHA address suggestions');
  }

  const suggestions = result.body?.abhaAddressList
    || result.body?.suggestions
    || result.body?.abhaAddresses
    || [];

  return { suggestions: Array.isArray(suggestions) ? suggestions : [] };
}

export async function createAddress({
  transactionId,
  abhaAddress,
  actorId,
  facilityId,
  http,
}) {
  const transaction = await repo.findTransaction(transactionId);
  if (!transaction) {
    throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Enrolment transaction not found');
  }
  const patientId = transaction.safeMetadata?.patientId;
  const patient = await requirePatient(patientId, facilityId);

  const contract = getContract('createAbhaAddress');
  const result = await abdmRequest({
    contract,
    http,
    body: {
      txnId: transaction.externalTxnId,
      abhaAddress,
      preferred: 1,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    await repo.updateTransaction(transaction.id, {
      status: 'FAILED',
      lastErrorCode: abdmErrorCode(result.body),
    });
    throw new AppError(400, 'ABHA_ADDRESS_FAILED', 'Could not create the ABHA address');
  }

  const preferred = result.body?.preferredAbhaAddress || abhaAddress;
  const masked = result.body?.healthIdNumber
    ? maskAbhaNumber(result.body.healthIdNumber)
    : (transaction.safeMetadata?.abhaNumberMasked || null);

  const identity = await repo.findAbhaIdentity(patientId);
  if (identity) {
    await repo.updateAbhaAddress(patientId, {
      abhaAddress: preferred,
      abhaNumberMasked: masked || identity.abhaNumberMasked,
    });
  }

  // Callback requirement UNVERIFIED — stay ACCEPTED until the docs confirm COMPLETED is safe.
  const nextStatus = contract.requiresCallback === false ? 'COMPLETED' : 'ACCEPTED';
  await repo.updateTransaction(transaction.id, {
    status: nextStatus,
    safeMetadata: {
      ...transaction.safeMetadata,
      step: 'address_created',
      requestId: result.requestId,
      abhaAddress: preferred,
      abhaNumberMasked: masked,
    },
  });

  clearEnrolmentSession(transactionId);

  await logAudit({
    actorId,
    facilityId,
    action: 'abha.enrol.address',
    resourceType: 'patient',
    resourceId: patientId,
    outcome: 'success',
    correlationId: transaction.correlationId,
    message: `ABHA address created for patient ${patient.name}.`,
  });

  return {
    status: nextStatus,
    abhaNumberMasked: masked,
    abhaAddress: preferred,
  };
}

export async function getPatientAbha({ patientId, facilityId }) {
  await requirePatient(patientId, facilityId);
  const identity = await repo.findAbhaIdentity(patientId);
  if (!identity) {
    return { verificationStatus: 'NONE', abhaNumberMasked: null, abhaAddress: null };
  }
  return {
    verificationStatus: identity.verificationStatus,
    abhaNumberMasked: identity.abhaNumberMasked,
    abhaAddress: identity.abhaAddress,
    verifiedAt: identity.verifiedAt,
  };
}

export async function getAbhaCard({ transactionId, facilityId, http }) {
  const transaction = await repo.findTransaction(transactionId);
  if (!transaction) {
    throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Enrolment transaction not found');
  }
  await requirePatient(transaction.safeMetadata?.patientId, facilityId);

  const session = getEnrolmentSession(transactionId);
  if (!session?.userToken) {
    throw new AppError(409, 'ABHA_SESSION_EXPIRED', 'Enrolment session expired; card is unavailable');
  }

  const contract = getContract('abhaCard');
  const result = await abdmRequest({
    contract,
    http,
    userToken: session.userToken,
  });

  if (result.status < 200 || result.status >= 300) {
    throw new AppError(502, 'ABHA_CARD_FAILED', 'Could not load the ABHA card');
  }

  // Return base64 for the UI. Never write to disk or the database.
  const buffer = Buffer.isBuffer(result.body)
    ? result.body
    : Buffer.from(result.body);
  return {
    contentType: result.headers?.['content-type'] || 'image/png',
    imageBase64: buffer.toString('base64'),
  };
}
