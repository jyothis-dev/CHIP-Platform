import '../test/env.js';
import { Writable } from 'node:stream';
import pino from 'pino';
import { redact } from './logger.js';

const secrets = {
  otp: 'otp-918273',
  aadhaar: 'aadhaar-234567890124',
  abhaNumber: 'abha-91-4321-8765-0987',
  token: 'token-tok_live_7f3a',
};

function serialize(obj) {
  let line = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      line += chunk.toString();
      callback();
    },
  });
  const log = pino({ level: 'info', redact }, stream);
  log.info(obj, 'redaction check');
  return line;
}

describe('logger redaction', () => {
  it('censors OTP, Aadhaar, ABHA number, and token values', () => {
    const line = serialize({
      ...secrets,
      patient: {
        aadhaarNumber: 'aadhaar-num-111122223333',
        abhaAddress: 'addr-user@sbx',
        accessToken: 'access-token-secret-value',
      },
      headers: {
        authorization: 'Bearer header-secret-auth',
        cookie: 'cookie-secret-sid',
        'x-auth-token': 'x-auth-secret-value',
      },
      password: 'password-secret-value',
      passwordHash: 'hash-secret-value',
      refreshToken: 'refresh-secret-value',
      clientSecret: 'client-secret-value',
      privateKey: 'private-key-secret-value',
      keyMaterial: 'key-material-secret-value',
      healthIdNumber: 'health-id-secret-value',
      entries: [{ content: 'entry-content-secret' }],
      fhirBundle: { resourceType: 'Bundle', id: 'bundle-secret-id' },
    });

    expect(line).toContain('[REDACTED]');
    expect(line).not.toContain(secrets.otp);
    expect(line).not.toContain(secrets.aadhaar);
    expect(line).not.toContain(secrets.abhaNumber);
    expect(line).not.toContain(secrets.token);
    expect(line).not.toContain('aadhaar-num-111122223333');
    expect(line).not.toContain('x-auth-secret-value');
    expect(line).not.toContain('entry-content-secret');
    expect(line).not.toContain('bundle-secret-id');
    expect(line).not.toContain('password-secret-value');
  });
});
