import { createPublicKey, publicEncrypt, constants } from 'node:crypto';
import { AppError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { getContract } from './contracts.js';
import { abdmRequest } from './client.js';

const CACHE_TTL_MS = 60 * 60 * 1000;

let certCache = null;

/** Algorithms observed for M1 certificate responses. */
const OAEP_SHA1 = new Set([
  'RSA/ECB/OAEPWithSHA-1AndMGF1Padding',
  'RSA/ECB/OAEPWITHSHA-1ANDMGF1PADDING',
]);

export function clearCertificateCache() {
  certCache = null;
}

export async function fetchAbhaCertificate({ http } = {}) {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) {
    return certCache;
  }

  const result = await abdmRequest({
    contract: getContract('certificate'),
    http,
  });

  if (result.status < 200 || result.status >= 300 || !result.body?.publicKey) {
    throw new AppError(502, 'ABDM_CERTIFICATE_FAILED', 'ABHA public certificate could not be fetched');
  }

  const encryptionAlgorithm = String(result.body.encryptionAlgorithm || '');
  certCache = {
    publicKey: result.body.publicKey,
    encryptionAlgorithm,
    expiresAt: now + CACHE_TTL_MS,
  };

  logger.info({
    component: 'abdm.crypto',
    requestId: result.requestId,
    encryptionAlgorithm,
  }, 'cached ABHA certificate');

  return certCache;
}

/**
 * Encrypt a plaintext value for an ABHA request body field.
 * Algorithm and padding come from the certificate response, not a hard-coded constant.
 * Keep dashes in an ABHA number before calling this.
 */
export async function encryptForAbha(plaintext, { http, certificate } = {}) {
  if (plaintext == null || plaintext === '') {
    throw new AppError(400, 'ABHA_ENCRYPT_EMPTY', 'Nothing to encrypt');
  }

  const cert = certificate || await fetchAbhaCertificate({ http });
  const algorithm = cert.encryptionAlgorithm;

  if (!OAEP_SHA1.has(algorithm)) {
    throw new AppError(
      502,
      'ABDM_ENCRYPTION_UNSUPPORTED',
      'ABHA certificate named an unsupported encryption algorithm',
    );
  }

  const pem = `-----BEGIN PUBLIC KEY-----\n${cert.publicKey}\n-----END PUBLIC KEY-----`;
  let key;
  try {
    key = createPublicKey(pem);
  } catch (err) {
    throw new AppError(502, 'ABDM_CERTIFICATE_INVALID', 'ABHA public key could not be loaded', { cause: err });
  }

  const ciphertext = publicEncrypt(
    {
      key,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha1',
    },
    Buffer.from(String(plaintext), 'utf8'),
  );

  return ciphertext.toString('base64');
}
