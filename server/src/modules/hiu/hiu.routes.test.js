import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import request from 'supertest';
import { prismaMock, resetPrisma } from '../../test/prismaMock.js';

const userId = '33333333-3333-4333-8333-333333333333';
const facilityId = '44444444-4444-4444-8444-444444444444';
const patientId = '55555555-5555-4555-8555-555555555555';
const requestRowId = '66666666-6666-4666-8666-666666666666';
const artefactRowId = '77777777-7777-4777-8777-777777777777';

const mockAbdmRequest = jest.fn();

jest.unstable_mockModule('../../shared/prisma.js', () => ({ default: prismaMock }));
jest.unstable_mockModule('../../integrations/abdm/client.js', () => ({ abdmRequest: mockAbdmRequest }));

process.env.NODE_ENV = 'test';
process.env.ABDM_TRACE = 'false';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/chip_test?sslmode=disable';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-characters-min';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
process.env.ABDM_GATEWAY_BASE_URL = '';
process.env.ABDM_ABHA_BASE_URL = '';
process.env.ABDM_SANDBOX_HOST_ALLOWLIST = '';
process.env.ABDM_CLIENT_ID = '';
process.env.ABDM_HIP_ID = 'HIP-TEST';
process.env.ABDM_HIU_ID = 'HIU-TEST';
process.env.ABDM_CALLBACK_BASE_URL = 'https://callbacks.example.org';
process.env.ABHA_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.ABHA_HASH_KEY = Buffer.alloc(32, 9).toString('base64');

const { default: app } = await import('../../app.js');
const { signAccessToken } = await import('../../shared/tokens.js');
const { canMove } = await import('./consent.js');
const { processPush } = await import('./dataflow.js');
const { generateKeyMaterial, encryptForRequester } = await import('../../integrations/abdm/fidelius.js');
const { encryptAbhaNumberAtRest } = await import('../abha/abha.crypto.js');
const { buildBundle } = await import('../../integrations/abdm/fhir/bundle.js');

const past = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
const future = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

function asUser(role) {
  prismaMock.user.findUnique.mockResolvedValue({
    id: userId, name: 'Dr Test', email: 'dr@example.com', role, facilityId,
  });
}

function gatewayAccepts() {
  let n = 0;
  mockAbdmRequest.mockImplementation(async () => {
    n += 1;
    return { status: 202, body: '', requestId: `req-${n}`, headers: {} };
  });
}

const validBody = () => ({
  patientId,
  purposeCode: 'CAREMGT',
  hiTypes: ['ImmunizationRecord', 'Prescription'],
  dateFrom: past(365),
  dateTo: past(0.01),
  dataEraseAt: future(30),
});

describe('HIU staff routes', () => {
  const token = signAccessToken({ userId });

  beforeEach(() => {
    resetPrisma();
    mockAbdmRequest.mockReset();
    prismaMock.aBDMTransaction.create.mockImplementation(async ({ data }) => ({ id: `tx-${data.requestId}`, ...data }));
    prismaMock.facility.findUnique.mockResolvedValue({ id: facilityId, name: 'Sahyadri Hospital', hfrId: 'IN0000000001' });
  });

  it('refuses a consent request from STAFF', async () => {
    asUser('STAFF');
    const res = await request(app).post('/hiu/consent-requests').set('Authorization', `Bearer ${token}`).send(validBody());
    expect(res.status).toBe(403);
    expect(mockAbdmRequest).not.toHaveBeenCalled();
  });

  it('refuses a date range that ends in the future', async () => {
    asUser('CLINICIAN');
    const res = await request(app).post('/hiu/consent-requests').set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(), dateTo: future(2) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/future/);
  });

  it('refuses a patient without an ABHA address', async () => {
    asUser('CLINICIAN');
    prismaMock.patient.findUnique.mockResolvedValue({ id: patientId, facilityId, abhaIdentity: null });
    const res = await request(app).post('/hiu/consent-requests').set('Authorization', `Bearer ${token}`).send(validBody());
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ABHA_ADDRESS_REQUIRED');
  });

  it('sends the documented init body and stores INIT_SENT', async () => {
    asUser('CLINICIAN');
    gatewayAccepts();
    prismaMock.patient.findUnique.mockResolvedValue({
      id: patientId, facilityId, name: 'Asha', abhaIdentity: { abhaAddress: 'asha.k@sbx', abhaNumberMasked: 'xx-xxxx-1234' },
    });
    prismaMock.consentRequest.create.mockImplementation(async ({ data }) => data);
    prismaMock.consentRequest.findUnique.mockImplementation(async () => ({
      ...prismaMock.consentRequest.create.mock.calls[0][0].data,
      createdAt: new Date(),
      patient: { id: patientId, name: 'Asha', abhaIdentity: { abhaAddress: 'asha.k@sbx' } },
      artefacts: [],
    }));
    const res = await request(app).post('/hiu/consent-requests').set('Authorization', `Bearer ${token}`).send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('INIT_SENT');
    const call = mockAbdmRequest.mock.calls[0][0];
    expect(call.contract.name).toBe('hiuConsentInit');
    expect(call.contract.headers).toContain('X-CM-ID');
    expect(call.contract.headers).not.toContain('X-HIU-ID');
    const { consent } = call.body;
    expect(consent.purpose).toEqual({ text: 'Care Management', code: 'CAREMGT', refUri: 'https://callbacks.example.org' });
    expect(consent.patient).toEqual({ id: 'asha.k@sbx' });
    expect(consent.hiu).toEqual({ id: 'HIU-TEST' });
    expect(consent.hiTypes).toEqual(['ImmunizationRecord', 'Prescription']);
    expect(consent.permission.accessMode).toBe('VIEW');
    expect(consent.permission.dataEraseAt).toMatch(/Z$/);
    expect(consent.permission.frequency).toEqual({ unit: 'HOUR', value: 1, repeats: 0 });
    expect(consent.requester.name).toBe('Sahyadri Hospital');
  });

  it('stores ABDM\'s own message when init is refused', async () => {
    asUser('ADMIN');
    mockAbdmRequest.mockResolvedValue({
      status: 400,
      requestId: 'req-bad',
      body: [{ error: { code: 'ABDM-9999', message: 'Invalid consent purpose refURI' } }],
    });
    prismaMock.patient.findUnique.mockResolvedValue({ id: patientId, facilityId, abhaIdentity: { abhaAddress: 'asha.k@sbx' } });
    prismaMock.consentRequest.create.mockImplementation(async ({ data }) => data);
    prismaMock.consentRequest.findUnique.mockImplementation(async () => ({
      ...prismaMock.consentRequest.create.mock.calls[0][0].data, artefacts: [],
    }));
    const res = await request(app).post('/hiu/consent-requests').set('Authorization', `Bearer ${token}`).send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('INIT_FAILED');
    expect(res.body.data.lastErrorCode).toBe('ABDM-9999');
    expect(res.body.data.lastErrorMessage).toBe('Invalid consent purpose refURI');
  });

  it('answers 410 with the reason for records under a revoked artefact', async () => {
    asUser('CLINICIAN');
    prismaMock.consentArtefact.findUnique.mockResolvedValue({
      id: artefactRowId, role: 'HIU', status: 'REVOKED', revokedAt: new Date(), consentRequest: { facilityId },
    });
    const res = await request(app).get(`/hiu/artefacts/${artefactRowId}/records`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('CONSENT_REVOKED');
    expect(prismaMock.receivedHealthRecord.findMany).not.toHaveBeenCalled();
  });

  it('reports missing pieces in readiness', async () => {
    asUser('STAFF');
    const res = await request(app).get('/hiu/readiness').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hiuIdConfigured).toBe(true);
    expect(res.body.data.dataPushUrl).toBe('https://callbacks.example.org/api/v3/hiu/health-information/transfer');
  });
});

describe('HIU callbacks', () => {
  beforeEach(() => {
    resetPrisma();
    mockAbdmRequest.mockReset();
    gatewayAccepts();
    prismaMock.aBDMTransaction.create.mockImplementation(async ({ data }) => ({ id: `tx-${data.requestId}`, ...data }));
    prismaMock.callbackEvent.create.mockResolvedValue({ id: 'cb-1' });
  });

  it('rejects a callback without a bearer before storing anything', async () => {
    const res = await request(app).post('/api/v3/hiu/consent/request/notify')
      .set('X-HIU-ID', 'HIU-TEST').set('REQUEST-ID', 'n-1').send({ notification: {} });
    expect(res.status).toBe(401);
    expect(prismaMock.callbackEvent.create).not.toHaveBeenCalled();
  });

  it('drops a callback for another HIU', async () => {
    const res = await request(app).post('/api/v3/hiu/consent/request/notify')
      .set('Authorization', 'Bearer gw').set('X-HIU-ID', 'SOMEONE-ELSE').set('REQUEST-ID', 'n-2').send({ notification: {} });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('CALLBACK_HIU_MISMATCH');
    expect(prismaMock.callbackEvent.create).not.toHaveBeenCalled();
  });

  it('drops an on-init that answers nothing we sent', async () => {
    prismaMock.aBDMTransaction.findUnique.mockResolvedValue(null);
    const res = await request(app).post('/api/v3/hiu/consent/request/on-init')
      .set('Authorization', 'Bearer gw').set('X-HIU-ID', 'HIU-TEST').set('REQUEST-ID', 'cb-x')
      .send({ consentRequest: { id: 'cr-1' }, response: { requestId: 'never-sent' } });
    expect(res.status).toBe(404);
    expect(prismaMock.callbackEvent.create).not.toHaveBeenCalled();
  });

  it('moves INIT_SENT to REQUESTED on on-init', async () => {
    prismaMock.aBDMTransaction.findUnique.mockResolvedValue({ id: 'tx-1', requestId: 'req-1' });
    prismaMock.consentRequest.findFirst.mockResolvedValue({ id: requestRowId, status: 'INIT_SENT' });
    prismaMock.consentRequest.update.mockResolvedValue({ id: requestRowId, status: 'REQUESTED' });
    const res = await request(app).post('/api/v3/hiu/consent/request/on-init')
      .set('Authorization', 'Bearer gw').set('X-HIU-ID', 'HIU-TEST').set('REQUEST-ID', 'cb-1')
      .send({ consentRequest: { id: 'cr-ext-1' }, error: null, response: { requestId: 'req-1' } });
    expect(res.status).toBe(202);
    const update = prismaMock.consentRequest.update.mock.calls[0][0];
    expect(update.data.status).toBe('REQUESTED');
    expect(update.data.externalConsentRequestId).toBe('cr-ext-1');
  });

  it('stores every artefact of a grant, acks them all, and fetches each', async () => {
    prismaMock.consentRequest.findUnique.mockResolvedValue({ id: requestRowId, status: 'REQUESTED' });
    prismaMock.consentRequest.update.mockResolvedValue({ id: requestRowId, status: 'GRANTED' });
    prismaMock.consentArtefact.upsert.mockResolvedValue({});
    prismaMock.consentArtefact.findUnique.mockImplementation(async ({ where }) => ({
      id: `row-${where.role_externalArtefactId.externalArtefactId}`,
      externalArtefactId: where.role_externalArtefactId.externalArtefactId,
      consentRequestId: requestRowId,
    }));
    prismaMock.consentArtefact.update.mockResolvedValue({});
    const res = await request(app).post('/api/v3/hiu/consent/request/notify')
      .set('Authorization', 'Bearer gw').set('X-HIU-ID', 'HIU-TEST').set('REQUEST-ID', 'notify-1')
      .send({
        notification: {
          consentRequestId: 'cr-ext-1',
          status: 'GRANTED',
          reason: null,
          consentArtefacts: [{ id: 'art-a' }, { id: 'art-b' }],
        },
      });
    expect(res.status).toBe(202);
    expect(prismaMock.consentArtefact.upsert).toHaveBeenCalledTimes(2);
    const names = mockAbdmRequest.mock.calls.map(([call]) => call.contract.name);
    expect(names).toEqual(['hiuConsentOnNotify', 'hiuConsentFetch', 'hiuConsentFetch']);
    const ack = mockAbdmRequest.mock.calls[0][0].body;
    expect(ack).toEqual({
      acknowledgement: [{ status: 'OK', consentId: 'art-a' }, { status: 'OK', consentId: 'art-b' }],
      response: { requestId: 'notify-1' },
    });
    expect(mockAbdmRequest.mock.calls[1][0].body).toEqual({ consentId: 'art-a' });
    expect(mockAbdmRequest.mock.calls[2][0].body).toEqual({ consentId: 'art-b' });
    expect(mockAbdmRequest.mock.calls[1][0].hiuId).toBe('HIU-TEST');
  });

  it('acks a denial with no fetch and no data request', async () => {
    prismaMock.consentRequest.findUnique.mockResolvedValue({ id: requestRowId, status: 'REQUESTED' });
    prismaMock.consentRequest.update.mockResolvedValue({ id: requestRowId, status: 'DENIED' });
    const res = await request(app).post('/api/v3/hiu/consent/request/notify')
      .set('Authorization', 'Bearer gw').set('X-HIU-ID', 'HIU-TEST').set('REQUEST-ID', 'notify-2')
      .send({ notification: { consentRequestId: 'cr-ext-1', status: 'DENIED', reason: null, consentArtefacts: [] } });
    expect(res.status).toBe(202);
    expect(prismaMock.consentRequest.update.mock.calls[0][0].data.status).toBe('DENIED');
    expect(prismaMock.consentRequest.update.mock.calls[0][0].data.deniedAt).toBeInstanceOf(Date);
    const names = mockAbdmRequest.mock.calls.map(([call]) => call.contract.name);
    expect(names).toEqual(['hiuConsentOnNotify']);
  });

  it('revokes, purges records and ends the request', async () => {
    prismaMock.consentRequest.findUnique.mockResolvedValue({ id: requestRowId, status: 'GRANTED' });
    prismaMock.consentArtefact.findUnique.mockResolvedValue({ id: artefactRowId, status: 'GRANTED', consentRequestId: requestRowId });
    prismaMock.consentArtefact.update.mockResolvedValue({ id: artefactRowId, status: 'REVOKED' });
    prismaMock.receivedHealthRecord.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.healthInformationRequest.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.consentArtefact.findMany.mockResolvedValue([{ id: artefactRowId, status: 'REVOKED' }]);
    prismaMock.consentRequest.update.mockResolvedValue({ id: requestRowId, status: 'REVOKED' });
    const res = await request(app).post('/api/v3/hiu/consent/request/notify')
      .set('Authorization', 'Bearer gw').set('X-HIU-ID', 'HIU-TEST').set('REQUEST-ID', 'notify-3')
      .send({ notification: { consentRequestId: 'cr-ext-1', status: 'REVOKED', reason: null, consentArtefacts: [{ id: 'art-a' }] } });
    expect(res.status).toBe(202);
    expect(prismaMock.receivedHealthRecord.updateMany.mock.calls[0][0].data.bundleEnc).toBeNull();
    expect(prismaMock.consentRequest.update.mock.calls[0][0].data.status).toBe('REVOKED');
  });
});

describe('state rule', () => {
  it('never leaves a terminal state and only ends a grant', () => {
    expect(canMove('REVOKED', 'GRANTED')).toBe(false);
    expect(canMove('DENIED', 'REQUESTED')).toBe(false);
    expect(canMove('GRANTED', 'DENIED')).toBe(false);
    expect(canMove('GRANTED', 'REVOKED')).toBe(true);
    expect(canMove('REQUESTED', 'EXPIRED')).toBe(true);
    expect(canMove('INIT_SENT', 'REQUESTED')).toBe(true);
  });
});

describe('data push processing', () => {
  beforeEach(() => {
    resetPrisma();
    mockAbdmRequest.mockReset();
    gatewayAccepts();
    prismaMock.aBDMTransaction.create.mockImplementation(async ({ data }) => ({ id: 'tx', ...data }));
    prismaMock.dataTransfer.create.mockImplementation(async ({ data }) => ({ id: `dt-${data.careContextReference}`, ...data }));
    prismaMock.receivedHealthRecord.create.mockResolvedValue({});
    prismaMock.healthInformationRequest.update.mockResolvedValue({});
  });

  function setup(checksumOverride) {
    const material = generateKeyMaterial({ expiresAt: Date.now() + 600_000 });
    const built = buildBundle({
      hiType: 'ImmunizationRecord',
      patientId,
      patientName: 'Asha',
      gender: 'female',
      birthDate: '1995-01-15',
      occurredAt: '2026-01-10T10:00:00.000Z',
      facilityName: 'Sahyadri Hospital',
      title: 'Immunization record',
      code: '33879002',
      codeDisplay: 'Administration of vaccine to produce active immunity',
      codeSystem: 'http://snomed.info/sct',
    });
    const plaintext = JSON.stringify(built.bundle);
    const sent = encryptForRequester({
      plaintext,
      requesterPublicKey: material.keyMaterial.dhPublicKey.keyValue,
      requesterNonce: material.nonce,
      cryptoAlg: 'ECDH',
      curve: 'curve25519',
    });
    const hir = {
      id: 'hir-1',
      nonce: material.nonce,
      privateKeyEnc: encryptAbhaNumberAtRest(material.privateKeyPkcs8),
      pagesReceived: 0,
      externalTransactionId: 'txn-1',
      consentArtefact: {
        id: artefactRowId,
        externalArtefactId: 'art-a',
        hipId: 'HIP-OTHER',
        hiTypes: ['ImmunizationRecord'],
        consentRequestId: requestRowId,
        consentRequest: { patientId },
      },
    };
    const body = {
      transactionId: 'txn-1',
      pageNumber: 1,
      pageCount: 1,
      entries: [{
        content: sent.content,
        media: 'application/fhir+json',
        checksum: checksumOverride || createHash('md5').update(plaintext).digest('hex'),
        careContextReference: 'visit-1',
      }],
      keyMaterial: {
        cryptoAlg: 'ECDH',
        curve: 'curve25519',
        dhPublicKey: { expiry: future(1), parameters: 'Curve25519/32byte random key', keyValue: sent.publicKey },
        nonce: sent.nonce,
      },
    };
    return { hir, body };
  }

  it('decrypts, checks the MD5, stores the record re-encrypted, and notifies TRANSFERRED', async () => {
    const { hir, body } = setup();
    prismaMock.dataTransfer.findMany.mockResolvedValue([
      { careContextReference: 'visit-1', status: 'RECEIVED', receiptStatus: 'Data received successfully' },
    ]);
    const out = await processPush(hir, body, 'corr-1');
    expect(out.results).toEqual([{ careContextReference: 'visit-1', hiStatus: 'OK', description: 'Data received successfully' }]);
    const stored = prismaMock.receivedHealthRecord.create.mock.calls[0][0].data;
    expect(stored.hiType).toBe('ImmunizationRecord');
    expect(stored.checksumOk).toBe(true);
    expect(stored.bundleEnc).toBeTruthy();
    expect(stored.bundleEnc).not.toContain('resourceType');
    expect(prismaMock.healthInformationRequest.update.mock.calls[0][0].data).toMatchObject({
      status: 'TRANSFERRED', privateKeyEnc: null, pagesReceived: 1,
    });
    const notify = mockAbdmRequest.mock.calls[0][0];
    expect(notify.contract.name).toBe('healthInformationNotify');
    expect(notify.body.notification.notifier).toEqual({ type: 'HIU', id: 'HIU-TEST' });
    expect(notify.body.notification.statusNotification.sessionStatus).toBe('TRANSFERRED');
    expect(notify.body.notification.statusNotification.statusResponses[0].hiStatus).toBe('OK');
  });

  it('marks a checksum mismatch ERRORED and keeps no content', async () => {
    const { hir, body } = setup('00000000000000000000000000000000');
    prismaMock.dataTransfer.findMany.mockResolvedValue([
      { careContextReference: 'visit-1', status: 'ERRORED', receiptStatus: 'Checksum mismatch' },
    ]);
    const out = await processPush(hir, body, 'corr-2');
    expect(out.results[0].hiStatus).toBe('ERRORED');
    expect(prismaMock.receivedHealthRecord.create.mock.calls[0][0].data.bundleEnc).toBeNull();
    const notify = mockAbdmRequest.mock.calls[0][0];
    expect(notify.body.notification.statusNotification.sessionStatus).toBe('FAILED');
  });
});

describe('data push route', () => {
  beforeEach(() => resetPrisma());

  it('requires a bearer', async () => {
    const res = await request(app).post('/api/v3/hiu/health-information/transfer').send({ transactionId: 't' });
    expect(res.status).toBe(401);
  });

  it('drops a push for an unknown transaction without storing it', async () => {
    prismaMock.healthInformationRequest.findFirst.mockResolvedValue(null);
    const res = await request(app).post('/api/v3/hiu/health-information/transfer')
      .set('Authorization', 'Bearer gw').send({ transactionId: 'unknown', entries: [] });
    expect(res.status).toBe(404);
    expect(prismaMock.dataTransfer.create).not.toHaveBeenCalled();
  });
});

describe('plural artefacts', () => {
  it('never takes the first artefact and drops the rest', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))) {
      expect(readFileSync(join(dir, file), 'utf8')).not.toMatch(/consentArtefacts\s*\[\s*0\s*\]/);
    }
  });
});
