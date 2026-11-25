import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { decryptFromPeer, encryptForRequester, exportRawPublicKey } from './fidelius.js';

describe('fidelius', () => {
  it('round-trips a record with Curve25519, HKDF, and AES-GCM', () => {
    const requester = generateKeyPairSync('x25519');
    const nonce = randomBytes(32);
    const plaintext = '{"resourceType":"Bundle","type":"document"}';
    const encrypted = encryptForRequester({
      plaintext,
      requesterPublicKey: exportRawPublicKey(requester.publicKey).toString('base64'),
      requesterNonce: nonce.toString('base64'),
      cryptoAlg: 'ECDH',
      curve: 'Curve25519',
    });
    const clear = decryptFromPeer({
      content: encrypted.content,
      peerPublicKey: encrypted.publicKey,
      peerNonce: encrypted.nonce,
      ownPrivateKey: requester.privateKey,
      ownNonce: nonce,
    });
    expect(clear.toString('utf8')).toBe(plaintext);
  });

  it('refuses a curve it was not given', () => {
    expect(() => encryptForRequester({
      plaintext: 'x',
      requesterPublicKey: Buffer.alloc(32, 1).toString('base64'),
      requesterNonce: Buffer.alloc(32, 2).toString('base64'),
      cryptoAlg: 'ECDH',
      curve: 'P-256',
    })).toThrow(/key agreement/i);
  });
});
