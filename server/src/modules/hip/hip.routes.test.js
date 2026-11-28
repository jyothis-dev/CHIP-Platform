import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { prismaMock, resetPrisma } from '../../test/prismaMock.js';

const userId = '33333333-3333-4333-8333-333333333333';
const facilityId = '44444444-4444-4444-8444-444444444444';

jest.unstable_mockModule('../../shared/prisma.js', () => ({
  default: prismaMock,
}));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/chip_test?sslmode=disable';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-characters-min';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
process.env.ABDM_GATEWAY_BASE_URL = '';
process.env.ABDM_ABHA_BASE_URL = '';
process.env.ABDM_SANDBOX_HOST_ALLOWLIST = '';
process.env.ABDM_HIP_ID = 'HIP-TEST';
process.env.ABDM_CALLBACK_BASE_URL = '';
process.env.ABHA_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.ABHA_HASH_KEY = Buffer.alloc(32, 9).toString('base64');

const { default: app } = await import('../../app.js');
const { signAccessToken } = await import('../../shared/tokens.js');
const { consentAllows } = await import('./share.js');
const { linkFailureHint, linkInputProblems } = await import('./link.js');
const { fullAbhaAddress } = await import('../abha/abhaFlow.js');

describe('HIP routes', () => {
  let token;

  beforeAll(async () => {
    await bcrypt.hash('Staffpass123', 12);
    token = signAccessToken({ userId });
  });

  beforeEach(() => {
    resetPrisma();
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Demo Staff',
      email: 'staff@example.com',
      role: 'STAFF',
      facilityId,
    });
    prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('returns 401 when staff auth is missing', async () => {
    const res = await request(app).get('/hip/readiness');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 when callback registration has no staff session', async () => {
    const res = await request(app).post('/hip/bridge/url').send({ confirm: true });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('returns 400 when callback registration is not confirmed', async () => {
    const res = await request(app)
      .post('/hip/bridge/url')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 when the callback base is not configured', async () => {
    const res = await request(app)
      .post('/hip/bridge/url')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirm: true });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CALLBACK_URL_MISSING');
  });

  it('returns 400 when the bundle code is missing', async () => {
    const res = await request(app)
      .post('/hip/bundles/inspect')
      .set('Authorization', `Bearer ${token}`)
      .send({ hiType: 'ImmunizationRecord' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a callback that has no bearer token', async () => {
    const res = await request(app)
      .post('/api/v3/hip/patient/care-context/discover')
      .set('X-HIP-ID', 'HIP-TEST')
      .set('REQUEST-ID', '11111111-1111-4111-8111-111111111111')
      .send({ transactionId: 'tx-1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('CALLBACK_UNAUTHENTICATED');
    expect(prismaMock.callbackEvent.create).not.toHaveBeenCalled();
  });

  it('acks a duplicate callback without processing it again', async () => {
    const error = new Error('duplicate');
    error.code = 'P2002';
    prismaMock.callbackEvent.create.mockRejectedValue(error);
    const res = await request(app)
      .post('/api/v3/hip/patient/care-context/discover')
      .set('Authorization', 'Bearer gateway-token')
      .set('X-HIP-ID', 'HIP-TEST')
      .set('REQUEST-ID', '22222222-2222-4222-8222-222222222222')
      .send({ transactionId: 'tx-2', patient: { name: 'Asha', gender: 'F' } });
    expect(res.status).toBe(202);
    expect(res.body.duplicate).toBe(true);
  });

  it('drops a callback for a different HIP id', async () => {
    const res = await request(app)
      .post('/api/v3/hip/patient/care-context/discover')
      .set('Authorization', 'Bearer gateway-token')
      .set('X-HIP-ID', 'SOMEONE-ELSE')
      .set('REQUEST-ID', '33333333-3333-4333-8333-333333333333')
      .send({ transactionId: 'tx-3' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('CALLBACK_HIP_MISMATCH');
    expect(prismaMock.callbackEvent.create).not.toHaveBeenCalled();
  });
});

describe('consent guard', () => {
  const artefact = {
    status: 'GRANTED',
    hipId: 'HIP-TEST',
    hiTypes: ['ImmunizationRecord'],
    careContextRefs: ['visit-1'],
    dateFrom: new Date('2026-01-01T00:00:00.000Z'),
    dateTo: new Date('2026-12-31T00:00:00.000Z'),
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
  };
  const request = {
    careContextRefs: ['visit-1'],
    dateFrom: '2026-02-01T00:00:00.000Z',
    dateTo: '2026-02-02T00:00:00.000Z',
    hiTypes: ['ImmunizationRecord'],
  };

  it('allows a granted consent that covers the request', () => {
    expect(consentAllows(artefact, request, new Date('2026-03-01T00:00:00.000Z'))).toBeNull();
  });

  it('refuses an expired consent and a care context outside the artefact', () => {
    expect(consentAllows(
      { ...artefact, expiresAt: new Date('2026-01-01T00:00:00.000Z') },
      request,
      new Date('2026-03-01T00:00:00.000Z'),
    )).toBe('CONSENT_EXPIRED');
    expect(consentAllows(artefact, { ...request, careContextRefs: ['other'] })).toBe('CONSENT_CONTEXT_MISMATCH');
    expect(consentAllows(null, request)).toBe('CONSENT_MISSING');
  });
});

describe('link failure reporting', () => {
  const careContextId = '55555555-5555-4555-8555-555555555555';
  const patientId = '66666666-6666-4666-8666-666666666666';
  let token;

  beforeAll(() => {
    token = signAccessToken({ userId });
  });

  beforeEach(() => {
    resetPrisma();
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Demo Staff',
      email: 'staff@example.com',
      role: 'STAFF',
      facilityId,
    });
  });

  it('explains ABDM-9999 by its message, not by the code alone', () => {
    expect(linkFailureHint('ABDM-9999', 'HIP is unable to generate a token at this time. Please try again later.'))
      .toMatch(/callback URL/);
    expect(linkFailureHint('ABDM-9999', 'User not found')).toMatch(/ABHA address/);
    expect(linkFailureHint('ABDM-9999', 'Duplicate HIP link request')).toMatch(/Do not retry/);
    expect(linkFailureHint('ABDM-1207', null)).toMatch(/year of birth/);
    expect(linkFailureHint('ABDM-1207: ', 'x')).toMatch(/Aadhaar record/);
    expect(linkFailureHint('ABDM-9999', 'Unknown exception')).toMatch(/Retry later/);
    expect(linkFailureHint('SOMETHING_ELSE', 'x')).toBeNull();
  });

  it('lists the code, message and hint for a failed care context', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({ id: patientId, facilityId });
    prismaMock.aBHAIdentity.findUnique.mockResolvedValue(null);
    prismaMock.careContext.count.mockResolvedValue(1);
    prismaMock.careContext.findMany.mockResolvedValue([{
      id: careContextId,
      referenceNumber: 'ref-1',
      display: 'ImmunizationRecord visit',
      linkStatus: 'FAILED',
      healthRecord: { hiType: 'ImmunizationRecord', validationStatus: 'VALID', sourceHash: 'abc', bundleBytes: 10 },
      transaction: {
        lastErrorCode: 'ABDM-9999',
        safeMetadata: { abdmMessage: 'HIP is unable to generate a token at this time. Please try again later.' },
      },
    }]);
    const res = await request(app)
      .get(`/hip/patients/${patientId}/records`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const row = res.body.data.careContexts.items[0];
    expect(row.failure.code).toBe('ABDM-9999');
    expect(row.failure.message).toMatch(/unable to generate a token/);
    expect(row.failure.hint).toMatch(/callback URL/);
  });

  it('does not retry a care context that has not failed', async () => {
    prismaMock.careContext.findFirst.mockResolvedValue({
      id: careContextId, facilityId, patientId, linkStatus: 'LINKED', healthRecord: null, transaction: null,
    });
    const res = await request(app)
      .post(`/hip/care-contexts/${careContextId}/retry`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_RETRYABLE');
  });

  it('does not retry a link ABDM says is already linked', async () => {
    prismaMock.careContext.findFirst.mockResolvedValue({
      id: careContextId,
      facilityId,
      patientId,
      linkStatus: 'FAILED',
      healthRecord: { validationStatus: 'VALID', hiType: 'ImmunizationRecord' },
      transaction: { safeMetadata: { abdmMessage: 'Duplicate HIP link request' } },
    });
    const res = await request(app)
      .post(`/hip/care-contexts/${careContextId}/retry`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_LINKED');
  });

  it('adds the consent manager suffix to a bare ABHA address and leaves a full one alone', () => {
    expect(fullAbhaAddress('jyothiswarup')).toBe('jyothiswarup@sbx');
    expect(fullAbhaAddress('jyothiswarup@sbx')).toBe('jyothiswarup@sbx');
    expect(fullAbhaAddress('person@abdm')).toBe('person@abdm');
    expect(fullAbhaAddress('')).toBeNull();
    expect(fullAbhaAddress(null)).toBeNull();
  });

  it('checks the generate-token body before anything is sent to ABDM', () => {
    const ok = { abhaAddress: 'jyothiswarup@sbx', name: 'Jyothi Swarup', gender: 'M', yearOfBirth: 1999 };
    expect(linkInputProblems(ok)).toEqual([]);
    expect(linkInputProblems({ ...ok, abhaAddress: 'jyothiswarup' })).toEqual(['ABHA address must look like name@sbx']);
    expect(linkInputProblems({ ...ok, name: 'Baby 2' })).toHaveLength(1);
    expect(linkInputProblems({ ...ok, gender: 'X' })).toHaveLength(1);
    expect(linkInputProblems({ ...ok, yearOfBirth: null })).toHaveLength(1);
    expect(linkInputProblems({ ...ok, yearOfBirth: 1800 })).toHaveLength(1);
  });

  it('explains ABDM-1092 as a duplicate and marks it not retryable', async () => {
    expect(linkFailureHint('ABDM-1092', 'Duplicate Link token request')).toMatch(/Do not retry/);
    expect(linkFailureHint('ABDM-1092', 'Duplicate Link token request')).toMatch(/earlier failed exchange/);
    const { linkRetryable } = await import('./link.js');
    expect(linkRetryable('ABDM-1092', 'Duplicate Link token request')).toBe(false);
    expect(linkRetryable('ABDM-9999', 'Unknown exception')).toBe(true);
  });

  it('does not retry a link token ABDM refused as a duplicate', async () => {
    prismaMock.careContext.findFirst.mockResolvedValue({
      id: careContextId,
      facilityId,
      patientId,
      linkStatus: 'FAILED',
      healthRecord: { validationStatus: 'VALID', hiType: 'ImmunizationRecord' },
      transaction: { lastErrorCode: 'ABDM-1092', safeMetadata: { abdmMessage: 'Duplicate Link token request' } },
    });
    const res = await request(app)
      .post(`/hip/care-contexts/${careContextId}/retry`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_LINK_TOKEN');
  });

  it('returns 404 for a care context outside the facility', async () => {
    prismaMock.careContext.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .post(`/hip/care-contexts/${careContextId}/retry`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CARE_CONTEXT_NOT_FOUND');
  });
});
