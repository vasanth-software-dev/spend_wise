import crypto from 'crypto';

/**
 * A minimal software WebAuthn authenticator used by the backend test suite.
 *
 * It performs REAL cryptography: a P-256 key pair is generated with Node's
 * `crypto`, assertions are genuinely signed, and the CBOR attestation object
 * is genuinely encoded. That means the production verification path in
 * `@simplewebauthn/server` (origin, RP ID, challenge, signature, user
 * verification, counter) is exercised end to end rather than mocked.
 *
 * No biometric data exists anywhere in this file — as in production, only a
 * key pair and a credential ID are involved.
 */

type CborValue = number | string | Buffer | CborValue[] | Map<number | string, CborValue>;

/** Minimal CBOR encoder covering the subset WebAuthn attestation needs. */
function encodeHead(major: number, length: number): Buffer {
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length <= 0xff) return Buffer.from([(major << 5) | 24, length]);
  if (length <= 0xffff) {
    const buf = Buffer.alloc(3);
    buf[0] = (major << 5) | 25;
    buf.writeUInt16BE(length, 1);
    return buf;
  }
  const buf = Buffer.alloc(5);
  buf[0] = (major << 5) | 26;
  buf.writeUInt32BE(length, 1);
  return buf;
}

function encodeCbor(value: CborValue): Buffer {
  if (typeof value === 'number') {
    return value >= 0 ? encodeHead(0, value) : encodeHead(1, -1 - value);
  }
  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([encodeHead(3, bytes.length), bytes]);
  }
  if (Buffer.isBuffer(value)) {
    return Buffer.concat([encodeHead(2, value.length), value]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([encodeHead(4, value.length), ...value.map(encodeCbor)]);
  }
  if (value instanceof Map) {
    const parts: Buffer[] = [encodeHead(5, value.size)];
    for (const [key, val] of value.entries()) {
      parts.push(encodeCbor(key), encodeCbor(val));
    }
    return Buffer.concat(parts);
  }
  throw new Error('Unsupported CBOR value');
}

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_BACKUP_ELIGIBLE = 0x08;
const FLAG_BACKED_UP = 0x10;
const FLAG_ATTESTED_CREDENTIAL_DATA = 0x40;

export interface TestAuthenticator {
  credentialId: Buffer;
  privateKey: crypto.KeyObject;
  cosePublicKey: Buffer;
}

export interface CeremonyParams {
  challenge: string;
  origin: string;
  rpId: string;
  counter?: number;
  /** Set to false to simulate an authenticator that skips user verification. */
  userVerified?: boolean;
  /** Overrides the RP ID hash, to simulate a wrong-RP-ID attack. */
  rpIdOverride?: string;
  /** Corrupts the produced signature, to simulate tampering. */
  corruptSignature?: boolean;
  backedUp?: boolean;
}

export function createTestAuthenticator(): TestAuthenticator {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const credentialId = crypto.randomBytes(32);
  return { credentialId, privateKey, cosePublicKey: encodeCoseEs256PublicKey(publicKey) };
}

/** COSE_Key for an ES256 (P-256) public key: {1:2, 3:-7, -1:1, -2:x, -3:y}. */
function encodeCoseEs256PublicKey(publicKey: crypto.KeyObject): Buffer {
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  return encodeCbor(
    new Map<number | string, CborValue>([
      [1, 2], // kty: EC2
      [3, -7], // alg: ES256
      [-1, 1], // crv: P-256
      [-2, Buffer.from(jwk.x, 'base64url')],
      [-3, Buffer.from(jwk.y, 'base64url')],
    ])
  );
}

function sha256(data: Buffer): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

function buildAuthData(
  rpId: string,
  counter: number,
  flags: number,
  attested?: { credentialId: Buffer; cosePublicKey: Buffer }
): Buffer {
  const parts: Buffer[] = [sha256(Buffer.from(rpId, 'utf8'))];

  const counterBuf = Buffer.alloc(4);
  counterBuf.writeUInt32BE(counter, 0);
  parts.push(Buffer.from([flags]), counterBuf);

  if (attested) {
    const credIdLen = Buffer.alloc(2);
    credIdLen.writeUInt16BE(attested.credentialId.length, 0);
    parts.push(
      Buffer.alloc(16), // zero AAGUID: no identifying attestation
      credIdLen,
      attested.credentialId,
      attested.cosePublicKey
    );
  }

  return Buffer.concat(parts);
}

function buildClientDataJSON(type: string, params: CeremonyParams): Buffer {
  return Buffer.from(
    JSON.stringify({
      type,
      challenge: params.challenge,
      origin: params.origin,
      crossOrigin: false,
    }),
    'utf8'
  );
}

function sign(auth: TestAuthenticator, data: Buffer, corrupt: boolean): Buffer {
  const signature = crypto.sign('sha256', data, {
    key: auth.privateKey,
    dsaEncoding: 'der',
  });
  if (!corrupt) return signature;
  // Flip a byte so verification fails for cryptographic, not structural, reasons.
  const tampered = Buffer.from(signature);
  tampered[tampered.length - 1] ^= 0xff;
  return tampered;
}

export function buildRegistrationResponse(
  auth: TestAuthenticator,
  params: CeremonyParams
): Record<string, unknown> {
  const userVerified = params.userVerified !== false;
  const flags =
    FLAG_USER_PRESENT |
    (userVerified ? FLAG_USER_VERIFIED : 0) |
    (params.backedUp ? FLAG_BACKUP_ELIGIBLE | FLAG_BACKED_UP : 0) |
    FLAG_ATTESTED_CREDENTIAL_DATA;

  const authData = buildAuthData(params.rpIdOverride ?? params.rpId, params.counter ?? 0, flags, {
    credentialId: auth.credentialId,
    cosePublicKey: auth.cosePublicKey,
  });
  const clientDataJSON = buildClientDataJSON('webauthn.create', params);

  const attestationObject = encodeCbor(
    new Map<string, CborValue>([
      ['fmt', 'none'],
      ['attStmt', new Map()],
      ['authData', authData],
    ])
  );

  return {
    id: auth.credentialId.toString('base64url'),
    rawId: auth.credentialId.toString('base64url'),
    type: 'public-key',
    response: {
      clientDataJSON: clientDataJSON.toString('base64url'),
      attestationObject: attestationObject.toString('base64url'),
      transports: ['internal', 'hybrid'],
    },
    clientExtensionResults: {},
  };
}

export function buildAuthenticationResponse(
  auth: TestAuthenticator,
  params: CeremonyParams
): Record<string, unknown> {
  const userVerified = params.userVerified !== false;
  const flags =
    FLAG_USER_PRESENT |
    (userVerified ? FLAG_USER_VERIFIED : 0) |
    (params.backedUp ? FLAG_BACKUP_ELIGIBLE | FLAG_BACKED_UP : 0);

  const authData = buildAuthData(params.rpIdOverride ?? params.rpId, params.counter ?? 0, flags);
  const clientDataJSON = buildClientDataJSON('webauthn.get', params);

  const signature = sign(
    auth,
    Buffer.concat([authData, sha256(clientDataJSON)]),
    params.corruptSignature === true
  );

  return {
    id: auth.credentialId.toString('base64url'),
    rawId: auth.credentialId.toString('base64url'),
    type: 'public-key',
    response: {
      clientDataJSON: clientDataJSON.toString('base64url'),
      authenticatorData: authData.toString('base64url'),
      signature: signature.toString('base64url'),
      userHandle: undefined,
    },
    clientExtensionResults: {},
  };
}
