import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prismaMock, resetPrisma } from '../test/prismaMock.js';

jest.unstable_mockModule('../shared/prisma.js', () => ({
  default: prismaMock,
}));

const { default: app } = await import('../app.js');

const hospitalId = '11111111-1111-4111-8111-111111111111';
const roleId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const childId = '44444444-4444-4444-8444-444444444444';

function token() {
  return jwt.sign({ sub: userId, hospitalId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

function mockSession(permissions) {
  prismaMock.membership.findFirst.mockResolvedValue({
    status: 'active',
    hospitalId,
    roleId,
    departmentId: null,
    user: {
      id: userId,
      email: 'doctor@example.com',
      status: 'active',
      profile: { firstName: 'Gynaecology', lastName: 'Doctor', phone: null, designation: 'Doctor' },
    },
    role: {
      id: roleId,
      name: 'Doctor',
      permissions: permissions.map((key) => ({ permission: { key } })),
    },
    hospital: { id: hospitalId, name: 'City General', code: 'CITY' },
    department: null,
  });
}

describe('API', () => {
  let passwordHash;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Doctorpass123', 12);
  });

  beforeEach(() => {
    resetPrisma();
  });

  it('reports the database connection on the health check', async () => {
    prismaMock.$queryRaw.mockResolvedValue([1]);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'OK', database: 'up' });
  });

  it('returns 503 when the database is unreachable', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("Can't reach database server at secret-host"));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    expect(res.body.message).toBe('Database is unreachable');
    expect(JSON.stringify(res.body)).not.toContain('secret-host');
  });

  it('logs in and sets a refresh cookie without returning the refresh token', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'doctor@example.com',
      passwordHash,
      status: 'active',
      profile: { firstName: 'Gynaecology', lastName: 'Doctor', phone: null, designation: 'Doctor' },
      memberships: [{
        hospitalId,
        role: {
          id: roleId,
          name: 'Doctor',
          permissions: [{ permission: { key: 'child.read' } }],
        },
        hospital: { id: hospitalId, name: 'City General', code: 'CITY' },
        department: null,
      }],
    });
    prismaMock.refreshToken.create.mockResolvedValue({ id: 'refresh-1' });

    const res = await request(app).post('/auth/login').send({
      email: 'doctor@example.com',
      password: 'Doctorpass123',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.headers['set-cookie'].join(';')).toContain('refresh_token=');
    expect(JSON.stringify(res.body)).not.toContain(passwordHash);
  });

  it('rejects a wrong password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'doctor@example.com',
      passwordHash,
      status: 'active',
      profile: null,
      memberships: [],
    });

    const res = await request(app).post('/auth/login').send({
      email: 'doctor@example.com',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an incomplete login', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/children');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('denies a doctor from onboarding a hospital', async () => {
    mockSession(['child.read', 'child.register']);
    const res = await request(app)
      .post('/hospitals')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'New Hospital', code: 'NEW' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('onboards a hospital for an administrator', async () => {
    mockSession(['hospital.manage']);
    prismaMock.hospital.findUnique.mockResolvedValue(null);
    prismaMock.permission.findMany.mockResolvedValue([{ id: 'perm-1', key: 'hospital.manage' }]);
    prismaMock.hospital.create.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      name: 'New Hospital',
      code: 'NEW',
    });
    prismaMock.role.create.mockResolvedValue({ id: roleId, name: 'Hospital Admin' });
    prismaMock.rolePermission.createMany.mockResolvedValue({ count: 1 });
    prismaMock.membership.create.mockResolvedValue({ id: 'membership-1' });

    const res = await request(app)
      .post('/hospitals')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'New Hospital', code: 'new' });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('NEW');
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'hospital.created', outcome: 'success' }),
    }));
  });

  it('rejects a child without a name', async () => {
    mockSession(['child.register']);
    const res = await request(app)
      .post('/children')
      .set('Authorization', `Bearer ${token()}`)
      .send({ lastName: 'Rao', dateOfBirth: '2026-01-01', sex: 'female', mrn: 'MRN-1' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('registers a child', async () => {
    mockSession(['child.register']);
    prismaMock.child.findUnique.mockResolvedValue(null);
    prismaMock.child.create.mockResolvedValue({
      id: childId,
      hospitalId,
      departmentId: null,
      firstName: 'Asha',
      lastName: 'Rao',
      dateOfBirth: new Date('2026-01-01'),
      sex: 'female',
      mrn: 'MRN-1',
      createdAt: new Date('2026-11-23T00:00:00Z'),
    });

    const res = await request(app)
      .post('/children')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        firstName: 'Asha',
        lastName: 'Rao',
        dateOfBirth: '2026-01-01',
        sex: 'female',
        mrn: 'MRN-1',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: childId, mrn: 'MRN-1' });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'child.registered', entityId: childId }),
    }));
  });

  it('returns 404 when the child is outside the hospital', async () => {
    mockSession(['child.read']);
    prismaMock.child.findFirst.mockResolvedValue(null);
    const res = await request(app)
      .get(`/children/${childId}`)
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CHILD_NOT_FOUND');
  });

  it('returns 409 when the vaccination dose already exists', async () => {
    mockSession(['vaccination.create']);
    prismaMock.child.findFirst.mockResolvedValue({
      id: childId,
      hospitalId,
      firstName: 'Asha',
      dateOfBirth: new Date('2026-01-01'),
      guardians: [],
    });
    prismaMock.vaccineSchedule.findUnique.mockResolvedValue({
      vaccineCode: 'BCG',
      vaccineName: 'BCG',
      doseNumber: 1,
    });
    prismaMock.vaccinationRecord.findUnique.mockResolvedValue({ id: 'existing' });

    const res = await request(app)
      .post(`/children/${childId}/vaccinations`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ vaccineCode: 'BCG', dose: 1, doseNumber: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('VACCINATION_DUPLICATE');
  });

  it('returns the next due birth dose', async () => {
    mockSession(['vaccination.read']);
    prismaMock.child.findFirst.mockResolvedValue({
      id: childId,
      hospitalId,
      firstName: 'Asha',
      dateOfBirth: new Date(),
      guardians: [],
    });
    prismaMock.vaccineSchedule.findMany.mockResolvedValue([
      { vaccineCode: 'BCG', vaccineName: 'BCG', doseNumber: 1, dueAgeDays: 0 },
    ]);
    prismaMock.vaccinationRecord.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get(`/children/${childId}/vaccinations/next-due`)
      .set('Authorization', `Bearer ${token()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ vaccineCode: 'BCG', doseNumber: 1, status: 'due' });
  });
});
