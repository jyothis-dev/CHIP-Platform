import { randomUUID } from 'node:crypto';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { logAudit } from '../../shared/audit.js';
import { getContract } from '../../integrations/abdm/contracts.js';
import { abdmRequest } from '../../integrations/abdm/client.js';
import { encryptForAbha } from '../../integrations/abdm/crypto.js';
import {
  decryptAbhaNumberAtRest,
  encryptAbhaNumberAtRest,
  hashAbhaNumber,
  hashMobile,
  maskAbhaNumber,
  currentEncKeyVersion,
} from './abha.crypto.js';
import {
  putEnrolmentSession,
  getEnrolmentSession,
} from './enrolmentSession.js';
import * as repo from './abha.repository.js';
import {
  abdmMessage,
  addressTaken,
  ADDRESS_EXISTS_MESSAGE,
  communicationMobileNeedsOtp,
  displayAbhaNumber,
  MAX_OTP_RESENDS,
  OTP_VALID_MS,
  profileFromEnrolment,
  RESEND_LIMIT_MESSAGE,
  abhaAddressRules,
} from './abhaFlow.js';

function abdmObject(body) {
  if (body && typeof body === 'object') return body;
  if (typeof body !== 'string') return null;
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function abdmErrorCode(body) {
  const source = abdmObject(body);
  const raw = source?.error?.code || source?.code || source?.errorCode || '';
  return String(raw).replace(/:\s*$/, '').trim() || 'ABDM_ERROR';
}

function otpDeadline() {
  return Date.now() + OTP_VALID_MS;
}

function assertOtpCurrent(expiresAt) {
  if (expiresAt != null && expiresAt <= Date.now()) {
    throw new AppError(400, 'ABHA_OTP_EXPIRED', 'The OTP expired after 10 minutes. Request a new OTP.');
  }
}

function refusedOtpDetail(body) {
  const source = abdmObject(body);
  const code = abdmErrorCode(source);
  const message = abdmMessage(source);
  const knownCode = code !== 'ABDM_ERROR' ? code : null;
  const text = [knownCode, message].filter(Boolean).join(': ');
  return { code, message, text };
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
    || body?.ABHAProfile?.ABHANumber
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
  consentAccepted,
  actorId,
  actorName,
  facilityId,
  correlationId,
  idempotencyKey,
  http,
}) {
  if (!consentAccepted) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ABHA enrolment consent is required');
  }
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
      txnId: '',
      scope: contract.scope,
      loginHint: contract.loginHint,
      loginId: encryptedAadhaar,
      otpSystem: contract.otpSystem,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    const refused = refusedOtpDetail(result.body);
    logger.warn({
      component: 'abha.service',
      requestId: result.requestId,
      abdmStatus: result.status,
      abdmCode: refused.code,
      abdmMessage: refused.message,
    }, 'ABDM Aadhaar OTP request refused');
    await repo.updateTransaction(transaction.id, {
      status: 'FAILED',
      lastErrorCode: refused.code,
      safeMetadata: { patientId, step: 'request_otp', requestId: result.requestId },
    });
    throw new AppError(
      502,
      'ABHA_OTP_REQUEST_FAILED',
      refused.text || 'Could not request Aadhaar OTP',
    );
  }

  const externalTxnId = typeof result.body?.txnId === 'string' ? result.body.txnId.trim() : '';
  if (!externalTxnId) {
    await repo.updateTransaction(transaction.id, {
      status: 'FAILED',
      lastErrorCode: 'ABDM_ERROR',
      safeMetadata: { patientId, step: 'request_otp', requestId: result.requestId },
    });
    throw new AppError(502, 'ABHA_OTP_REQUEST_FAILED', 'Could not request Aadhaar OTP');
  }
  const agreedAt = new Date().toISOString();
  await repo.updateTransaction(transaction.id, {
    status: 'ACCEPTED',
    externalTxnId,
    safeMetadata: {
      patientId,
      step: 'request_otp',
      requestId: result.requestId,
      consent: { code: 'abha-enrollment', version: '1.4', agreedAt },
    },
  });
  putEnrolmentSession(transaction.id, {
    aadhaarCiphertext: encryptedAadhaar,
    aadhaarTxnId: externalTxnId,
    aadhaarResendCount: 0,
    patientId,
    otpExpiresAt: otpDeadline(),
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
    message: `Staff ${actorName || 'staff'} recorded ABHA enrolment consent for patient ${patient.name}.`,
  });

  const issuedAt = getEnrolmentSession(transaction.id)?.otpExpiresAt;
  return {
    transactionId: transaction.id,
    status: 'ACCEPTED',
    message: abdmMessage(result.body),
    otpExpiresAt: issuedAt ? new Date(issuedAt).toISOString() : null,
  };
}

export async function resendOtp({
  transactionId,
  channel,
  actorId,
  facilityId,
  http,
}) {
  const transaction = await repo.findTransaction(transactionId);
  if (!transaction || transaction.workflow !== 'abha.enrol.aadhaar_otp') {
    throw new AppError(404, 'TRANSACTION_NOT_FOUND', 'Enrolment transaction not found');
  }
  const patientId = transaction.safeMetadata?.patientId;
  const patient = await requirePatient(patientId, facilityId);
  const session = getEnrolmentSession(transactionId);
  const countKey = channel === 'mobile' ? 'mobileResendCount' : 'aadhaarResendCount';
  const used = session?.[countKey] || 0;
  if (used >= MAX_OTP_RESENDS) {
    throw new AppError(400, 'OTP_RESEND_LIMIT', RESEND_LIMIT_MESSAGE);
  }

  const ciphertext = channel === 'mobile' ? session?.mobileCiphertext : session?.aadhaarCiphertext;
  const txnId = channel === 'mobile' ? session?.mobileTxnId : session?.aadhaarTxnId;
  if (!session || !ciphertext || !txnId) {
    throw new AppError(409, 'ABHA_SESSION_EXPIRED', 'Enrolment session expired; request the OTP again');
  }

  const contract = getContract(channel === 'mobile' ? 'requestMobileOtp' : 'requestAadhaarOtp');
  const result = await abdmRequest({
    contract,
    http,
    body: {
      txnId,
      scope: contract.scope,
      loginHint: contract.loginHint,
      loginId: ciphertext,
      otpSystem: contract.otpSystem,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new AppError(
      502,
      'ABHA_OTP_REQUEST_FAILED',
      abdmMessage(result.body) || 'Could not resend the OTP',
    );
  }

  const nextCount = used + 1;
  const nextTxn = result.body?.txnId || txnId;
  const expiresAt = otpDeadline();
  putEnrolmentSession(transactionId, {
    ...session,
    [countKey]: nextCount,
    ...(channel === 'mobile'
      ? { mobileTxnId: nextTxn, mobileOtpExpiresAt: expiresAt }
      : { aadhaarTxnId: nextTxn, otpExpiresAt: expiresAt }),
  });
  if (channel === 'mobile') {
    await repo.updateTransaction(transaction.id, {
      externalTxnId: nextTxn,
      safeMetadata: {
        ...transaction.safeMetadata,
        step: 'mobile_otp_resent',
        requestId: result.requestId,
        mobileResendCount: nextCount,
      },
    });
  } else {
    await repo.updateTransaction(transaction.id, {
      externalTxnId: nextTxn,
      safeMetadata: {
        ...transaction.safeMetadata,
        step: 'otp_resent',
        requestId: result.requestId,
        aadhaarResendCount: nextCount,
      },
    });
  }

  await logAudit({
    actorId,
    facilityId,
    action: 'abha.enrol.otp_resend',
    resourceType: 'patient',
    resourceId: patientId,
    outcome: 'success',
    correlationId: transaction.correlationId,
    message: `ABHA OTP resent for patient ${patient.name}.`,
  });

  return {
    transactionId: transaction.id,
    status: 'ACCEPTED',
    message: abdmMessage(result.body),
    resendCount: nextCount,
    otpExpiresAt: new Date(expiresAt).toISOString(),
  };
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
  assertOtpCurrent(getEnrolmentSession(transactionId)?.otpExpiresAt);

  const contract = getContract('enrolByAadhaar');

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
    const upstream = abdmMessage(result.body) || 'The OTP could not be verified';
    await repo.updateTransaction(transaction.id, {
      status: 'ACCEPTED',
      lastErrorCode: code,
      safeMetadata: {
        ...transaction.safeMetadata,
        step: 'verify_otp',
        requestId: result.requestId,
      },
    });
    throw new AppError(400, 'ABHA_OTP_INVALID', upstream, {
      details: [{ path: 'otp', message: upstream }],
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
  const profile = profileFromEnrolment(result.body);
  const shownNumber = profile.abhaNumber || displayAbhaNumber(abhaNumber);
  if (mobile && /^\d{10}$/.test(mobile)) {
    profile.mobile = mobile;
    await repo.updatePatientMobileLast4(patientId, mobile.slice(-4));
    if (typeof repo.storePatientMobile === 'function') {
      await repo.storePatientMobile(patientId, {
        mobileHash: hashMobile(mobile),
        mobileEnc: encryptAbhaNumberAtRest(mobile),
      });
    }
  }
  const prior = getEnrolmentSession(transaction.id);
  const needsMobileVerify = communicationMobileNeedsOtp(result.body, mobile);
  putEnrolmentSession(transaction.id, {
    userToken: token,
    refreshToken,
    abhaNumberMasked: masked,
    externalTxnId: result.body?.txnId || transaction.externalTxnId,
    patientId,
    needsMobileVerify,
    aadhaarCiphertext: prior?.aadhaarCiphertext,
    aadhaarTxnId: prior?.aadhaarTxnId || transaction.externalTxnId,
    aadhaarResendCount: prior?.aadhaarResendCount || 0,
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

  let mobileMessage = null;
  if (needsMobileVerify) {
    const mobileContract = getContract('requestMobileOtp');
    const encMobile = await encryptForAbha(mobile, { http });
    const enrolTxnId = result.body?.txnId || transaction.externalTxnId;
    const mobileResult = await abdmRequest({
      contract: mobileContract,
      http,
      body: {
        txnId: enrolTxnId,
        scope: mobileContract.scope,
        loginHint: mobileContract.loginHint,
        loginId: encMobile,
        otpSystem: mobileContract.otpSystem,
      },
    });
    if (mobileResult.status < 200 || mobileResult.status >= 300) {
      throw new AppError(
        502,
        'ABHA_OTP_REQUEST_FAILED',
        abdmMessage(mobileResult.body) || 'Could not request the mobile OTP',
      );
    }
    const mobileTxnId = mobileResult.body?.txnId || enrolTxnId;
    mobileMessage = abdmMessage(mobileResult.body);
    const mobileOtpExpiresAt = otpDeadline();
    const current = getEnrolmentSession(transaction.id);
    putEnrolmentSession(transaction.id, {
      ...current,
      mobileCiphertext: encMobile,
      mobileTxnId,
      mobileResendCount: 0,
      needsMobileVerify: true,
      mobileOtpExpiresAt,
    });
    await repo.updateTransaction(transaction.id, {
      externalTxnId: mobileTxnId,
      safeMetadata: {
        patientId,
        step: 'mobile_otp_requested',
        requestId: mobileResult.requestId,
        isNew,
        abhaNumberMasked: masked,
      },
    });
  }

  return {
    status: 'ACCEPTED',
    abhaNumberMasked: masked,
    abhaNumber: shownNumber,
    profile: { ...profile, abhaNumber: shownNumber },
    isNew,
    needsMobileVerify,
    message: abdmMessage(result.body),
    mobileMessage,
    otpExpiresAt: needsMobileVerify
      ? new Date(getEnrolmentSession(transaction.id)?.mobileOtpExpiresAt).toISOString()
      : null,
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
  assertOtpCurrent(session?.mobileOtpExpiresAt);
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
    const upstream = abdmMessage(result.body) || 'The mobile OTP could not be verified';
    await repo.updateTransaction(transaction.id, {
      status: 'ACCEPTED',
      lastErrorCode: abdmErrorCode(result.body),
    });
    throw new AppError(400, 'ABHA_OTP_INVALID', upstream, {
      details: [{ path: 'otp', message: upstream }],
    });
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
  useExisting,
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
  const rules = abhaAddressRules(abhaAddress);
  const wireAddress = rules.wire || abhaAddress;

  if (useExisting) {
    const identity = await repo.findAbhaIdentity(patientId);
    if (identity) {
      await repo.updateAbhaAddress(patientId, {
        abhaAddress: wireAddress,
        abhaNumberMasked: identity.abhaNumberMasked,
      });
    }
    await repo.updateTransaction(transaction.id, {
      status: 'ACCEPTED',
      safeMetadata: {
        ...transaction.safeMetadata,
        step: 'address_existing',
        abhaAddress: wireAddress,
      },
    });
    await logAudit({
      actorId,
      facilityId,
      action: 'abha.enrol.address',
      resourceType: 'patient',
      resourceId: patientId,
      outcome: 'success',
      correlationId: transaction.correlationId,
      message: `Existing ABHA address kept for patient ${patient.name}.`,
    });
    return {
      status: 'ACCEPTED',
      abhaNumberMasked: transaction.safeMetadata?.abhaNumberMasked || null,
      abhaAddress: wireAddress,
      existing: true,
    };
  }

  const contract = getContract('createAbhaAddress');
  const result = await abdmRequest({
    contract,
    http,
    body: {
      txnId: transaction.externalTxnId,
      abhaAddress: wireAddress,
      preferred: 1,
    },
  });

  if (result.status < 200 || result.status >= 300) {
    if (addressTaken(result.body)) {
      await repo.updateTransaction(transaction.id, {
        status: 'ACCEPTED',
        lastErrorCode: abdmErrorCode(result.body),
        safeMetadata: {
          ...transaction.safeMetadata,
          step: 'address_taken',
        },
      });
      throw new AppError(409, 'ABHA_ADDRESS_EXISTS', ADDRESS_EXISTS_MESSAGE);
    }
    await repo.updateTransaction(transaction.id, {
      status: 'ACCEPTED',
      lastErrorCode: abdmErrorCode(result.body),
    });
    throw new AppError(
      400,
      'ABHA_ADDRESS_FAILED',
      abdmMessage(result.body) || 'Could not create the ABHA address',
    );
  }

  const preferred = result.body?.preferredAbhaAddress || wireAddress;
  const shownNumber = displayAbhaNumber(result.body?.healthIdNumber);
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
  // Keep the enrolment session so the card can still be fetched with the user token.
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
    abhaNumber: shownNumber,
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

export async function demographicsForHipLink({ patientId, facilityId }) {
  const patient = await repo.findPatientInFacility(patientId, facilityId);
  if (!patient) throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found');
  const identity = await repo.findAbhaIdentity(patientId);
  const yearOfBirth = patient.dateOfBirth
    ? new Date(patient.dateOfBirth).getUTCFullYear()
    : null;
  if (!identity || identity.verificationStatus !== 'VERIFIED' || !identity.abhaAddress) {
    return { verified: false, patient, yearOfBirth };
  }
  return {
    verified: true,
    patient,
    yearOfBirth,
    abhaAddress: identity.abhaAddress,
    abhaNumber: decryptAbhaNumberAtRest(identity.abhaNumberEnc),
    name: patient.name,
    gender: patient.gender,
  };
}
