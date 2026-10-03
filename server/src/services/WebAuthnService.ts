import crypto from 'crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { env, getWebAuthnOrigins } from '../config/env.js';
import { webAuthnChallengeStore, WebAuthnChallengeStore, type StoredChallenge } from './WebAuthnChallengeStore.js';
import {
  webAuthnCredentialRepository,
  WebAuthnCredentialRepository,
} from '../repositories/WebAuthnCredentialRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import { auditLogRepository } from '../repositories/AuditLogRepository.js';
import { authService } from './AuthService.js';
import type { ClientMetadata } from './AuthService.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';
import type { AuthTokens, IUser, IWebAuthnCredential } from '../types/index.js';

/** Public shape of a stored credential, safe to return to the client. */
export interface CredentialSummary {
  id: string;
  deviceName: string;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports: string[];
  aaguid: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const MAX_DEVICE_NAME_LENGTH = 60;

/**
 * Normalizes a stored public key into bytes for the WebAuthn verifier,
 * accepting both a Node `Buffer` and Mongoose's `Binary` wrapper.
 */
function toPublicKeyBytes(key: IWebAuthnCredential['publicKey']): Uint8Array<ArrayBuffer> {
  const bytes = Buffer.isBuffer(key)
    ? new Uint8Array(key)
    : new Uint8Array((key as { buffer: Uint8Array }).buffer);
  // Copy into a plain ArrayBuffer so the verifier receives the exact
  // `Uint8Array<ArrayBuffer>` shape it expects.
  return Uint8Array.from(bytes);
}

function sanitizeDeviceName(input: unknown): string {
  if (typeof input !== 'string') return '';
  // Strip control characters, collapse whitespace, and bound the length so a
  // client cannot inject markup or unbounded strings into the settings UI.
  return input
    // Strip C0 control characters and DEL so a crafted device name cannot
    // corrupt logs or the settings UI.
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DEVICE_NAME_LENGTH);
}

/**
 * Translates a raw `@simplewebauthn/server` failure into a stable, user-safe
 * `ApiError`. Internal cryptographic detail (which check failed, signature
 * material, attestation internals) is logged server-side only.
 */
function toSafeVerificationError(err: unknown, context: 'registration' | 'authentication'): ApiError {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`[WebAuthn] ${context} verification failed`, message);

  const normalized = message.toLowerCase();
  if (normalized.includes('origin')) {
    return new ApiError(400, 'WEBAUTHN_ORIGIN_MISMATCH', 'Biometric authentication was rejected: invalid origin.');
  }
  if (normalized.includes('rp id') || normalized.includes('rpid') || normalized.includes('rp id hash')) {
    return new ApiError(400, 'WEBAUTHN_RPID_MISMATCH', 'Biometric authentication was rejected: invalid site identity.');
  }
  if (normalized.includes('challenge')) {
    return new ApiError(400, 'WEBAUTHN_CHALLENGE_MISMATCH', 'Biometric authentication was rejected: invalid or expired request.');
  }
  if (normalized.includes('user verification') || normalized.includes('user verified')) {
    return new ApiError(400, 'WEBAUTHN_USER_VERIFICATION_FAILED', 'Biometric verification did not succeed. Please try again.');
  }
  if (normalized.includes('counter')) {
    return new ApiError(
      401,
      'WEBAUTHN_COUNTER_REGRESSION',
      'Biometric sign-in was rejected for security reasons. Please remove and re-add this device.'
    );
  }
  if (normalized.includes('signature')) {
    return new ApiError(400, 'WEBAUTHN_INVALID_SIGNATURE', 'Biometric authentication was rejected: invalid signature.');
  }
  return new ApiError(400, 'WEBAUTHN_VERIFICATION_FAILED', 'Biometric authentication could not be verified. Please try again.');
}

export class WebAuthnService {
  /**
   * @param challengeStore overridable so tests can run without Redis.
   * @param credentialRepository overridable so tests can use an in-memory
   *        credential store instead of MongoDB.
   */
  constructor(
    private readonly challengeStore: WebAuthnChallengeStore = webAuthnChallengeStore,
    private readonly credentialRepository: WebAuthnCredentialRepository = webAuthnCredentialRepository
  ) {}

  /**
   * Registration options for the ALREADY AUTHENTICATED user.
   * The user handle is derived from the verified session, never from the body.
   */
  async generateRegistrationOptionsFor(
    user: IUser,
    deviceName?: unknown
  ): Promise<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }> {
    const existing = await this.credentialRepository.findByUserId(String(user._id));

    const options = await generateRegistrationOptions({
      rpName: env.WEBAUTHN_RP_NAME,
      rpID: env.WEBAUTHN_RP_ID,
      userName: user.email,
      userDisplayName: user.name,
      // The WebAuthn user handle is opaque; it must be stable per account so a
      // passkey created on another device resolves to the same user. We never
      // expose or accept it as an identity claim.
      userID: new TextEncoder().encode(String(user._id)),
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        // "required" makes the authenticator perform a real user check
        // (fingerprint / Face ID / Windows Hello / device PIN) during
        // registration, so an unlocked laptop cannot silently add a passkey.
        userVerification: 'required',
      },
      excludeCredentials: existing.map((cred) => ({
        id: cred.credentialId,
        ...(cred.transports?.length ? { transports: cred.transports } : {}),
      })),
    });

    const challengeId = cryptoRandomHandle();
    // Persist the exact challenge shipped to the browser, not a fresh one.
    await this.challengeStore.issue(challengeId, 'registration', String(user._id), options.challenge);

    logger.debug('[WebAuthn] registration options issued', {
      userId: String(user._id),
      existingCredentials: existing.length,
      deviceName: sanitizeDeviceName(deviceName),
    });

    return { challengeId, options };
  }

  /**
   * Verifies a registration response and persists the credential.
   * `user` comes from the authenticated session, so a client can never attach
   * a credential to a different account.
   */
  async completeRegistration(
    user: IUser,
    challengeId: string,
    body: RegistrationResponseJSON,
    deviceName?: unknown
  ): Promise<{ credential: IWebAuthnCredential }> {
    const pending = await this.requireChallenge(challengeId, 'registration');
    if (pending.userId && pending.userId !== String(user._id)) {
      throw new ApiError(403, 'WEBAUTHN_CHALLENGE_OWNER_MISMATCH', 'This registration request does not belong to the current session.');
    }

    const response = body as RegistrationResponseJSON;

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: pending.challenge,
        expectedOrigin: getWebAuthnOrigins(),
        expectedRPID: env.WEBAUTHN_RP_ID,
        requireUserVerification: true,
        requireUserPresence: true,
      });
    } catch (err) {
      throw toSafeVerificationError(err, 'registration');
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new ApiError(400, 'WEBAUTHN_VERIFICATION_FAILED', 'Biometric authentication could not be verified. Please try again.');
    }

    const { registrationInfo } = verification;
    if (!registrationInfo.userVerified) {
      throw new ApiError(400, 'WEBAUTHN_USER_VERIFICATION_FAILED', 'Biometric verification did not succeed. Please try again.');
    }

    const credentialId = registrationInfo.credential.id;
    const existing = await this.credentialRepository.findByCredentialId(credentialId);
    if (existing) {
      throw new ApiError(409, 'WEBAUTHN_CREDENTIAL_EXISTS', 'This device is already registered for biometric sign-in.');
    }

    const cleanDeviceName = sanitizeDeviceName(deviceName);

    const credential = await this.credentialRepository.create({
      userId: String(user._id),
      credentialId,
      publicKey: Buffer.from(registrationInfo.credential.publicKey),
      counter: registrationInfo.credential.counter,
      credentialType: registrationInfo.credentialType,
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      transports: registrationInfo.credential.transports ?? [],
      aaguid: registrationInfo.aaguid,
      attestationFormat: registrationInfo.fmt,
      deviceName: cleanDeviceName,
    });

    await auditLogRepository.log({
      userId: user._id,
      action: 'PASSKEY_REGISTERED',
      metadata: { deviceType: registrationInfo.credentialDeviceType, backedUp: registrationInfo.credentialBackedUp },
    });

    logger.info('[WebAuthn] credential registered', { userId: String(user._id) });

    return { credential };
  }

  /**
   * Login ceremony options. `allowCredentials` is intentionally left empty so
   * the browser offers any passkey saved for this site (including synced
   * passkeys) and the user is identified only after the assertion verifies.
   */
  async generateAuthenticationOptionsFor(): Promise<{
    challengeId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }> {
    const options = await generateAuthenticationOptions({
      rpID: env.WEBAUTHN_RP_ID,
      userVerification: 'required',
    });

    const challengeId = cryptoRandomHandle();
    await this.challengeStore.issue(challengeId, 'authentication', undefined, options.challenge);

    return { challengeId, options };
  }

  /**
   * Verifies an assertion and returns the account it belongs to. The user is
   * resolved from the STORED credential, never from the request body.
   */
  async verifyAuthentication(
    challengeId: string,
    body: AuthenticationResponseJSON
  ): Promise<{ credential: IWebAuthnCredential }> {
    const pending = await this.requireChallenge(challengeId, 'authentication');
    const response = body;

    const credentialId = response?.id;
    if (!credentialId || typeof credentialId !== 'string') {
      throw new ApiError(400, 'WEBAUTHN_CREDENTIAL_ID_MISSING', 'Biometric sign-in response did not include a credential.');
    }

    const credential = await this.credentialRepository.findByCredentialId(credentialId);
    if (!credential) {
      throw new ApiError(401, 'WEBAUTHN_CREDENTIAL_NOT_FOUND', 'This device is not registered for biometric sign-in. Please use Google Login.');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: pending.challenge,
        expectedOrigin: getWebAuthnOrigins(),
        expectedRPID: env.WEBAUTHN_RP_ID,
        requireUserVerification: true,
        credential: {
          id: credential.credentialId,
          publicKey: toPublicKeyBytes(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports,
        },
      });
    } catch (err) {
      throw toSafeVerificationError(err, 'authentication');
    }

    if (!verification.verified) {
      throw new ApiError(401, 'WEBAUTHN_VERIFICATION_FAILED', 'Biometric sign-in could not be verified. Please try again.');
    }
    if (!verification.authenticationInfo.userVerified) {
      throw new ApiError(401, 'WEBAUTHN_USER_VERIFICATION_FAILED', 'Biometric verification did not succeed. Please try again.');
    }

    // Signature counter regression signals a cloned authenticator replaying a
    // previously captured assertion. Zero counters mean the authenticator does
    // not implement a counter, which is normal for synced passkeys.
    const { newCounter } = verification.authenticationInfo;
    if (credential.counter > 0 || newCounter > 0) {
      if (newCounter <= credential.counter) {
        throw new ApiError(401, 'WEBAUTHN_COUNTER_REGRESSION', 'Biometric sign-in was rejected for security reasons. Please remove and re-add this device.');
      }
    }

    await this.credentialRepository.updateAfterAuthentication(
      credential.credentialId,
      newCounter,
      new Date()
    );

    credential.counter = newCounter;
    credential.lastUsedAt = new Date();

    return { credential };
  }

  /**
   * Issues the application's normal session (JWT pair) for a verified passkey
   * holder, reusing the exact session/JWT path Google Login uses.
   */
  async loginWithPasskey(
    credential: IWebAuthnCredential,
    clientMeta: ClientMetadata
  ): Promise<{ user: Partial<IUser>; tokens: AuthTokens; sessionId: string }> {
    const user = await userRepository.findById(String(credential.userId));
    if (!user) {
      throw new ApiError(401, 'WEBAUTHN_USER_NOT_FOUND', 'Biometric sign-in could not be completed for this account.');
    }

    const result = await authService.issueSessionForUser(user, clientMeta, 'webauthn');

    return result;
  }

  async listCredentials(userId: string): Promise<CredentialSummary[]> {
    const credentials = await this.credentialRepository.findByUserId(userId);
    return credentials.map((cred) => toSummary(cred));
  }

  /**
   * Public, identity-free probe used by the login page to decide whether to
   * render the passkey button at all.
   */
  async hasAnyCredentials(): Promise<boolean> {
    return (await this.credentialRepository.countAll()) > 0;
  }

  /**
   * Removes a credential. The delete is scoped to `userId`, so a request for
   * another account's credential ID reports "not found" rather than deleting it.
   */
  async removeCredential(userId: string, credentialId: string, clientMeta: ClientMetadata): Promise<void> {
    const removed = await this.credentialRepository.deleteOwned(userId, credentialId);
    if (!removed) {
      throw new ApiError(404, 'WEBAUTHN_CREDENTIAL_NOT_FOUND', 'Biometric credential not found.');
    }

    await auditLogRepository.log({
      userId,
      action: 'PASSKEY_REMOVED',
      ipAddress: clientMeta.ipAddress,
      userAgent: clientMeta.userAgent,
    });
  }

  private async requireChallenge(
    challengeId: string,
    type: StoredChallenge['type']
  ): Promise<StoredChallenge> {
    if (!challengeId || typeof challengeId !== 'string') {
      throw new ApiError(400, 'WEBAUTHN_CHALLENGE_MISSING', 'Biometric request is missing or invalid. Please try again.');
    }

    const pending = await this.challengeStore.consume(challengeId);
    if (!pending) {
      throw new ApiError(400, 'WEBAUTHN_CHALLENGE_EXPIRED', 'This biometric request expired. Please try again.');
    }
    if (pending.type !== type) {
      throw new ApiError(400, 'WEBAUTHN_CHALLENGE_TYPE_MISMATCH', 'This biometric request does not match the requested operation.');
    }
    return pending;
  }
}

function cryptoRandomHandle(): string {
  // Random handle used to key the server-side challenge record. It is not a
  // secret and carries no identity meaning.
  return crypto.randomBytes(16).toString('hex');
}

function toSummary(cred: IWebAuthnCredential): CredentialSummary {
  return {
    id: cred.credentialId,
    deviceName: cred.deviceName || describeDevice(cred),
    deviceType: cred.deviceType,
    backedUp: cred.backedUp,
    transports: cred.transports ?? [],
    aaguid: cred.aaguid,
    createdAt: new Date(cred.createdAt).toISOString(),
    lastUsedAt: cred.lastUsedAt ? new Date(cred.lastUsedAt).toISOString() : null,
  };
}

/** Fallback label when the user did not name the device at registration. */
function describeDevice(cred: IWebAuthnCredential): string {
  const base = cred.backedUp ? 'Synced passkey' : cred.deviceType === 'multiDevice' ? 'Passkey' : 'Device passkey';
  const transports = cred.transports ?? [];
  if (transports.includes('hybrid')) return `${base} (phone / QR)`;
  if (transports.includes('nfc')) return `${base} (NFC)`;
  if (transports.includes('usb')) return `${base} (USB security key)`;
  if (transports.includes('internal')) return 'This device';
  return base;
}

export const webAuthnService = new WebAuthnService();
