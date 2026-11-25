import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';

function keyBuffer(value, label) {
  if (!value) {
    throw new AppError(503, 'ABHA_KEY_MISSING', `${label} is not configured`);
  }
  const buf = Buffer.from(value, 'base64');
  if (buf.length !== 32) {
    throw new AppError(503, 'ABHA_KEY_INVALID', `${label} must be 32 bytes base64`);
  }
  return buf;
}

export function maskAbhaNumber(abhaNumber) {
  const digits = String(abhaNumber).replace(/\D/g, '');
  const last4 = digits.slice(-4).padStart(4, '0');
  return `**-****-****-${last4}`;
}

export function hashAbhaNumber(abhaNumber) {
  const key = keyBuffer(env.abhaHashKey, 'ABHA_HASH_KEY');
  const normalized = String(abhaNumber).trim();
  return createHmac('sha256', key).update(normalized, 'utf8').digest('hex');
}

export function hashMobile(mobile) {
  const digits = String(mobile).replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return hashAbhaNumber(local);
}

/** AES-256-GCM. Output: base64(iv || tag || ciphertext). */
export function encryptAbhaNumberAtRest(abhaNumber) {
  const key = keyBuffer(env.abhaEncKey, 'ABHA_ENC_KEY');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(abhaNumber), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptAbhaNumberAtRest(payload) {
  const key = keyBuffer(env.abhaEncKey, 'ABHA_ENC_KEY');
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function currentEncKeyVersion() {
  return env.abhaEncKeyVersion;
}
