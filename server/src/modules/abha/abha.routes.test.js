import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { prismaMock, resetPrisma } from '../../test/prismaMock.js';
import { AppError } from '../../shared/errors.js';

const userId = '33333333-3333-4333-8333-333333333333';
const facilityId = '44444444-4444-4444-8444-444444444444';
const patientId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

jest.unstable_mockModule('../../shared/prisma.js', () => ({
  default: prismaMock,
}));

const mockRequestOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockGetPatientAbha = jest.fn();

jest.unstable_mockModule('./abha.service.js', () => ({
  requestAadhaarOtp: mockRequestOtp,
  verifyAadhaarOtp: mockVerifyOtp,
  verifyMobileOtp: jest.fn(),
  suggestAddress: jest.fn(),
  createAddress: jest.fn(),
  getPatientAbha: mockGetPatientAbha,
  getAbhaCard: jest.fn(),
}));

process.env.NODE_ENV = 'test';
process.env.ABDM_TRACE = 'false';
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

describe('ABHA routes', () => {
  let passwordHash;
  let token;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Staffpass123', 12);
    token = signAccessToken({ userId });
  });

  beforeEach(() => {
    resetPrisma();
    mockRequestOtp.mockReset();
    mockVerifyOtp.mockReset();
    mockGetPatientAbha.mockReset();
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      name: 'Demo Staff',
      email: 'staff@example.com',
      passwordHash,
      role: 'STAFF',
      facilityId,
    });
  });

  it('returns 401 without a bearer token', async () => {
    const res = await request(app).post('/abha/enrolment/otp').send({
      patientId,
      aadhaar: '999999999999',
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('returns 400 when consent is missing on verify', async () => {
    const res = await request(app)
      .post('/abha/enrolment/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        transactionId: '55555555-5555-4555-8555-555555555555',
        otp: '123456',
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 PATIENT_NOT_FOUND from the service', async () => {
    mockGetPatientAbha.mockRejectedValue(
      new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found'),
    );
    const res = await request(app)
      .get(`/patients/${patientId}/abha`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PATIENT_NOT_FOUND');
  });

  it('returns 403 when the service rejects facility scope', async () => {
    mockRequestOtp.mockRejectedValue(
      new AppError(403, 'FORBIDDEN', 'Patient is outside your facility'),
    );
    const res = await request(app)
      .post('/abha/enrolment/otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId, aadhaar: '999999999999', consentAccepted: true });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('creates an enrolment OTP transaction', async () => {
    mockRequestOtp.mockResolvedValue({
      transactionId: '55555555-5555-4555-8555-555555555555',
      status: 'ACCEPTED',
    });
    const res = await request(app)
      .post('/abha/enrolment/otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId, aadhaar: '999999999999', consentAccepted: true });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ACCEPTED');
  });

  it('returns the Aadhaar validation message and does not call the service', async () => {
    const res = await request(app)
      .post('/abha/enrolment/otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientId, aadhaar: '12345', consentAccepted: true });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toContain('Aadhaar Number is not valid');
    expect(mockRequestOtp).not.toHaveBeenCalled();
  });

  it('rejects an OTP that is not 6 digits', async () => {
    const res = await request(app)
      .post('/abha/enrolment/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        transactionId: '55555555-5555-4555-8555-555555555555',
        otp: '1234',
        mobile: '9999991234',
        consentAccepted: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toContain('OTP must be 6 digits');
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it('requires a 10-digit mobile before enrolment OTP can be verified', async () => {
    const res = await request(app)
      .post('/abha/enrolment/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        transactionId: '55555555-5555-4555-8555-555555555555',
        otp: '123456',
        consentAccepted: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toMatch(/mobile/i);
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it('hides ABHA traffic when tracing is off', async () => {
    const res = await request(app)
      .get('/abha/traces')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TRACE_DISABLED');
  });

  it('requires authentication to read ABHA traffic', async () => {
    const res = await request(app).get('/abha/traces');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});
