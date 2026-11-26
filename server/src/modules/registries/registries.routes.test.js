import { jest } from '@jest/globals';
import request from 'supertest';
import { prismaMock, resetPrisma } from '../../test/prismaMock.js';

const userId = '33333333-3333-4333-8333-333333333333';
const facilityId = '44444444-4444-4444-8444-444444444444';
const otherFacilityId = '99999999-9999-4999-8999-999999999999';
const practitionerId = '88888888-8888-4888-8888-888888888888';
const HFR_ID = 'IN0000000001';
const MOBILE = '9876501234';

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
process.env.ABDM_HFR_BASE_URL = '';
process.env.ABDM_HPR_BASE_URL = '';
process.env.ABDM_SANDBOX_HOST_ALLOWLIST = '';
process.env.ABDM_CLIENT_ID = '';
process.env.ABDM_BRIDGE_ID = 'SBX_TEST';
process.env.ABHA_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.ABHA_HASH_KEY = Buffer.alloc(32, 9).toString('base64');

const { default: app } = await import('../../app.js');
const { env } = await import('../../config/env.js');
const { signAccessToken } = await import('../../shared/tokens.js');

const token = signAccessToken({ userId });
const authed = (req) => req.set('Authorization', `Bearer ${token}`);

function asUser(role, ownFacilityId = facilityId) {
  prismaMock.user.findUnique.mockResolvedValue({
    id: userId, name: 'Dr Test', email: 'dr@example.com', role, facilityId: ownFacilityId,
  });
}

function registryAnswers(answers) {
  let n = 0;
  mockAbdmRequest.mockImplementation(async ({ contract }) => {
    n += 1;
    const answer = answers[contract.name];
    const reply = typeof answer === 'function' ? answer() : answer;
    return {
      status: reply?.status ?? 200, body: reply?.body ?? '', requestId: `req-${n}`, headers: {},
    };
  });
}

const facilityRow = (extra = {}) => ({
  id: facilityId, name: 'Sahyadri Hospital', hfrId: HFR_ID, hfrStatus: 'Active', hipName: null, hfrRoles: [], ...extra,
});

function callsTo(name) {
  return mockAbdmRequest.mock.calls.map(([arg]) => arg).filter((arg) => arg.contract.name === name);
}

describe('M4 registries routes', () => {
  beforeEach(() => {
    resetPrisma();
    mockAbdmRequest.mockReset();
    asUser('CLINICIAN');
    prismaMock.aBDMTransaction.create.mockImplementation(async ({ data }) => ({ id: 'tx-1', ...data }));
    prismaMock.facility.findUnique.mockResolvedValue(facilityRow());
    prismaMock.facility.update.mockImplementation(async ({ data }) => ({ ...facilityRow(), ...data }));
    env.abdmBridgeId = 'SBX_TEST';
  });

  it('rejects an unauthenticated call', async () => {
    const res = await request(app).post('/registries/hfr/search').send({ facilityId: HFR_ID });
    expect(res.status).toBe(401);
    expect(mockAbdmRequest).not.toHaveBeenCalled();
  });

  describe('facility search', () => {
    it('requires a facility id, or a name with ownership and state', async () => {
      const res = await authed(request(app).post('/registries/hfr/search')).send({ facilityName: 'Sahyadri' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(mockAbdmRequest).not.toHaveBeenCalled();
    });

    it('fixes the page size at 10 whatever the client sends, and maps the facilities', async () => {
      registryAnswers({
        hfrSearchFacility: {
          body: {
            facilities: [{
              facilityId: HFR_ID, facilityName: 'Sahyadri Hospital', facilityStatus: 'Active', stateName: 'MAHARASHTRA', latitude: '1', longitude: '2',
            }],
            totalFacilities: 1,
            numberOfPages: 1,
          },
        },
      });
      const res = await authed(request(app).post('/registries/hfr/search'))
        .send({ facilityName: 'Sahyadri', ownershipCode: 'P', stateLGDCode: '27', resultsPerPage: 500 });
      expect(res.status).toBe(200);
      const [call] = callsTo('hfrSearchFacility');
      expect(call.body).toEqual({
        page: 1, resultsPerPage: 10, facilityName: 'Sahyadri', ownershipCode: 'P', stateLGDCode: '27',
      });
      expect(res.body.data.pageSize).toBe(10);
      expect(res.body.data.facilities[0]).toMatchObject({ facilityId: HFR_ID, facilityStatus: 'Active' });
      expect(res.body.data.facilities[0]).not.toHaveProperty('latitude');
    });

    it('reads a 404 as no match, not as an error', async () => {
      registryAnswers({ hfrSearchFacility: { status: 404, body: 'Not Found' } });
      const res = await authed(request(app).post('/registries/hfr/search')).send({ facilityId: HFR_ID });
      expect(res.status).toBe(200);
      expect(res.body.data.facilities).toEqual([]);
    });

    it('maps a registry failure without passing the raw body through', async () => {
      registryAnswers({ hfrSearchFacility: { status: 500, body: { message: 'boom', secret: 'internal-detail' } } });
      const res = await authed(request(app).post('/registries/hfr/search')).send({ facilityId: HFR_ID });
      expect(res.status).toBe(502);
      expect(res.body.code).toBe('ABDM_UPSTREAM');
      expect(JSON.stringify(res.body)).not.toContain('internal-detail');
    });

    it('records an M4 transaction and an audit row', async () => {
      registryAnswers({ hfrSearchFacility: { body: { facilities: [], totalFacilities: 0, numberOfPages: 0 } } });
      await authed(request(app).post('/registries/hfr/search')).send({ facilityId: HFR_ID });
      expect(prismaMock.aBDMTransaction.create.mock.calls[0][0].data).toMatchObject({
        milestone: 'M4', workflow: 'm4.hfr.search', direction: 'OUTBOUND', status: 'COMPLETED',
      });
      expect(prismaMock.auditLog.create.mock.calls.some(([arg]) => arg.data.action === 'registry.hfr.search')).toBe(true);
    });
  });

  describe('LGD masters', () => {
    it('needs the parent code for districts and passes it as a query parameter', async () => {
      const missing = await authed(request(app).get('/registries/hfr/masters/districts'));
      expect(missing.status).toBe(400);

      registryAnswers({ hfrLgdDistricts: { body: [{ code: '1', name: 'Anantnag' }] } });
      const res = await authed(request(app).get('/registries/hfr/masters/districts?parentCode=27'));
      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([{ code: '1', name: 'Anantnag' }]);
      expect(callsTo('hfrLgdDistricts')[0].query).toEqual({ stateCode: '27' });
    });
  });

  describe('professional lookups', () => {
    it('lets every signed-in role search by HPR id, and reads a 404 as not found', async () => {
      asUser('STAFF');
      registryAnswers({
        hprSearchById: {
          body: { hprId: 'dr.test@hpr.abdm', hprIdNumber: '71-1234', name: 'Test Name', authMethods: ['PASSWORD'], categoryId: '1', subCategoryId: '1' },
        },
      });
      const found = await authed(request(app).get('/registries/hpr/dr.test@hpr.abdm'));
      expect(found.status).toBe(200);
      expect(found.body.data.found).toBe(true);
      expect(callsTo('hprSearchById')[0].pathParams).toEqual({ hprId: 'dr.test@hpr.abdm' });

      registryAnswers({ hprSearchById: { status: 404, body: 'Not Found' } });
      const missing = await authed(request(app).get('/registries/hpr/nobody'));
      expect(missing.status).toBe(200);
      expect(missing.body.data).toEqual({ found: false, professional: null });
    });

    it('reads the existence answer as a boolean', async () => {
      registryAnswers({ hprExists: { body: true } });
      const res = await authed(request(app).get('/registries/hpr/exists/dr.test'));
      expect(res.body.data).toEqual({ exists: true });
    });

    it('keeps the mobile search to clinicians and admins, and keeps the number out of stored rows', async () => {
      asUser('STAFF');
      const denied = await authed(request(app).post('/registries/hpr/search-by-mobile')).send({ mobile: MOBILE });
      expect(denied.status).toBe(403);
      expect(mockAbdmRequest).not.toHaveBeenCalled();

      asUser('CLINICIAN');
      registryAnswers({ hprSearchByMobile: { body: [{ hprId: 'a@hpr.abdm', name: 'A', authMethods: [] }] } });
      const res = await authed(request(app).post('/registries/hpr/search-by-mobile')).send({ mobile: MOBILE });
      expect(res.status).toBe(200);
      expect(res.body.data.professionals).toHaveLength(1);
      expect(callsTo('hprSearchByMobile')[0].pathParams).toEqual({ mobile: MOBILE });

      const stored = JSON.stringify([
        prismaMock.aBDMTransaction.create.mock.calls,
        prismaMock.auditLog.create.mock.calls,
      ]);
      expect(stored).not.toContain(MOBILE);
    });

    it('validates the mobile number', async () => {
      const res = await authed(request(app).post('/registries/hpr/search-by-mobile')).send({ mobile: '123' });
      expect(res.status).toBe(400);
    });
  });

  describe('attaching ids', () => {
    it('refuses a non-admin', async () => {
      const res = await authed(request(app).post(`/registries/facilities/${facilityId}/hfr-link`)).send({ hfrId: HFR_ID });
      expect(res.status).toBe(403);
    });

    it('refuses another facility', async () => {
      asUser('ADMIN');
      const res = await authed(request(app).post(`/registries/facilities/${otherFacilityId}/hfr-link`)).send({ hfrId: HFR_ID });
      expect(res.status).toBe(403);
      expect(prismaMock.facility.update).not.toHaveBeenCalled();
    });

    it('saves the HFR id only when the registry returns exactly that facility', async () => {
      asUser('ADMIN');
      prismaMock.facility.findUnique.mockResolvedValue(facilityRow({ hfrId: null, hfrStatus: null }));
      registryAnswers({
        hfrSearchFacility: { body: { facilities: [{ facilityId: 'IN9999999999', facilityStatus: 'Active' }], totalFacilities: 1, numberOfPages: 1 } },
      });
      const wrong = await authed(request(app).post(`/registries/facilities/${facilityId}/hfr-link`)).send({ hfrId: HFR_ID });
      expect(wrong.status).toBe(404);
      expect(prismaMock.facility.update).not.toHaveBeenCalled();

      registryAnswers({
        hfrSearchFacility: { body: { facilities: [{ facilityId: HFR_ID, facilityStatus: 'Active' }], totalFacilities: 1, numberOfPages: 1 } },
      });
      const right = await authed(request(app).post(`/registries/facilities/${facilityId}/hfr-link`)).send({ hfrId: HFR_ID });
      expect(right.status).toBe(200);
      expect(prismaMock.facility.update.mock.calls[0][0].data).toMatchObject({ hfrId: HFR_ID, hfrStatus: 'Active' });
    });

    it('saves an HPR id only when the registry confirms it for a practitioner of this facility', async () => {
      asUser('ADMIN');
      prismaMock.practitioner.findUnique.mockResolvedValue({ id: practitionerId, name: 'Dr Test', facilityId });
      prismaMock.practitioner.update.mockImplementation(async ({ data }) => ({ id: practitionerId, name: 'Dr Test', ...data }));

      registryAnswers({ hprSearchById: { status: 404, body: 'Not Found' } });
      const missing = await authed(request(app).post(`/registries/practitioners/${practitionerId}/hpr-link`)).send({ hprId: 'dr.test@hpr.abdm' });
      expect(missing.status).toBe(404);
      expect(prismaMock.practitioner.update).not.toHaveBeenCalled();

      registryAnswers({ hprSearchById: { body: { hprId: 'DR.TEST@hpr.abdm', name: 'Test' } } });
      const ok = await authed(request(app).post(`/registries/practitioners/${practitionerId}/hpr-link`)).send({ hprId: 'dr.test@hpr.abdm' });
      expect(ok.status).toBe(200);
      expect(prismaMock.practitioner.update.mock.calls[0][0].data.hprId).toBe('dr.test@hpr.abdm');

      prismaMock.practitioner.findUnique.mockResolvedValue({ id: practitionerId, name: 'Dr Test', facilityId: otherFacilityId });
      const other = await authed(request(app).post(`/registries/practitioners/${practitionerId}/hpr-link`)).send({ hprId: 'dr.test@hpr.abdm' });
      expect(other.status).toBe(404);
    });
  });

  describe('bridge link', () => {
    const linkBody = (extra = {}) => ({ roles: ['HIP', 'HIU'], hipName: 'Sahyadri Bridge', confirm: true, ...extra });
    const post = (body) => authed(request(app).post(`/registries/facilities/${facilityId}/bridge-link`)).send(body);
    const bothRoles = () => ({ body: { bridge: { url: 'https://cb.example.org', active: true }, services: [{ id: HFR_ID, types: ['HIP', 'HIU'] }] } });

    beforeEach(() => asUser('ADMIN'));

    it('is admin only', async () => {
      asUser('CLINICIAN');
      expect((await post(linkBody())).status).toBe(403);
    });

    it('needs confirm, a valid HIP name and known roles', async () => {
      expect((await post(linkBody({ confirm: false }))).status).toBe(400);
      expect((await post(linkBody({ hipName: 'A name that is far too long' }))).status).toBe(400);
      expect((await post(linkBody({ hipName: 'Bad$Name' }))).status).toBe(400);
      expect((await post(linkBody({ roles: ['HIP', 'HIP'] }))).status).toBe(400);
      expect((await post(linkBody({ roles: ['BOTH'] }))).status).toBe(400);
      expect(mockAbdmRequest).not.toHaveBeenCalled();
    });

    it('is refused locally without a bridge id or without an HFR id', async () => {
      env.abdmBridgeId = null;
      const noBridge = await post(linkBody());
      expect(noBridge.status).toBe(503);
      expect(noBridge.body.code).toBe('BRIDGE_ID_MISSING');

      env.abdmBridgeId = 'SBX_TEST';
      prismaMock.facility.findUnique.mockResolvedValue(facilityRow({ hfrId: null }));
      const noHfr = await post(linkBody());
      expect(noHfr.status).toBe(409);
      expect(noHfr.body.code).toBe('HFR_ID_MISSING');
      expect(mockAbdmRequest).not.toHaveBeenCalled();
    });

    it('sends one HRP entry per role and confirms against bridge-services', async () => {
      registryAnswers({ hfrBridgeLink: { body: {} }, bridgeServices: bothRoles() });
      const res = await post(linkBody());
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ confirmed: true, confirmedRoles: ['HIP', 'HIU'], missingRoles: [] });

      const [call] = callsTo('hfrBridgeLink');
      expect(call.body).toEqual({
        facilityId: HFR_ID,
        facilityName: 'Sahyadri Hospital',
        HRP: [
          { bridgeId: 'SBX_TEST', hipName: 'Sahyadri Bridge', type: 'HIP', active: true },
          { bridgeId: 'SBX_TEST', hipName: 'Sahyadri Bridge', type: 'HIU', active: true },
        ],
      });
      expect(prismaMock.facility.update.mock.calls.at(-1)[0].data).toMatchObject({ hfrRoles: ['HIP', 'HIU'], hipName: 'Sahyadri Bridge' });
    });

    it('does not claim success when bridge-services lacks a requested role', async () => {
      registryAnswers({
        hfrBridgeLink: { body: {} },
        bridgeServices: { body: { bridge: { active: true }, services: [{ id: HFR_ID, types: ['HIP'] }] } },
      });
      const res = await post(linkBody());
      expect(res.status).toBe(200);
      expect(res.body.data.confirmed).toBe(false);
      expect(res.body.data.missingRoles).toEqual(['HIU']);
      expect(res.body.data.warnings[0]).toMatch(/HIU/);
    });

    it('maps a refused HIP name to HIP_NAME_REFUSED', async () => {
      registryAnswers({ hfrBridgeLink: { status: 400, body: 'HIP name already exists for this facility' } });
      const res = await post(linkBody());
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('HIP_NAME_REFUSED');
      expect(callsTo('bridgeServices')).toHaveLength(0);
    });

    it('reports bridge-status with the ids to copy into .env', async () => {
      asUser('STAFF');
      registryAnswers({
        bridgeServices: { body: { bridge: { url: 'https://cb.example.org', active: true }, services: [{ id: HFR_ID, types: ['HIP', 'HIU'] }] } },
      });
      const res = await authed(request(app).get(`/registries/facilities/${facilityId}/bridge-status`));
      expect(res.status).toBe(200);
      expect(res.body.data.roles).toEqual(['HIP', 'HIU']);
      expect(res.body.data.suggested).toEqual({ hipId: HFR_ID, hiuId: HFR_ID });
    });
  });

  describe('own facility', () => {
    it("returns the caller's facility so the screen knows which id to use", async () => {
      asUser('STAFF');
      const res = await authed(request(app).get('/registries/facility'));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: facilityId, hfrId: HFR_ID, roles: [] });
    });
  });

  describe('readiness', () => {
    it('lists what is missing without calling ABDM when credentials are absent', async () => {
      const res = await authed(request(app).get('/registries/readiness'));
      expect(res.status).toBe(200);
      expect(res.body.data.blockers.join(' ')).toMatch(/ABDM_HFR_BASE_URL/);
      expect(res.body.data.blockers.join(' ')).toMatch(/ABDM_CLIENT_ID/);
      expect(mockAbdmRequest).not.toHaveBeenCalled();
    });
  });
});
