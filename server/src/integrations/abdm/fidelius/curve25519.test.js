import {
  createCipheriv,
  createHash,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import {
  A,
  A_OVER_3,
  GENERATOR_X,
  P,
  WEIERSTRASS_A,
  WEIERSTRASS_B,
  bigToBytesBE,
  bytesToBigBE,
  decodePeerKey,
  encodePublicKey,
  modInv,
  sqrtMod,
} from './curve25519.js';
import { decryptFromPeer, encryptForRequester, generateKeyMaterial } from '../fidelius.js';

const mod = (v) => ((v % P) + P) % P;

// Independent short-Weierstrass arithmetic: how a BouncyCastle (Fidelius) peer computes.
function add(p1, p2) {
  if (!p1) return p2;
  if (!p2) return p1;
  if (p1.x === p2.x && mod(p1.y + p2.y) === 0n) return null;
  const lambda = p1.x === p2.x && p1.y === p2.y
    ? mod((3n * p1.x * p1.x + WEIERSTRASS_A) * modInv(2n * p1.y))
    : mod((p2.y - p1.y) * modInv(p2.x - p1.x));
  const x = mod(lambda * lambda - p1.x - p2.x);
  return { x, y: mod(lambda * (p1.x - x) - p1.y) };
}

function mul(k, point) {
  let result = null;
  let addend = point;
  let n = k;
  while (n > 0n) {
    if (n & 1n) result = add(result, addend);
    addend = add(addend, addend);
    n >>= 1n;
  }
  return result;
}

const G = { x: GENERATOR_X, y: sqrtMod(GENERATOR_X ** 3n + WEIERSTRASS_A * GENERATOR_X + WEIERSTRASS_B) };

function peerSpki(point) {
  const prefix = Buffer.from('305b301506072a8648ce3d0201060a2b06010401975501050103420004', 'hex');
  return Buffer.concat([prefix, bigToBytesBE(point.x), bigToBytesBE(point.y)]).toString('base64');
}

function pointFromSpki(base64) {
  const raw = Buffer.from(base64, 'base64');
  const point = raw.subarray(raw.length - 65);
  return { x: bytesToBigBE(point.subarray(1, 33)), y: bytesToBigBE(point.subarray(33)) };
}

function peerEncrypt({ plaintext, hiuKeyValue, hiuNonce }) {
  const d = bytesToBigBE(randomBytes(32)) % (P - 1n) + 1n;
  const peerPub = mul(d, G);
  const shared = mul(d, pointFromSpki(hiuKeyValue));
  const peerNonce = randomBytes(32);
  const mixed = Buffer.alloc(32);
  const theirs = Buffer.from(hiuNonce, 'base64');
  for (let i = 0; i < 32; i += 1) mixed[i] = peerNonce[i] ^ theirs[i];
  const key = Buffer.from(hkdfSync('sha256', bigToBytesBE(shared.x), mixed.subarray(0, 20), Buffer.alloc(0), 32));
  const cipher = createCipheriv('aes-256-gcm', key, mixed.subarray(20));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  return {
    content: ct.toString('base64'),
    keyValue: peerSpki(peerPub),
    nonce: peerNonce.toString('base64'),
    checksum: createHash('md5').update(plaintext).digest('hex'),
  };
}

describe('curve25519 Fidelius codec', () => {
  it('derives the Weierstrass constants from the Montgomery equation', () => {
    expect(A).toBe(486662n);
    expect(GENERATOR_X).toBe(BigInt('0x2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaad245a'));
    expect(WEIERSTRASS_A).toBe(BigInt('0x2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa984914a144'));
    expect(WEIERSTRASS_B).toBe(BigInt('0x7b425ed097b425ed097b425ed097b425ed097b425ed097b4260b5e9c7710c864'));
    expect(mod(A_OVER_3 * 3n)).toBe(A);
  });

  it('encodes a key as a 93-byte SPKI ending in an uncompressed point on the curve', () => {
    const { publicKey } = generateKeyPairSync('x25519');
    const der = Buffer.from(encodePublicKey(publicKey), 'base64');
    expect(der.length).toBe(93);
    const point = pointFromSpki(der.toString('base64'));
    expect(mod(point.y * point.y)).toBe(mod(point.x ** 3n + WEIERSTRASS_A * point.x + WEIERSTRASS_B));
  });

  it('decrypts a record from a Weierstrass (BouncyCastle-style) peer', () => {
    const material = generateKeyMaterial({ expiresAt: Date.now() + 60_000 });
    const plaintext = '{"resourceType":"Bundle","type":"document"}';
    const push = peerEncrypt({
      plaintext,
      hiuKeyValue: material.keyMaterial.dhPublicKey.keyValue,
      hiuNonce: material.nonce,
    });
    const clear = decryptFromPeer({
      content: push.content,
      peerPublicKey: push.keyValue,
      peerNonce: push.nonce,
      ownPrivateKey: material.privateKeyPkcs8,
      ownNonce: material.nonce,
    });
    expect(clear.toString('utf8')).toBe(plaintext);
  });

  it('accepts a bare 65-byte point and an explicit-parameter style prefix', () => {
    const material = generateKeyMaterial({ expiresAt: Date.now() + 60_000 });
    const push = peerEncrypt({
      plaintext: 'x',
      hiuKeyValue: material.keyMaterial.dhPublicKey.keyValue,
      hiuNonce: material.nonce,
    });
    const point = Buffer.from(push.keyValue, 'base64').subarray(-65);
    const longer = Buffer.concat([Buffer.alloc(200, 0x30), point]);
    for (const keyValue of [point.toString('base64'), longer.toString('base64')]) {
      const clear = decryptFromPeer({
        content: push.content,
        peerPublicKey: keyValue,
        peerNonce: push.nonce,
        ownPrivateKey: material.privateKeyPkcs8,
        ownNonce: material.nonce,
      });
      expect(clear.toString()).toBe('x');
    }
  });

  it('refuses a point that is not on the curve', () => {
    const bad = Buffer.concat([Buffer.from([0x04]), Buffer.alloc(64, 1)]).toString('base64');
    expect(() => decodePeerKey(bad)).toThrow(/not a Curve25519 point/);
  });

  it('round-trips CHIP HIP to CHIP HIU and fails the tag on tampering', () => {
    const material = generateKeyMaterial({ expiresAt: Date.now() + 60_000 });
    const sent = encryptForRequester({
      plaintext: 'hello',
      requesterPublicKey: material.keyMaterial.dhPublicKey.keyValue,
      requesterNonce: material.nonce,
      cryptoAlg: 'ECDH',
      curve: 'curve25519',
    });
    const args = {
      peerPublicKey: sent.publicKey,
      peerNonce: sent.nonce,
      ownPrivateKey: material.privateKeyPkcs8,
      ownNonce: material.nonce,
    };
    expect(decryptFromPeer({ ...args, content: sent.content }).toString()).toBe('hello');
    const tampered = Buffer.from(sent.content, 'base64');
    tampered[0] ^= 1;
    expect(() => decryptFromPeer({ ...args, content: tampered.toString('base64') })).toThrow();
  });
});
