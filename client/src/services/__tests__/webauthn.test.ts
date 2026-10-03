import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Client-side passkey flow tests.
 *
 * The browser ceremony and the HTTP layer are mocked, so these run in plain
 * Node. What is verified here is the part this app owns: which server calls are
 * made, that the server (never the client) supplies the user identity, and that
 * a dismissed native prompt is surfaced as a cancellation rather than an error.
 */

const apiPost = vi.fn();
const apiGet = vi.fn();
const apiDelete = vi.fn();

vi.mock('../../services/api.js', () => ({
  api: {
    post: (...args: unknown[]) => apiPost(...args),
    get: (...args: unknown[]) => apiGet(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn(() => null),
}));

const startRegistration = vi.fn();
const startAuthentication = vi.fn();
let webAuthnSupported = true;

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: (...args: unknown[]) => startRegistration(...args),
  startAuthentication: (...args: unknown[]) => startAuthentication(...args),
  browserSupportsWebAuthn: () => webAuthnSupported,
  browserSupportsPasskeys: async () => true,
  platformAuthenticatorIsAvailable: async () => true,
  WebAuthnError: class WebAuthnError extends Error {
    code: string;
    constructor(opts: { message: string; code: string; cause?: Error }) {
      super(opts.message);
      this.name = 'WebAuthnError';
      this.code = opts.code;
    }
  },
}));

const {
  registerPasskey,
  authenticateWithPasskey,
  fetchPasskeyAvailability,
  fetchPasskeys,
  removePasskey,
  isWebAuthnSupported,
  describeBiometricError,
  BiometricError,
} = await import('../webauthn.js');

function envelope(data: Record<string, unknown>) {
  return { data: { success: true, data } };
}

beforeEach(() => {
  vi.clearAllMocks();
  webAuthnSupported = true;
});

describe('WebAuthn support detection', () => {
  it('reports support when the browser exposes WebAuthn', () => {
    expect(isWebAuthnSupported()).toBe(true);
  });

  it('reports no support for an unsupported browser', () => {
    webAuthnSupported = false;
    expect(isWebAuthnSupported()).toBe(false);
  });
});

describe('enable biometric flow', () => {
  it('requests options, completes the native prompt, then verifies', async () => {
    apiPost.mockImplementationOnce(async () => envelope({ challengeId: 'c1', options: { challenge: 'x' } }));
    startRegistration.mockResolvedValueOnce({ id: 'cred-1', rawId: 'cred-1', type: 'public-key' });
    apiPost.mockResolvedValueOnce(envelope({ credential: { id: 'cred-1', deviceName: 'Chrome on Windows' } }));

    const result = await registerPasskey('Chrome on Windows');

    expect(apiPost.mock.calls[0][0]).toBe('/auth/webauthn/register/options');
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: { challenge: 'x' } });
    expect(apiPost.mock.calls[1][0]).toBe('/auth/webauthn/register/verify');
    // The client never sends a userId: the server derives it from the JWT.
    expect(JSON.stringify(apiPost.mock.calls[1][1])).not.toMatch(/userId/i);
    expect(result.id).toBe('cred-1');
  });

  it('treats a dismissed native prompt as a cancellation, not an error', async () => {
    apiPost.mockResolvedValueOnce(envelope({ challengeId: 'c1', options: {} }));
    const { WebAuthnError } = await import('@simplewebauthn/browser');
    startRegistration.mockRejectedValueOnce(
      new WebAuthnError({ message: 'cancelled', code: 'ERROR_CEREMONY_ABORTED', cause: new Error('abort') })
    );

    const err = await registerPasskey().catch((e) => e);
    expect(err).toBeInstanceOf(BiometricError);
    expect(err.cancelled).toBe(true);
    expect(err.code).toBe('CANCELLED');
    // No verify call is made when the ceremony never completed.
    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  it('explains a device that cannot verify the user', async () => {
    apiPost.mockResolvedValueOnce(envelope({ challengeId: 'c1', options: {} }));
    const { WebAuthnError } = await import('@simplewebauthn/browser');
    startRegistration.mockRejectedValueOnce(
      new WebAuthnError({
        message: 'nope',
        code: 'ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT',
        cause: new Error('uv'),
      })
    );

    const err = await registerPasskey().catch((e) => e);
    expect(err.code).toBe('NO_USER_VERIFICATION');
    expect(err.cancelled).toBe(false);
  });
});

describe('biometric sign-in flow', () => {
  it('returns the same access token shape as password login', async () => {
    apiPost.mockResolvedValueOnce(envelope({ challengeId: 'c1', options: { challenge: 'y' } }));
    startAuthentication.mockResolvedValueOnce({ id: 'cred-1', response: {} });
    apiPost.mockResolvedValueOnce(
      envelope({ user: { _id: 'u1', email: 'a@example.com' }, accessToken: 'jwt', sessionId: 's1' })
    );

    const result = await authenticateWithPasskey();

    expect(apiPost.mock.calls[0][0]).toBe('/auth/webauthn/login/options');
    expect(apiPost.mock.calls[1][0]).toBe('/auth/webauthn/login/verify');
    expect(result.accessToken).toBe('jwt');
    expect(result.sessionId).toBe('s1');
    // The refresh token is never returned in the body; it rides in the
    // HttpOnly cookie, exactly as for Google Login.
    expect(JSON.stringify(apiPost.mock.calls[1][1])).not.toMatch(/refreshToken/i);
  });

  it('surfaces a server rejection message without exposing internals', async () => {
    apiPost.mockResolvedValueOnce(envelope({ challengeId: 'c1', options: { challenge: 'y' } }));
    startAuthentication.mockResolvedValueOnce({ id: 'cred-1', response: {} });
    apiPost.mockRejectedValueOnce({
      response: {
        data: {
          code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND',
          message: 'This device is not registered for biometric sign-in. Please use Google Login.',
        },
      },
    });

    const err = await authenticateWithPasskey().catch((e) => e);
    expect(err.code).toBe('WEBAUTHN_CREDENTIAL_NOT_FOUND');
    expect(err.message).toContain('Google Login');
  });

  it('reports a network failure distinctly', async () => {
    apiPost.mockRejectedValueOnce({ code: 'ERR_NETWORK' });
    const err = await authenticateWithPasskey().catch((e) => e);
    expect(err.code).toBe('NETWORK');
  });
});

describe('credential management', () => {
  it('lists credentials', async () => {
    apiGet.mockResolvedValueOnce(envelope({ credentials: [{ id: 'c1', deviceName: 'Pixel 9' }] }));
    const result = await fetchPasskeys();
    expect(apiGet).toHaveBeenCalledWith('/auth/webauthn/credentials');
    expect(result[0].deviceName).toBe('Pixel 9');
  });

  it('returns an empty list when the response has no credentials', async () => {
    apiGet.mockResolvedValueOnce(envelope({}));
    expect(await fetchPasskeys()).toEqual([]);
  });

  it('removes a credential by id', async () => {
    apiDelete.mockResolvedValueOnce(envelope({}));
    await removePasskey('cred-1');
    expect(apiDelete).toHaveBeenCalledWith('/auth/webauthn/credentials/cred-1');
  });

  it('falls back to "unavailable" when the status probe fails, so Google Login stays usable', async () => {
    apiGet.mockRejectedValueOnce(new Error('offline'));
    expect(await fetchPasskeyAvailability()).toBe(false);
  });

  it('reports availability from the server probe', async () => {
    apiGet.mockResolvedValueOnce(envelope({ available: true, hasCredentials: true }));
    expect(await fetchPasskeyAvailability()).toBe(true);
  });
});

describe('error messaging', () => {
  it('falls back to a generic message for unknown errors', () => {
    expect(describeBiometricError(new Error('boom'))).toBe('boom');
    expect(describeBiometricError('nope')).toContain('could not be completed');
  });
});
