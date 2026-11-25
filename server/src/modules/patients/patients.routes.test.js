import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { prismaMock, resetPrisma } from '../../test/prismaMock.js';

const userId = '33333333-3333-4333-8333-333333333333';
const facilityId = '44444444-4444-4444-8444-444444444444';
const otherFacilityId = '55555555-5555-4555-8555-555555555555';
const patientId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

jest.unstable_mockModule('../../shared/prisma.js', () => ({
  default: prismaMock,
}));

const mockLogAudit = jest.fn(async () => {});
jest.unstable_mockModule('../../shared/audit.js', () => ({
  logAudit: mockLogAudit,
}));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/chip_test?sslmode=disable';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-characters-min';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
process.env.ABDM_GATEWAY_BASE_URL = '';
process.env.ABDM_ABHA_BASE_URL = '';
process.env.ABDM_SANDBOX_HOST_ALLOWLIST = '';
process.env.ABHA_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.ABHA_HASH_KEY = Buffer.alloc(32, 9).toString('base64');

const { default: app } = await import('../../app.js');
const { signAccessToken } = await import('../../shared/tokens.js');

describe('patients routes', () => {
  let passwordHash;
  let token;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Staffpass123', 12);
    token = signAccessToken({ userId });
  });

  beforeEach(() => {
    resetPrisma();
    mockLogAudit.mockClear();
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Demo Staff',
      email: 'staff@example.com',
      passwordHash,
      role: 'STAFF',
      facilityId,
    });
  });

  it('creates a patient and audits patient.create with message', async () => {
    prismaMock.patient.create.mockResolvedValue({
      id: patientId,
      facilityId,
      patientType: 'CHILD',
      name: 'Ravi Kumar',
      gender: 'M',
      dateOfBirth: new Date('2024-01-01'),
      mobileLast4: '1234',
      createdAt: new Date(),
      registeredBy: { id: userId, name: 'Demo Staff', role: 'STAFF' },
      abhaIdentity: null,
    });

    const res = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientType: 'CHILD',
        name: 'Ravi Kumar',
        gender: 'M',
        dateOfBirth: '2024-01-01',
        mobile: '9876541234',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Ravi Kumar');
    expect(res.body.data.managedBy).toEqual({
      id: userId,
      name: 'Demo Staff',
      role: 'STAFF',
    });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'patient.create',
      outcome: 'success',
      resourceId: patientId,
      message: expect.stringContaining('Ravi Kumar'),
    }));
  });

  it('returns 400 for invalid create body', async () => {
    const res = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientType: 'CHILD', name: '', gender: 'X' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when CHILD is 18 or older', async () => {
    const res = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientType: 'CHILD',
        name: 'Adult Child',
        gender: 'M',
        dateOfBirth: '2000-01-01',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/under 18/i);
  });

  it('creates a general patient without a date of birth', async () => {
    prismaMock.patient.create.mockResolvedValue({
      id: patientId,
      facilityId,
      patientType: 'GENERAL',
      name: 'Anil Rao',
      gender: 'M',
      dateOfBirth: null,
      mobileLast4: null,
      createdAt: new Date(),
      registeredBy: { id: userId, name: 'Demo Staff', role: 'STAFF' },
      abhaIdentity: null,
    });

    const res = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientType: 'GENERAL',
        name: 'Anil Rao',
        gender: 'M',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.patientType).toBe('GENERAL');
    expect(res.body.data.name).toBe('Anil Rao');
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'patient.create',
      outcome: 'success',
      message: expect.stringContaining('GENERAL patient Anil Rao'),
    }));
  });

  it('returns 400 when CHILD is missing date of birth', async () => {
    const res = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientType: 'CHILD',
        name: 'No Dob',
        gender: 'F',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/date of birth/i);
  });

  it('lists patients for the staff facility', async () => {
    prismaMock.patient.findMany.mockResolvedValue([{
      id: patientId,
      facilityId,
      patientType: 'MOTHER',
      name: 'Demo Mother',
      gender: 'F',
      dateOfBirth: new Date('1995-01-15'),
      mobileLast4: '0000',
      createdAt: new Date(),
      registeredBy: { id: userId, name: 'Demo Staff', role: 'STAFF' },
      abhaIdentity: null,
    }]);

    const res = await request(app)
      .get('/patients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].managedBy.name).toBe('Demo Staff');
    expect(prismaMock.patient.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ facilityId }),
    }));
  });

  it('returns 403 when patient is outside facility', async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      id: patientId,
      facilityId: otherFacilityId,
      patientType: 'MOTHER',
      name: 'Other',
      gender: 'F',
      dateOfBirth: null,
      mobileLast4: null,
      createdAt: new Date(),
      registeredBy: null,
      abhaIdentity: null,
    });

    const res = await request(app)
      .get(`/patients/${patientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('returns 404 when patient is missing', async () => {
    prismaMock.patient.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get(`/patients/${patientId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PATIENT_NOT_FOUND');
  });

  it('reuses an existing patient when name, gender, date of birth, and mobile last 4 match', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({
      id: patientId,
      name: 'Ravi Kumar',
      facilityId,
    });

    const res = await request(app)
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientType: 'CHILD',
        name: 'Ravi Kumar',
        gender: 'M',
        dateOfBirth: '2024-01-01',
        mobile: '9876541234',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PATIENT_MATCH');
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'existingPatientId', message: patientId }),
    ]));
    expect(prismaMock.patient.create).not.toHaveBeenCalled();
  });
});
