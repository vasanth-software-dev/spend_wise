import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebAuthnErrorCode } from '@simplewebauthn/browser';

/**
 * Slice-level tests for the biometric sign-in state machine.
 *
 * Component tests would need a DOM testing library, which this project does not
 * use, so the reducer behaviour is verified directly — in particular that a
 * dismissed prompt leaves the login page in a clean state instead of showing an
 * error, which is the behaviour the login screen depends on.
 */

class FakeWebAuthnError extends Error {
  code: WebAuthnErrorCode;
  constructor(message: string, code: WebAuthnErrorCode) {
    super(message);
    this.code = code;
  }
}

const authenticateWithPasskey = vi.fn();
const describeBiometricError = vi.fn((err: unknown) =>
  err instanceof Error ? err.message : 'Biometric authentication could not be completed.'
);

// Path is relative to this file: src/store/slices/__tests__ -> src/services.
vi.mock('../../../services/webauthn.js', () => ({
  authenticateWithPasskey: () => authenticateWithPasskey(),
  describeBiometricError: (err: unknown) => describeBiometricError(err),
  BiometricError: class BiometricError extends Error {
    code: string;
    cancelled: boolean;
    constructor(code: string, message: string, cancelled = false) {
      super(message);
      this.code = code;
      this.cancelled = cancelled;
    }
  },
}));

const setAccessToken = vi.fn();
vi.mock('../../../services/api.js', () => ({
  api: { post: vi.fn(), get: vi.fn(), delete: vi.fn() },
  setAccessToken: (token: string | null) => setAccessToken(token),  getAccessToken: () => null,
}));

const { default: authReducer, biometricLoginThunk } = await import('../authSlice.js');
const { configureStore } = await import('@reduxjs/toolkit');

const USER = {
  _id: 'u1',
  name: 'A',
  email: 'a@example.com',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  isEmailVerified: true,
  createdAt: '',
};

/** Runs the thunk against a real store and returns the resulting auth state. */
async function runBiometricLogin() {
  const store = configureStore({ reducer: { auth: authReducer } });
  await store.dispatch(biometricLoginThunk());
  return store.getState().auth;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('biometricLoginThunk', () => {
  it('stores the access token and signs the user in on success', async () => {
    authenticateWithPasskey.mockResolvedValueOnce({ accessToken: 'jwt-123', user: USER, sessionId: 's1' });

    const state = await runBiometricLogin();

    expect(setAccessToken).toHaveBeenCalledWith('jwt-123');
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(USER);
    expect(state.biometricLoading).toBe(false);
    expect(state.biometricError).toBeNull();
  });

  it('clears loading and shows no error when the user cancels', async () => {
    const { BiometricError } = await import('../../../services/webauthn.js');
    authenticateWithPasskey.mockRejectedValueOnce(
      new BiometricError('CANCELLED', 'Biometric sign-in was cancelled.', true)
    );

    const state = await runBiometricLogin();

    expect(state.biometricLoading).toBe(false);
    // A dismissal must never render an error banner; Google Login stays usable.
    expect(state.biometricError).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('surfaces a genuine failure message', async () => {
    const { BiometricError } = await import('../../../services/webauthn.js');
    authenticateWithPasskey.mockRejectedValueOnce(
      new BiometricError('CREDENTIAL_UNAVAILABLE', 'No matching passkey was found.')
    );

    const state = await runBiometricLogin();

    expect(state.biometricError).toBe('No matching passkey was found.');
  });

  it('falls back to a readable message for an unrecognized error', async () => {
    authenticateWithPasskey.mockRejectedValueOnce(
      new FakeWebAuthnError('weird', 'ERROR_CEREMONY_ABORTED')
    );

    const state = await runBiometricLogin();

    expect(state.biometricError).toBe('weird');
  });
});
