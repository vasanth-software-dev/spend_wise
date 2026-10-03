import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebAuthnService } from '../src/services/WebAuthnService.js';
import { WebAuthnChallengeStore, type StoredChallenge } from '../src/services/WebAuthnChallengeStore.js';
import { InMemoryWebAuthnCredentialRepository } from './helpers/inMemoryWebAuthnRepository.js';
import {
  buildAuthenticationResponse,
  buildRegistrationResponse,
  createTestAuthenticator,
} from './helpers/testAuthenticator.js';
import { env } from '../src/config/env.js';
import { IUser } from '../src/types/index.js';

// The service writes an audit entry for every credential change. Mocking the
// repository keeps these tests free of a MongoDB dependency while still
// asserting the real verification and authorization logic.
vi.mock('../src/repositories/AuditLogRepository.js', () => ({
  auditLogRepository: { log: vi.fn(async () => ({})), findByUserId: vi.fn(async () => []) },
}));

const ORIGIN = 'http://localhost:5173';
const RP_ID = env.WEBAUTHN_RP_ID || 'localhost';

const USER_A: IUser = {
  _id: 'user-a',
  name: 'User A',
  email: 'a@example.com',
  isEmailVerified: true,
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const USER_B: IUser = { ...USER_A, _id: 'user-b', email: 'b@example.com' };

/** Minimal cache honoring the `EX` TTL contract used by the challenge store. */
function makeCache() {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    store,
    async get(key: string) {
      const item = store.get(key);
      if (!item) return null;
      if (Date.now() > item.expiresAt) {
        store.delete(key);
        return null;
      }
      return item.value;
    },
    async set(key: string, value: string, mode?: string, duration?: number) {
      const expiresAt = mode === 'EX' && duration ? Date.now() + duration * 1000 : Date.now() + 60_000;
      store.set(key, { value, expiresAt });
      return 'OK';
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0;
    },
  };
}

function makeService() {
  const cache = makeCache();
  const challengeStore = new WebAuthnChallengeStore(() => cache);
  const repo = new InMemoryWebAuthnCredentialRepository();
  const service = new WebAuthnService(challengeStore, repo as never);
  return { service, challengeStore, repo, cache };
}

/** Runs the full registration ceremony and returns the stored credential. */
async function registerPasskey(
  service: WebAuthnService,
  user: IUser,
  deviceName?: string
): Promise<{ challengeId: string; credentialId: string; response: Record<string, unknown> }> {
  const auth = createTestAuthenticator();
  const { challengeId, options } = await service.generateRegistrationOptionsFor(user, deviceName);
  const response = buildRegistrationResponse(auth, {
    challenge: options.challenge,
    origin: ORIGIN,
    rpId: RP_ID,
  });
  const { credential } = await service.completeRegistration(user, challengeId, response, deviceName);
  return { challengeId, credentialId: auth.credentialId.toString('base64url'), response };
}

describe('WebAuthn configuration', () => {
  it('accepts the local development origin and rejects plaintext non-loopback origins', async () => {
    const { getWebAuthnOrigins } = await import('../src/config/env.js');
    const origins = getWebAuthnOrigins();
    expect(origins).toContain(ORIGIN);
    expect(origins.every((o) => o.startsWith('https://') || /https?:\/\/(localhost|127\.0\.0\.1)/.test(o))).toBe(true);
  });

  it('never returns a wildcard origin', async () => {
    const { getWebAuthnOrigins } = await import('../src/config/env.js');
    expect(getWebAuthnOrigins()).not.toContain('*');
  });

  it('keeps the configured short challenge lifetime', () => {
    expect(env.WEBAUTHN_CHALLENGE_TTL_SECONDS).toBeGreaterThan(0);
    expect(env.WEBAUTHN_CHALLENGE_TTL_SECONDS).toBeLessThanOrEqual(300);
  });
});

describe('WebAuthn registration', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('creates registration options bound to the authenticated user', async () => {
    const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A, 'Pixel 9');

    expect(challengeId).toEqual(expect.any(String));
    expect(options.challenge).toEqual(expect.any(String));
    expect(options.rp.id).toBe(RP_ID);
    expect(options.user.name).toBe(USER_A.email);
    // The user handle is an opaque encoding of the internal id, never the
    // email address and never usable as an identity claim.
    expect(options.user.id).not.toBe(USER_A.email);
    expect(options.user.id).toBe(Buffer.from(String(USER_A._id), 'utf8').toString('base64url'));
  });

  it('requires user verification on the authenticator', async () => {
    const { options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
    expect(options.authenticatorSelection?.userVerification).toBe('required');
    expect(options.authenticatorSelection?.residentKey).toBe('preferred');
    expect(options.attestation).toBe('none');
  });

  it('verifies a valid registration response and stores only public WebAuthn material', async () => {
    const { credential } = await (async () => {
      const auth = createTestAuthenticator();
      const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A, 'MacBook Pro');
      const response = buildRegistrationResponse(auth, {
        challenge: options.challenge,
        origin: ORIGIN,
        rpId: RP_ID,
      });
      return {
        credential: (
          await ctx.service.completeRegistration(USER_A, challengeId, response, 'MacBook Pro')
        ).credential,
      };
    })();

    expect(credential.credentialId).toEqual(expect.any(String));
    expect(credential.userId).toBe('user-a');
    expect(Buffer.isBuffer(credential.publicKey)).toBe(true);
    expect(credential.publicKey.length).toBeGreaterThan(0);
    expect(credential.deviceName).toBe('MacBook Pro');
    expect(credential.credentialType).toBe('public-key');

    // The persisted record must not carry any biometric template or private key.
    const serialized = JSON.stringify(credential, (key, value) =>
      Buffer.isBuffer(value) ? `<buffer:${value.length}>` : value
    );
    expect(serialized).not.toMatch(/fingerprint|faceprint|biometricTemplate|privateKey/i);
  });

  it('fails when the challenge is unknown or already consumed', async () => {
    const auth = createTestAuthenticator();
    const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
    const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });

    await ctx.service.completeRegistration(USER_A, challengeId, response);

    // Replaying the exact same response must fail: the challenge was deleted.
    await expect(ctx.service.completeRegistration(USER_A, challengeId, response)).rejects.toMatchObject({
      code: 'WEBAUTHN_CHALLENGE_EXPIRED',
    });
  });

  it('fails when the response does not match the stored challenge', async () => {
    const auth = createTestAuthenticator();
    const { challengeId } = await ctx.service.generateRegistrationOptionsFor(USER_A);
    const response = buildRegistrationResponse(auth, {
      challenge: 'a'.repeat(43),
      origin: ORIGIN,
      rpId: RP_ID,
    });

    await expect(ctx.service.completeRegistration(USER_A, challengeId, response)).rejects.toMatchObject({
      code: 'WEBAUTHN_CHALLENGE_MISMATCH',
    });
  });

  it('rejects a registration from a different origin', async () => {
    const auth = createTestAuthenticator();
    const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
    const response = buildRegistrationResponse(auth, {
      challenge: options.challenge,
      origin: 'https://evil.example.com',
      rpId: RP_ID,
    });

    await expect(ctx.service.completeRegistration(USER_A, challengeId, response)).rejects.toMatchObject({
      code: 'WEBAUTHN_ORIGIN_MISMATCH',
    });
  });

  it('rejects a registration against a different RP ID', async () => {
    const auth = createTestAuthenticator();
    const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
    const response = buildRegistrationResponse(auth, {
      challenge: options.challenge,
      origin: ORIGIN,
      rpId: 'attacker.example.com',
    });

    await expect(ctx.service.completeRegistration(USER_A, challengeId, response)).rejects.toMatchObject({
      code: 'WEBAUTHN_RPID_MISMATCH',
    });
  });

  it('rejects a registration where the authenticator did not verify the user', async () => {
    const auth = createTestAuthenticator();
    const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
    const response = buildRegistrationResponse(auth, {
      challenge: options.challenge,
      origin: ORIGIN,
      rpId: RP_ID,
      userVerified: false,
    });

    await expect(ctx.service.completeRegistration(USER_A, challengeId, response)).rejects.toMatchObject({
      code: 'WEBAUTHN_USER_VERIFICATION_FAILED',
    });
  });

  it('rejects a duplicate credential', async () => {
    const auth = createTestAuthenticator();
    const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
    const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });
    await ctx.service.completeRegistration(USER_A, challengeId, response);

    const second = await ctx.service.generateRegistrationOptionsFor(USER_A);
    const replay = buildRegistrationResponse(auth, {
      challenge: second.options.challenge,
      origin: ORIGIN,
      rpId: RP_ID,
    });
    await expect(ctx.service.completeRegistration(USER_A, second.challengeId, replay)).rejects.toMatchObject({
      code: 'WEBAUTHN_CREDENTIAL_EXISTS',
    });
  });

  it('refuses a registration challenge issued for a different user', async () => {
    const auth = createTestAuthenticator();
    const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
    const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });

    await expect(ctx.service.completeRegistration(USER_B, challengeId, response)).rejects.toMatchObject({
      code: 'WEBAUTHN_CHALLENGE_OWNER_MISMATCH',
    });
  });

  it('supports multiple credentials per account', async () => {
    await registerPasskey(ctx.service, USER_A, 'Laptop');
    await registerPasskey(ctx.service, USER_A, 'Phone');

    const credentials = await ctx.service.listCredentials('user-a');
    expect(credentials).toHaveLength(2);
    expect(credentials.map((c) => c.deviceName).sort()).toEqual(['Laptop', 'Phone']);
  });

  it('excludes already-registered credentials from new options', async () => {
    const auth = createTestAuthenticator();
    await (async () => {
      const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
      const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });
      await ctx.service.completeRegistration(USER_A, challengeId, response);
    })();

    const { options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
    expect(options.excludeCredentials?.map((c) => c.id)).toContain(auth.credentialId.toString('base64url'));
  });
});

describe('WebAuthn authentication', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('authenticates a registered credential and updates the counter and lastUsedAt', async () => {
    const auth = createTestAuthenticator();
    await (async () => {
      const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
      const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });
      await ctx.service.completeRegistration(USER_A, challengeId, response);
    })();

    const { challengeId, options } = await ctx.service.generateAuthenticationOptionsFor();
    expect(options.challenge).toEqual(expect.any(String));
    expect(options.userVerification).toBe('required');
    expect(options.allowCredentials).toBeUndefined();

    const assertion = buildAuthenticationResponse(auth, {
      challenge: options.challenge,
      origin: ORIGIN,
      rpId: RP_ID,
      counter: 5,
    });

    const { credential } = await ctx.service.verifyAuthentication(challengeId, assertion);
    expect(credential.credentialId).toBe(auth.credentialId.toString('base64url'));
    expect(credential.counter).toBe(5);
    expect(credential.lastUsedAt).toBeInstanceOf(Date);

    const stored = await ctx.repo.findByCredentialId(auth.credentialId.toString('base64url'));
    expect(stored?.counter).toBe(5);
    expect(stored?.lastUsedAt).not.toBeNull();
  });

  it('rejects an invalid signature', async () => {
    const auth = createTestAuthenticator();
    await (async () => {
      const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
      const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });
      await ctx.service.completeRegistration(USER_A, challengeId, response);
    })();

    const { challengeId, options } = await ctx.service.generateAuthenticationOptionsFor();
    const assertion = buildAuthenticationResponse(auth, {
      challenge: options.challenge,
      origin: ORIGIN,
      rpId: RP_ID,
      counter: 1,
      corruptSignature: true,
    });

    await expect(ctx.service.verifyAuthentication(challengeId, assertion)).rejects.toBeDefined();
  });

  it('rejects an assertion whose challenge does not match', async () => {
    const auth = createTestAuthenticator();
    await (async () => {
      const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
      const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });
      await ctx.service.completeRegistration(USER_A, challengeId, response);
    })();

    const { challengeId } = await ctx.service.generateAuthenticationOptionsFor();
    const assertion = buildAuthenticationResponse(auth, {
      challenge: 'b'.repeat(43),
      origin: ORIGIN,
      rpId: RP_ID,
      counter: 1,
    });

    await expect(ctx.service.verifyAuthentication(challengeId, assertion)).rejects.toMatchObject({
      code: 'WEBAUTHN_CHALLENGE_MISMATCH',
    });
  });

  it('rejects an assertion from a different origin', async () => {
    const auth = createTestAuthenticator();
    await (async () => {
      const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
      const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });
      await ctx.service.completeRegistration(USER_A, challengeId, response);
    })();

    const { challengeId, options } = await ctx.service.generateAuthenticationOptionsFor();
    const assertion = buildAuthenticationResponse(auth, {
      challenge: options.challenge,
      origin: 'https://evil.example.com',
      rpId: RP_ID,
      counter: 1,
    });

    await expect(ctx.service.verifyAuthentication(challengeId, assertion)).rejects.toMatchObject({
      code: 'WEBAUTHN_ORIGIN_MISMATCH',
    });
  });

  it('rejects an unknown credential', async () => {
    const { challengeId, options } = await ctx.service.generateAuthenticationOptionsFor();
    const assertion = buildAuthenticationResponse(createTestAuthenticator(), {
      challenge: options.challenge,
      origin: ORIGIN,
      rpId: RP_ID,
      counter: 1,
    });

    await expect(ctx.service.verifyAuthentication(challengeId, assertion)).rejects.toMatchObject({
      code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND',
    });
  });

  it('rejects user verification failure', async () => {
    const auth = createTestAuthenticator();
    await (async () => {
      const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
      const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });
      await ctx.service.completeRegistration(USER_A, challengeId, response);
    })();

    const { challengeId, options } = await ctx.service.generateAuthenticationOptionsFor();
    const assertion = buildAuthenticationResponse(auth, {
      challenge: options.challenge,
      origin: ORIGIN,
      rpId: RP_ID,
      counter: 1,
      userVerified: false,
    });

    await expect(ctx.service.verifyAuthentication(challengeId, assertion)).rejects.toMatchObject({
      code: 'WEBAUTHN_USER_VERIFICATION_FAILED',
    });
  });

  it('detects a counter regression (cloned authenticator replay)', async () => {
    const auth = createTestAuthenticator();
    await (async () => {
      const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
      const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });
      await ctx.service.completeRegistration(USER_A, challengeId, response);
    })();

    // First use sets the counter to 10.
    const first = await ctx.service.generateAuthenticationOptionsFor();
    await ctx.service.verifyAuthentication(
      first.challengeId,
      buildAuthenticationResponse(auth, { challenge: first.options.challenge, origin: ORIGIN, rpId: RP_ID, counter: 10 })
    );

    // A replayed/lower counter must be refused.
    const second = await ctx.service.generateAuthenticationOptionsFor();
    await expect(
      ctx.service.verifyAuthentication(
        second.challengeId,
        buildAuthenticationResponse(auth, { challenge: second.options.challenge, origin: ORIGIN, rpId: RP_ID, counter: 4 })
      )
    ).rejects.toMatchObject({ code: 'WEBAUTHN_COUNTER_REGRESSION' });
  });

  it('accepts zero counters on both sides (authenticator without counter support)', async () => {
    const auth = createTestAuthenticator();
    await (async () => {
      const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
      const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });
      await ctx.service.completeRegistration(USER_A, challengeId, response);
    })();

    const first = await ctx.service.generateAuthenticationOptionsFor();
    await ctx.service.verifyAuthentication(
      first.challengeId,
      buildAuthenticationResponse(auth, { challenge: first.options.challenge, origin: ORIGIN, rpId: RP_ID, counter: 0 })
    );
    const second = await ctx.service.generateAuthenticationOptionsFor();
    const { credential } = await ctx.service.verifyAuthentication(
      second.challengeId,
      buildAuthenticationResponse(auth, { challenge: second.options.challenge, origin: ORIGIN, rpId: RP_ID, counter: 0 })
    );
    expect(credential.credentialId).toBe(auth.credentialId.toString('base64url'));
  });

  it('consumes the challenge so an assertion cannot be replayed', async () => {
    const auth = createTestAuthenticator();
    await (async () => {
      const { challengeId, options } = await ctx.service.generateRegistrationOptionsFor(USER_A);
      const response = buildRegistrationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID });
      await ctx.service.completeRegistration(USER_A, challengeId, response);
    })();

    const { challengeId, options } = await ctx.service.generateAuthenticationOptionsFor();
    const assertion = buildAuthenticationResponse(auth, { challenge: options.challenge, origin: ORIGIN, rpId: RP_ID, counter: 1 });
    await ctx.service.verifyAuthentication(challengeId, assertion);

    await expect(ctx.service.verifyAuthentication(challengeId, assertion)).rejects.toMatchObject({
      code: 'WEBAUTHN_CHALLENGE_EXPIRED',
    });
  });

  it('rejects an expired challenge', async () => {
    const { challengeId } = await ctx.service.generateAuthenticationOptionsFor();
    // Simulate TTL expiry by clearing the backing store.
    ctx.cache.store.clear();
    await expect(ctx.service.verifyAuthentication(challengeId, {})).rejects.toMatchObject({
      code: 'WEBAUTHN_CHALLENGE_EXPIRED',
    });
  });
});

describe('WebAuthn challenge store', () => {
  it('is single-use and returns the stored challenge once', async () => {
    const cache = makeCache();
    const store = new WebAuthnChallengeStore(() => cache);

    const issued = await store.issue('handle-1', 'authentication');
    const first = await store.consume('handle-1');
    const second = await store.consume('handle-1');

    expect(first?.challenge).toBe(issued.challenge);
    expect(second).toBeNull();
  });

  it('generates a different challenge each time', async () => {
    const cache = makeCache();
    const store = new WebAuthnChallengeStore(() => cache);
    const a = await store.issue('h', 'authentication');
    const b = await store.issue('h', 'authentication');
    expect(a.challenge).not.toBe(b.challenge);
    expect(a.challenge.length).toBeGreaterThanOrEqual(43); // 32 random bytes, base64url
  });

  it('treats a malformed payload as an unknown challenge', async () => {
    const cache = makeCache();
    const store = new WebAuthnChallengeStore(() => cache);
    await cache.set('webauthn:challenge:bad', 'not-json', 'EX', 300);
    expect(await store.consume('bad')).toBeNull();
    // And it is still spent.
    expect(await store.consume('bad')).toBeNull();
  });

  it('records the ceremony type and bound user', async () => {
    const cache = makeCache();
    const store = new WebAuthnChallengeStore(() => cache);
    await store.issue('h', 'registration', 'user-a');
    const record = (await store.consume('h')) as StoredChallenge;
    expect(record.type).toBe('registration');
    expect(record.userId).toBe('user-a');
  });
});

describe('WebAuthn credential authorization', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('lists only the requesting user credentials', async () => {
    await registerPasskey(ctx.service, USER_A, 'A laptop');
    await registerPasskey(ctx.service, USER_B, 'B phone');

    expect(await ctx.service.listCredentials('user-a')).toHaveLength(1);
    expect(await ctx.service.listCredentials('user-b')).toHaveLength(1);
  });

  it('never exposes the stored public key in the summary', async () => {
    await registerPasskey(ctx.service, USER_A, 'Laptop');
    const [summary] = await ctx.service.listCredentials('user-a');
    expect(summary).not.toHaveProperty('publicKey');
  });

  it('prevents one user from deleting another user credential', async () => {
    const { credentialId } = await registerPasskey(ctx.service, USER_A, 'A laptop');

    await expect(
      ctx.service.removeCredential('user-b', credentialId, { userAgent: 'test', ipAddress: '127.0.0.1' })
    ).rejects.toMatchObject({ code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND' });

    // Still present for the real owner.
    expect(await ctx.repo.findByCredentialId(credentialId)).not.toBeNull();
  });

  it('allows the owner to remove their own credential', async () => {
    const { credentialId } = await registerPasskey(ctx.service, USER_A, 'A laptop');
    await ctx.service.removeCredential('user-a', credentialId, { userAgent: 'test', ipAddress: '127.0.0.1' });
    expect(await ctx.repo.findByCredentialId(credentialId)).toBeNull();
  });

  it('reports whether any credential exists without revealing ownership', async () => {
    expect(await ctx.service.hasAnyCredentials()).toBe(false);
    await registerPasskey(ctx.service, USER_A, 'Laptop');
    expect(await ctx.service.hasAnyCredentials()).toBe(true);
  });
});

describe('JWT integration for passkey login', () => {
  it('produces the same access/refresh token structure and expiries as password login', async () => {
    const { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } = await import(
      '../src/utils/jwt.js'
    );
    const { Types } = await import('mongoose');
    const payload = { userId: String(new Types.ObjectId()), email: 'a@example.com', sessionId: String(new Types.ObjectId()) };

    const access = verifyAccessToken(generateAccessToken(payload));
    const refresh = verifyRefreshToken(generateRefreshToken(payload));

    // Same claims as Google Login.
    expect(access.userId).toBe(payload.userId);
    expect(access.email).toBe(payload.email);
    expect(access.sessionId).toBe(payload.sessionId);
    expect(refresh.sessionId).toBe(payload.sessionId);

    // 15 minutes and 7 days respectively, from the unchanged env configuration.
    const accessTtl = (access.exp as number) - (access.iat as number);
    const refreshTtl = (refresh.exp as number) - (refresh.iat as number);
    expect(accessTtl).toBe(15 * 60);
    expect(refreshTtl).toBe(7 * 24 * 60 * 60);
  });

  it('keeps the refresh token out of the JSON body and in an HttpOnly cookie', async () => {
    const { REFRESH_COOKIE_NAME, getRefreshCookieOptions } = await import('../src/utils/jwt.js');
    const opts = getRefreshCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(REFRESH_COOKIE_NAME).toBe('spendwise_refresh_token');
  });
});
