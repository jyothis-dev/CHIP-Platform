import {
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { AppError } from '../../shared/errors.js';

const X25519_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');

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

function aesGcm(key, iv, plaintext, decrypt = false) {
  const algo = decrypt ? createDecipheriv : createCipheriv;
  const cipher = algo('aes-256-gcm', key, iv);
  if (decrypt) {
    const tag = plaintext.subarray(plaintext.length - 16);
    const data = plaintext.subarray(0, plaintext.length - 16);
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(data), cipher.final()]);
  }
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([encrypted, cipher.getAuthTag()]);
}

/**
 * HIP side of the M2 data-flow cipher.
 * Curve25519 ECDH, XOR of the two 32-byte nonces, HKDF-SHA256 on the
 * x coordinate with an empty info string, AES-256-GCM with the tag appended.
 */
export function openSession({
  requesterPublicKey,
  requesterNonce,
  cryptoAlg,
  curve,
}) {
  if (cryptoAlg !== 'ECDH' || curve !== 'Curve25519') {
    throw new AppError(400, 'FIDELIUS_ALG_UNSUPPORTED', 'The requester named a key agreement this HIP does not use');
  }
  const peerRaw = Buffer.from(requesterPublicKey, 'base64');
  const peerNonce = Buffer.from(requesterNonce, 'base64');
  if (peerNonce.length !== 32) {
    throw new AppError(400, 'FIDELIUS_NONCE_INVALID', 'The requester nonce must be 32 bytes');
  }

  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  const ownNonce = randomBytes(32);
  const shared = diffieHellman({
    privateKey,
    publicKey: importRawPublicKey(peerRaw),
  });
  const mixed = xor32(ownNonce, peerNonce);
  const sessionKey = Buffer.from(hkdfSync('sha256', shared, mixed.subarray(0, 20), Buffer.alloc(0), 32));
  const iv = mixed.subarray(20, 32);
  return {
    publicKey: exportRawPublicKey(publicKey).toString('base64'),
    nonce: ownNonce.toString('base64'),
    privateKey,
    ownNonce,
    encrypt(plaintext) {
      return aesGcm(sessionKey, iv, Buffer.from(plaintext)).toString('base64');
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

export function decryptFromPeer({
  content,
  peerPublicKey,
  peerNonce,
  ownPrivateKey,
  ownNonce,
}) {
  const peerRaw = Buffer.from(peerPublicKey, 'base64');
  const theirNonce = Buffer.from(peerNonce, 'base64');
  const shared = diffieHellman({
    privateKey: ownPrivateKey,
    publicKey: importRawPublicKey(peerRaw),
  });
  const mixed = xor32(ownNonce, theirNonce);
  const sessionKey = Buffer.from(hkdfSync('sha256', shared, mixed.subarray(0, 20), Buffer.alloc(0), 32));
  return aesGcm(sessionKey, mixed.subarray(20, 32), Buffer.from(content, 'base64'), true);
}
