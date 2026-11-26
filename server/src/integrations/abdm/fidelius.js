import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { AppError } from '../../shared/errors.js';
import { decodePeerKey, encodePublicKey, sharedSecretX } from './fidelius/curve25519.js';

/**
 * ABDM data-flow cipher (catalogue atoms `hiecm.concept.data-flow-encryption`
 * and `shared.concept.fidelius-ecdh-interop`, 2026.09.16):
 * ECDH on Curve25519, XOR of the two 32-byte nonces (first 20 bytes HKDF
 * salt, last 12 bytes IV), HKDF-SHA256 over the Weierstrass x coordinate of
 * the shared point with an empty info, AES-256-GCM with no AAD and the
 * 16-byte tag appended. Public keys travel as Fidelius X.509 SPKI.
 */

const X25519_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');

export const KEY_PARAMETERS = 'Curve25519/32byte random key';

function xor32(left, right) {
  const out = Buffer.alloc(32);
  for (let i = 0; i < 32; i += 1) out[i] = left[i] ^ right[i];
  return out;
}

export function exportRawPublicKey(publicKey) {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return der.subarray(der.length - 32);
}

export function importRawPublicKey(raw) {
  if (!Buffer.isBuffer(raw) || raw.length !== 32) {
    throw new AppError(400, 'FIDELIUS_KEY_INVALID', 'Curve25519 public key must be 32 bytes');
  }
  return createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
}

export function assertSupported(cryptoAlg, curve) {
  if (String(cryptoAlg || '').toUpperCase() !== 'ECDH'
    || String(curve || '').toLowerCase() !== 'curve25519') {
    throw new AppError(400, 'FIDELIUS_ALG_UNSUPPORTED', 'The peer named a key agreement this system does not use');
  }
}

function decodeNonce(value, who) {
  const nonce = Buffer.from(String(value || ''), 'base64');
  if (nonce.length !== 32) {
    throw new AppError(400, 'FIDELIUS_NONCE_INVALID', `The ${who} nonce must be 32 bytes`);
  }
  return nonce;
}

function deriveKey(privateKey, peerKeyObject, nonceA, nonceB) {
  const shared = diffieHellman({ privateKey, publicKey: peerKeyObject });
  const mixed = xor32(nonceA, nonceB);
  const key = Buffer.from(hkdfSync('sha256', sharedSecretX(shared), mixed.subarray(0, 20), Buffer.alloc(0), 32));
  return { key, iv: mixed.subarray(20, 32) };
}

function aesGcm(key, iv, input, decrypt = false) {
  if (decrypt) {
    if (input.length < 17) {
      throw new AppError(400, 'FIDELIUS_CONTENT_INVALID', 'Encrypted content is too short');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(input.subarray(input.length - 16));
    return Buffer.concat([decipher.update(input.subarray(0, input.length - 16)), decipher.final()]);
  }
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  return Buffer.concat([encrypted, cipher.getAuthTag()]);
}

/**
 * HIU side: a fresh key pair and nonce for one health information request.
 * The private key is returned as PKCS#8 DER so it can be encrypted at rest.
 */
export function generateKeyMaterial({ expiresAt }) {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  const nonce = randomBytes(32);
  return {
    keyMaterial: {
      cryptoAlg: 'ECDH',
      curve: 'curve25519',
      dhPublicKey: {
        expiry: new Date(expiresAt).toISOString(),
        parameters: KEY_PARAMETERS,
        keyValue: encodePublicKey(publicKey),
      },
      nonce: nonce.toString('base64'),
    },
    privateKeyPkcs8: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    nonce: nonce.toString('base64'),
  };
}

/** HIP side of the M2 data-flow cipher. */
export function openSession({
  requesterPublicKey,
  requesterNonce,
  cryptoAlg,
  curve,
}) {
  assertSupported(cryptoAlg, curve);
  const peerNonce = decodeNonce(requesterNonce, 'requester');
  const peerKey = decodePeerKey(requesterPublicKey);
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  const ownNonce = randomBytes(32);
  const { key, iv } = deriveKey(privateKey, peerKey, ownNonce, peerNonce);
  return {
    publicKey: encodePublicKey(publicKey),
    nonce: ownNonce.toString('base64'),
    privateKey,
    ownNonce,
    encrypt(plaintext) {
      return aesGcm(key, iv, Buffer.from(plaintext)).toString('base64');
    },
  };
}

export function encryptForRequester({ plaintext, ...rest }) {
  const session = openSession(rest);
  return {
    content: session.encrypt(plaintext),
    publicKey: session.publicKey,
    nonce: session.nonce,
    privateKey: session.privateKey,
    ownNonce: session.ownNonce,
  };
}

function toPrivateKey(value) {
  if (value && typeof value === 'object' && value.type === 'private') return value;
  return createPrivateKey({ key: Buffer.from(String(value), 'base64'), format: 'der', type: 'pkcs8' });
}

/**
 * HIU side: decrypt one pushed entry. `ownPrivateKey` is a KeyObject or the
 * base64 PKCS#8 DER from generateKeyMaterial; `ownNonce` a Buffer or base64.
 */
export function decryptFromPeer({
  content,
  peerPublicKey,
  peerNonce,
  ownPrivateKey,
  ownNonce,
}) {
  const own = Buffer.isBuffer(ownNonce) ? ownNonce : decodeNonce(ownNonce, 'requester');
  const { key, iv } = deriveKey(
    toPrivateKey(ownPrivateKey),
    decodePeerKey(peerPublicKey),
    own,
    decodeNonce(peerNonce, 'sender'),
  );
  return aesGcm(key, iv, Buffer.from(String(content || ''), 'base64'), true);
}
