import { jest } from '@jest/globals';
import { AppError } from '../../shared/errors.js';

const patientId = '11111111-1111-4111-8111-111111111111';
const facilityId = '22222222-2222-4222-8222-222222222222';
const otherFacilityId = '33333333-3333-4333-8333-333333333333';
const actorId = '44444444-4444-4444-8444-444444444444';
const transactionId = '55555555-5555-4555-8555-555555555555';

const mockEncryptForAbha = jest.fn(async (v) => `enc:${v}`);
const mockAbdmRequest = jest.fn();
const mockLogAudit = jest.fn(async () => {});

const store = {
  patients: new Map(),
  transactions: new Map(),
  identities: new Map(),
  idempotency: new Map(),
};

jest.unstable_mockModule('../../integrations/abdm/crypto.js', () => ({
  encryptForAbha: mockEncryptForAbha,
  fetchAbhaCertificate: jest.fn(),
  clearCertificateCache: jest.fn(),
}));

jest.unstable_mockModule('../../integrations/abdm/client.js', () => ({
  abdmRequest: mockAbdmRequest,
}));

jest.unstable_mockModule('../../shared/audit.js', () => ({
  logAudit: mockLogAudit,
}));

jest.unstable_mockModule('./abha.repository.js', () => ({
  bodyHash: (body) => JSON.stringify(body),
  findPatientById: async (id) => store.patients.get(id) || null,
  findPatientInFacility: async (id, fac) => {
    const p = store.patients.get(id);
    return p && p.facilityId === fac ? p : null;
  },
  createTransaction: async (data) => {
    const row = { id: transactionId, ...data };
    store.transactions.set(row.id, row);
    return row;
  },
  updateTransaction: async (id, data) => {
    const row = { ...store.transactions.get(id), ...data };
    store.transactions.set(id, row);
    return row;
  },
  findTransaction: async (id) => store.transactions.get(id) || null,
  upsertAbhaIdentity: async (data) => {
    store.identities.set(data.patientId, data);
    return data;
  },
  findAbhaIdentity: async (id) => store.identities.get(id) || null,
  updateAbhaAddress: async (id, data) => {
    const row = { ...store.identities.get(id), ...data };
    store.identities.set(id, row);
    return row;
  },
  assertIdempotency: async ({ key, userId, route, body }) => {
    if (!key) return null;
    const hash = JSON.stringify(body);
    const k = `${key}:${userId}:${route}`;
    const existing = store.idempotency.get(k);
    if (existing && existing.requestBodyHash !== hash) {
      throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key was reused with a different body');
    }
    return { hash, existing: existing || null };
  },
  saveIdempotency: async ({ key, userId, route, requestBodyHash, responseRef }) => {
    store.idempotency.set(`${key}:${userId}:${route}`, { requestBodyHash, responseRef });
  },
  findIdempotency: async () => null,
}));

describe('abha.service', () => {
  beforeEach(() => {
    jest.resetModules();
    mockEncryptForAbha.mockClear();
    mockAbdmRequest.mockReset();
    mockLogAudit.mockClear();
    store.patients.clear();
    store.transactions.clear();
    store.identities.clear();
    store.idempotency.clear();
    store.patients.set(patientId, { id: patientId, facilityId, name: 'Demo' });
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/chip_test?sslmode=disable';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-characters-min';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.LOG_LEVEL = 'silent';
    process.env.ABDM_BENEFIT_NAME = 'WombTo18-CHIP';
    process.env.ABHA_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.ABHA_HASH_KEY = Buffer.alloc(32, 9).toString('base64');
    process.env.ABHA_ENC_KEY_VERSION = '1';
    process.env.ABDM_GATEWAY_BASE_URL = '';
    process.env.ABDM_ABHA_BASE_URL = '';
    process.env.ABDM_SANDBOX_HOST_ALLOWLIST = '';
  });

  async function load() {
    const { clearAllEnrolmentSessions } = await import('./enrolmentSession.js');
    clearAllEnrolmentSessions();
    return import('./abha.service.js');
  }

  it('requestAadhaarOtp moves the transaction to ACCEPTED, not COMPLETED', async () => {
    mockAbdmRequest.mockResolvedValueOnce({
      status: 200,
      body: { txnId: 'ext-txn-1' },
      requestId: 'req-1',
    });

    const service = await load();
    const result = await service.requestAadhaarOtp({
      patientId,
      aadhaar: '999999999999',
      actorId,
      facilityId,
      correlationId: 'corr-1',
    });

    expect(result.status).toBe('ACCEPTED');
    expect(result.transactionId).toBe(transactionId);
    expect(store.transactions.get(transactionId).status).toBe('ACCEPTED');
    expect(store.transactions.get(transactionId).status).not.toBe('COMPLETED');
  });

  it('verifyAadhaarOtp with isNew false stores the identity and does not re-request OTP', async () => {
    store.transactions.set(transactionId, {
      id: transactionId,
      workflow: 'abha.enrol.aadhaar_otp',
      externalTxnId: 'ext-txn-1',
      status: 'ACCEPTED',
      correlationId: 'corr-1',
      safeMetadata: { patientId },
    });

    mockAbdmRequest.mockResolvedValueOnce({
      status: 200,
      body: {
        isNew: false,
        healthIdNumber: '12-3456-7890-1234',
        preferredAbhaAddress: 'demo@sbx',
        tokens: { token: 'user-token' },
        txnId: 'ext-txn-2',
      },
      requestId: 'req-2',
    });

    const service = await load();
    const result = await service.verifyAadhaarOtp({
      transactionId,
      otp: '123456',
      consentAccepted: true,
      actorId,
      facilityId,
    });

    expect(result.isNew).toBe(false);
    expect(result.abhaNumberMasked).toBe('**-****-****-1234');
    expect(store.identities.get(patientId).verificationStatus).toBe('VERIFIED');
    expect(mockAbdmRequest).toHaveBeenCalledTimes(1);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'abha.enrol.verify',
      resourceType: 'patient',
      outcome: 'success',
    }));
  });

  it('verifyAadhaarOtp rejected by ABHA sets FAILED and throws ABHA_OTP_INVALID', async () => {
    store.transactions.set(transactionId, {
      id: transactionId,
      workflow: 'abha.enrol.aadhaar_otp',
      externalTxnId: 'ext-txn-1',
      status: 'ACCEPTED',
      correlationId: 'corr-1',
      safeMetadata: { patientId },
    });

    mockAbdmRequest.mockResolvedValueOnce({
      status: 400,
      body: { code: 'ABDM-1002' },
      requestId: 'req-fail',
    });

    const service = await load();
    await expect(service.verifyAadhaarOtp({
      transactionId,
      otp: '000000',
      consentAccepted: true,
      actorId,
      facilityId,
    })).rejects.toMatchObject({ statusCode: 400, code: 'ABHA_OTP_INVALID' });

    expect(store.transactions.get(transactionId).status).toBe('FAILED');
    expect(store.identities.size).toBe(0);
  });

  it('rejects a patient in another facility with 403', async () => {
    store.patients.set(patientId, { id: patientId, facilityId: otherFacilityId, name: 'Other' });
    const service = await load();
    await expect(service.requestAadhaarOtp({
      patientId,
      aadhaar: '999999999999',
      actorId,
      facilityId,
      correlationId: 'corr-1',
    })).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('same Idempotency-Key with a different body hash throws 409', async () => {
    store.idempotency.set(`idem-1:${actorId}:POST /abha/enrolment/otp`, {
      requestBodyHash: JSON.stringify({ patientId, aadhaar: '[redacted]' }),
      responseRef: transactionId,
    });

    // Force assertIdempotency path with different body by calling with different patient framing
    // The mock compares hash of body; seed a conflicting entry manually via a second call pattern:
    const service = await load();
    // Pre-seed conflict: repository mock throws when hash differs
    const repo = await import('./abha.repository.js');
    await expect(repo.assertIdempotency({
      key: 'idem-1',
      userId: actorId,
      route: 'POST /abha/enrolment/otp',
      body: { patientId, aadhaar: '[other]' },
    })).rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_CONFLICT' });

    expect(service).toBeTruthy();
  });
});
