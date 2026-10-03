import {
  browserSupportsWebAuthn,
  browserSupportsPasskeys,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  WebAuthnError,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { api } from './api.js';

/**
 * WebAuthn / passkey client.
 *
 * Everything here delegates to `@simplewebauthn/browser`, which calls the
 * browser's native `navigator.credentials` API. The actual fingerprint /
 * Face ID / device-PIN check happens inside the OS and never produces data this
 * app — or the server — can read. We only ever handle challenge/response
 * material.
 */

/** Raised for user-facing WebAuthn failures, with a message safe to display. */
export class BiometricError extends Error {
  public readonly code: string;
  /** True when the user dismissed the native prompt (never an error state). */
  public readonly cancelled: boolean;

  constructor(code: string, message: string, cancelled = false) {
    super(message);
    this.name = 'BiometricError';
    this.code = code;
    this.cancelled = cancelled;
  }
}

export function isWebAuthnSupported(): boolean {
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
}

/** True when the browser can use synced passkeys / platform authenticators. */
export async function supportsPasskeys(): Promise<boolean> {
  try {
    return await browserSupportsPasskeys();
  } catch {
    return false;
  }
}

export async function hasPlatformAuthenticator(): Promise<boolean> {
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

export function guessDeviceName(): string {
  if (typeof navigator === 'undefined') return 'This device';
  const ua = navigator.userAgent || '';
  const os = /Windows NT/.test(ua)
    ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
    ? 'Android'
    : /Mac OS X/.test(ua)
    ? 'macOS'
    : /Linux/.test(ua)
    ? 'Linux'
    : 'Device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
    ? 'Chrome'
    : /Safari\//.test(ua)
    ? 'Safari'
    : /Firefox\//.test(ua)
    ? 'Firefox'
    : 'Browser';
  return `${browser} on ${os}`;
}

/** Server response envelope: the opaque `challengeId` plus the WebAuthn options. */
interface CeremonyEnvelope {
  challengeId: string;
  options: unknown;
}

interface RegisterEnvelope extends CeremonyEnvelope {
  options: PublicKeyCredentialCreationOptionsJSON;
}

interface LoginEnvelope extends CeremonyEnvelope {
  options: PublicKeyCredentialRequestOptionsJSON;
}

/**
 * Full enable flow: fetch options, show the native prompt, send the
 * attestation back. The user id is never sent — the server derives it from the
 * access token on the request.
 */
export async function registerPasskey(deviceName?: string): Promise<{ id: string; deviceName: string }> {

  const name = deviceName ?? guessDeviceName();
  try {
    const { data } = await api.post('/auth/webauthn/register/options', { deviceName: name });
    const { challengeId, options } = data.data as RegisterEnvelope;

    const credential = await startRegistration({ optionsJSON: options });

    const verify = await api.post('/auth/webauthn/register/verify', {
      challengeId,
      deviceName: name,
      credential,
    });

    return verify.data.data.credential;
  } catch (err) {
    // Covers a dismissed prompt, a failed network call, and a server
    // rejection, so every failure mode yields a user-safe message.
    throw toBiometricError(err, 'register');
  }
}

/**
 * Full sign-in flow: fetch options, show the native prompt, send the assertion
 * back. The server responds with the same access token + HttpOnly refresh
 * cookie that Google Login returns, so the caller stores it identically.
 */
export async function authenticateWithPasskey(): Promise<{ accessToken: string; user: unknown; sessionId: string }> {
  try {
    const { data } = await api.post('/auth/webauthn/login/options');
    const { challengeId, options } = data.data as LoginEnvelope;

    const assertion = await startAuthentication({ optionsJSON: options });

    const { data: verified } = await api.post('/auth/webauthn/login/verify', {
      challengeId,
      credential: assertion,
    });

    return verified.data;
  } catch (err) {
    throw toBiometricError(err, 'login');
  }
}

export interface PasskeySummary {
  id: string;
  deviceName: string;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports: string[];
  aaguid: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function fetchPasskeys(): Promise<PasskeySummary[]> {
  const { data } = await api.get('/auth/webauthn/credentials');
  return (data.data?.credentials ?? []) as PasskeySummary[];
}

export async function removePasskey(credentialId: string): Promise<void> {
  await api.delete(`/auth/webauthn/credentials/${encodeURIComponent(credentialId)}`);
}

/**
 * Cheap public probe: does the server hold any passkey at all? Used to decide
 * whether the login page should offer the passkey option at all.
 */
export async function fetchPasskeyAvailability(): Promise<boolean> {
  try {
    const { data } = await api.get('/auth/webauthn/status');
    return Boolean(data.data?.hasCredentials);
  } catch {
    return false;
  }
}

/**
 * Normalizes browser and server failures into messages that are accurate for
 * an end user. In particular a dismissed prompt is a normal outcome, not an
 * error, so it never surfaces as a generic "server error".
 */
function toBiometricError(err: unknown, context: 'register' | 'login'): BiometricError {
  if (err instanceof BiometricError) return err;

  // Dismissed / timed-out native prompt.
  if (err instanceof WebAuthnError) {
    switch (err.code) {
      case 'ERROR_CEREMONY_ABORTED':
        return new BiometricError(
          'CANCELLED',
          context === 'register'
            ? 'Biometric setup was cancelled. You can try again whenever you like.'
            : 'Biometric sign-in was cancelled.',
          true
        );
      case 'ERROR_INVALID_DOMAIN':
      case 'ERROR_INVALID_RP_ID':
        return new BiometricError(
          'INVALID_SITE',
          'This site is not valid for biometric sign-in. Check the app address and try again.'
        );
      case 'ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT':
        return new BiometricError(
          'NO_USER_VERIFICATION',
          'This device cannot verify your identity for biometric sign-in. Set up a screen lock, fingerprint or Face ID first.'
        );
      case 'ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT':
      case 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED':
        return new BiometricError(
          'CREDENTIAL_UNAVAILABLE',
          context === 'register'
            ? 'This device already has a SpendWise passkey.'
            : 'No matching passkey was found on this device. Sign in with Google instead.'
        );
      case 'ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG':
        return new BiometricError(
          'UNSUPPORTED_CREDENTIAL',
          'This device cannot create a supported passkey.'
        );
      case 'ERROR_AUTHENTICATOR_GENERAL_ERROR':
        return new BiometricError('AUTHENTICATOR_ERROR', 'Your device could not complete the biometric check. Please try again.');
      default:
        return new BiometricError('WEBAUTHN_ERROR', 'Biometric authentication could not be completed. Please try again.');
    }
  }

  const axiosCode = (err as { code?: string })?.code;
  if (axiosCode === 'ERR_CANCELED') {
    return new BiometricError('CANCELLED', 'Biometric sign-in was cancelled.', true);
  }

  // Server-side rejections arrive as { code, message } with a user-safe message.
  const response = (err as { response?: { data?: { code?: string; message?: string } } })?.response;
  if (response?.data?.message) {
    return new BiometricError(response.data.code ?? 'WEBAUTHN_REJECTED', response.data.message);
  }
  if (axiosCode === 'ERR_NETWORK') {
    return new BiometricError('NETWORK', 'Network error. Check your connection and try again.');
  }

  return new BiometricError('UNKNOWN', 'Biometric authentication could not be completed. Please try again.');
}

/** Maps any thrown value to a displayable string. */
export function describeBiometricError(err: unknown): string {
  if (err instanceof BiometricError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Biometric authentication could not be completed. Please try again.';
}
