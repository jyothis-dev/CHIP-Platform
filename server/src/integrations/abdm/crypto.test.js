import { generateKeyPairSync, privateDecrypt, constants } from 'node:crypto';
import { jest } from '@jest/globals';
import { AppError } from '../../shared/errors.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicDer = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

const fixtureCert = {
  publicKey: publicDer,
  encryptionAlgorithm: 'RSA/ECB/OAEPWithSHA-1AndMGF1Padding',
};

const mockAbdmRequest = jest.fn();
const logLines = [];

jest.unstable_mockModule('./client.js', () => ({
  abdmRequest: mockAbdmRequest,
}));

jest.unstable_mockModule('../../shared/logger.js', () => ({
  logger: {
    info: (obj) => { logLines.push(obj); },
    error: (obj) => { logLines.push(obj); },
  },
  redact: { paths: [], censor: '[REDACTED]' },
}));

describe('encryptForAbha', () => {
  beforeEach(() => {
    jest.resetModules();
    mockAbdmRequest.mockReset();
    logLines.length = 0;
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/chip_test?sslmode=disable';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-32-characters-min';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.LOG_LEVEL = 'silent';
  });

  async function load() {
    const crypto = await import('./crypto.js');
    crypto.clearCertificateCache();
    return crypto;
  }

  it('uses encryptionAlgorithm from the certificate fixture', async () => {
    mockAbdmRequest.mockResolvedValueOnce({
      status: 200,
      body: fixtureCert,
      requestId: 'req-cert-1',
    });

    const { encryptForAbha, fetchAbhaCertificate } = await load();
    const cert = await fetchAbhaCertificate();
    expect(cert.encryptionAlgorithm).toBe('RSA/ECB/OAEPWithSHA-1AndMGF1Padding');

    const cipher = await encryptForAbha('12-3456-7890-1234', { certificate: cert });
    const plain = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1',
      },
      Buffer.from(cipher, 'base64'),
    ).toString('utf8');

    expect(plain).toBe('12-3456-7890-1234');
  });

  it('keeps dashes in an ABHA number plaintext before encryption', async () => {
    const { encryptForAbha } = await load();
    const cipher = await encryptForAbha('12-3456-7890-1234', { certificate: fixtureCert });
    const plain = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1',
      },
      Buffer.from(cipher, 'base64'),
    ).toString('utf8');
    expect(plain).toContain('-');
    expect(plain).toBe('12-3456-7890-1234');
  });

  it('caches the certificate so a second encrypt does not refetch', async () => {
    mockAbdmRequest.mockResolvedValueOnce({
      status: 200,
      body: fixtureCert,
      requestId: 'req-cert-2',
    });

    const { encryptForAbha } = await load();
    await encryptForAbha('999999999999', {});
    await encryptForAbha('888888888888', {});

    expect(mockAbdmRequest).toHaveBeenCalledTimes(1);
  });

  it('does not put plaintext in log objects', async () => {
    const { encryptForAbha } = await load();
    await encryptForAbha('9999-8888-7777', { certificate: fixtureCert });
    const dumped = JSON.stringify(logLines);
    expect(dumped).not.toContain('9999-8888-7777');
    expect(dumped).not.toContain('999988887777');
  });

  it('rejects an unsupported encryption algorithm', async () => {
    const { encryptForAbha } = await load();
    await expect(
      encryptForAbha('x', {
        certificate: { publicKey: publicDer, encryptionAlgorithm: 'RSA/ECB/PKCS1Padding' },
      }),
    ).rejects.toMatchObject({ code: 'ABDM_ENCRYPTION_UNSUPPORTED' });
  });
});
