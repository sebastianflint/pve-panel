// A software WebAuthn authenticator for tests: does what a phone, Windows Hello
// or a security key does (ES256 key pair, "none" attestation, signatures), and
// can simulate attacks: wrong origin (phishing), no user verification, replayed
// counter, broken signature.

import crypto from 'node:crypto';

const b64u = (b) => Buffer.from(b).toString('base64url');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest();

// ---- Minimal CBOR encoder (what WebAuthn needs: ints, text, bytes, maps) --------------
function head(major, n) {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  if (n < 65536) { const b = Buffer.alloc(3); b[0] = (major << 5) | 25; b.writeUInt16BE(n, 1); return b; }
  const b = Buffer.alloc(5); b[0] = (major << 5) | 26; b.writeUInt32BE(n, 1); return b;
}
function cbor(v) {
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === 'string') { const t = Buffer.from(v, 'utf8'); return Buffer.concat([head(3, t.length), t]); }
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return Buffer.concat([head(2, v.length), Buffer.from(v)]);
  if (Array.isArray(v)) { // [[key, value], …] = map with ordered keys
    return Buffer.concat([head(5, v.length), ...v.flatMap(([k, val]) => [cbor(k), cbor(val)])]);
  }
  throw new Error(`cbor: unsupported ${typeof v}`);
}

const FLAG = { UP: 0x01, UV: 0x04, BE: 0x08, BS: 0x10, AT: 0x40 };

export class SoftAuthenticator {
  /** origin: what the "browser" reports, e.g. http://localhost:3000 */
  constructor(origin) {
    this.origin = origin;
    this.credentials = new Map(); // id -> { key, rpID, userHandle, counter }
  }

  /** navigator.credentials.create() equivalent; returns RegistrationResponseJSON. */
  create(options, { origin = this.origin, userVerified = true } = {}) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = publicKey.export({ format: 'jwk' });
    const id = crypto.randomBytes(32);
    const cose = cbor([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]);
    const counter = 0;
    const flags = FLAG.UP | FLAG.AT | (userVerified ? FLAG.UV : 0);
    const len = Buffer.alloc(2); len.writeUInt16BE(id.length);
    const cnt = Buffer.alloc(4); cnt.writeUInt32BE(counter);
    const authData = Buffer.concat([sha256(options.rp.id), Buffer.from([flags]), cnt, Buffer.alloc(16), len, id, cose]);
    const attestationObject = cbor([['fmt', 'none'], ['attStmt', []], ['authData', authData]]);
    const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin, crossOrigin: false }));
    this.credentials.set(b64u(id), { key: privateKey, rpID: options.rp.id, userHandle: options.user.id, counter });
    return {
      id: b64u(id), rawId: b64u(id), type: 'public-key',
      response: { clientDataJSON: b64u(clientDataJSON), attestationObject: b64u(attestationObject), transports: ['internal'] },
      clientExtensionResults: {}, authenticatorAttachment: 'platform',
    };
  }

  /** navigator.credentials.get() equivalent; returns AuthenticationResponseJSON. */
  get(options, { origin = this.origin, userVerified = true, counter, breakSignature = false, credentialId } = {}) {
    const id = credentialId ?? [...this.credentials].find(([, c]) => c.rpID === options.rpId)?.[0];
    const cred = this.credentials.get(id);
    if (!cred) throw new Error('no credential for this RP');
    // an explicit counter simulates a cloned authenticator; it isn't remembered
    const value = counter ?? ++cred.counter;
    const cnt = Buffer.alloc(4); cnt.writeUInt32BE(value);
    const flags = FLAG.UP | (userVerified ? FLAG.UV : 0);
    const authData = Buffer.concat([sha256(options.rpId), Buffer.from([flags]), cnt]);
    const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin, crossOrigin: false }));
    let signature = crypto.sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]), cred.key);
    if (breakSignature) { signature = Buffer.from(signature); signature[signature.length - 1] ^= 0xff; }
    return {
      id, rawId: id, type: 'public-key',
      response: {
        clientDataJSON: b64u(clientDataJSON), authenticatorData: b64u(authData),
        signature: b64u(signature), userHandle: cred.userHandle,
      },
      clientExtensionResults: {}, authenticatorAttachment: 'platform',
    };
  }
}
