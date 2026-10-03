import { Request, Response, NextFunction } from 'express';
import { webAuthnService } from '../services/WebAuthnService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { REFRESH_COOKIE_NAME, getRefreshCookieOptions } from '../utils/jwt.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { userRepository } from '../repositories/UserRepository.js';
import { ClientMetadata } from '../services/AuthService.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';

function extractClientMeta(req: Request): ClientMetadata {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '127.0.0.1';

  let browser = 'Browser';
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  let device = 'Desktop';
  if (/mobile|iphone|android/i.test(userAgent)) device = 'Mobile';
  else if (/ipad|tablet/i.test(userAgent)) device = 'Tablet';

  let os = 'OS';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Macintosh')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone')) os = 'iOS';

  return { userAgent, ipAddress, browser, device, os };
}

/**
 * WebAuthn / passkey endpoints.
 *
 * Registration and credential management require a valid access token. The
 * user is ALWAYS resolved from that verified JWT — no endpoint accepts a user
 * id from the client, so a credential can never be attached to another
 * account.
 */
export class WebAuthnController {
  /**
   * POST /api/v1/auth/webauthn/register/options
   * Returns WebAuthn creation options plus a `challengeId` referencing the
   * server-held challenge. The challenge is short-lived and single-use.
   */
  async registerOptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      
      const userId = this.requireUserId(req);
      const user = await userRepository.findById(userId);
      if (!user) {
        console.error('User not found for WebAuthn registration options:', userId);
        throw ApiError.unauthorized('UNAUTHORIZED', 'Authentication required. No access token provided.');
      }

      const { challengeId, options } = await webAuthnService.generateRegistrationOptionsFor(
        user,
        req.body?.deviceName
      );

      console.error('[WebAuthn] registration options generated', { userId, challengeId });

      sendSuccess(res, { challengeId, options }, 'Registration options generated');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/webauthn/register/verify
   * Verifies the attestation and stores the credential against the session user.
   */
  async registerVerify(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.requireUserId(req);
      const user = await userRepository.findById(userId);
      if (!user) {
        throw ApiError.unauthorized('UNAUTHORIZED', 'Authentication required. No access token provided.');
      }

      const { challengeId, credential: response, deviceName } = req.body ?? {};
      // `credential` holds the WebAuthn response; the user comes from the JWT.
      const { credential } = await webAuthnService.completeRegistration(
        user,
        challengeId,
        response ?? {},
        deviceName
      );

      sendSuccess(
        res,
        {
          credential: {
            id: credential.credentialId,
            deviceName: credential.deviceName,
            deviceType: credential.deviceType,
            createdAt: new Date(credential.createdAt).toISOString(),
          },
        },
        'Biometric authentication enabled successfully.',
        201
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/webauthn/login/options
   * Public: the user is not yet authenticated. Returns a request challenge so
   * the browser can offer a saved passkey.
   */
  async loginOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { challengeId, options } = await webAuthnService.generateAuthenticationOptionsFor();
      sendSuccess(res, { challengeId, options }, 'Authentication options generated');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/webauthn/login/verify
   * Verifies the assertion, then issues the application's normal JWT pair and
   * HttpOnly refresh cookie — exactly as Google Login does.
   */
  async loginVerify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { challengeId, credential: response } = req.body ?? {};

      const { credential } = await webAuthnService.verifyAuthentication(challengeId, response ?? {});

      const clientMeta = extractClientMeta(req);
      const { user, tokens, sessionId } = await webAuthnService.loginWithPasskey(credential, clientMeta);

      // Same cookie mechanism as the other login flows: HttpOnly, and
      // Secure + SameSite=None when served over https (tunnel / production).
      res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, getRefreshCookieOptions(req));

      sendSuccess(res, { user, accessToken: tokens.accessToken, sessionId }, 'Login successful');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/webauthn/credentials
   * Lists the authenticated user's own registered devices.
   */
  async listCredentials(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.requireUserId(req);
      const credentials = await webAuthnService.listCredentials(userId);
      sendSuccess(res, { credentials });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/auth/webauthn/credentials/:credentialId
   * Ownership-scoped removal. Requires an authenticated session; a foreign
   * credential id yields 404 and is never deleted.
   */
  async removeCredential(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.requireUserId(req);
      const { credentialId } = req.params;

      await webAuthnService.removeCredential(userId, credentialId, extractClientMeta(req));
      logger.info('[WebAuthn] credential removed', { userId });

      sendSuccess(res, null, 'Biometric authentication removed successfully.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/webauthn/status
   * Cheap public probe so the login page only offers the passkey button when
   * at least one credential exists. Reveals nothing about who owns it.
   */
  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hasCredentials = await webAuthnService.hasAnyCredentials();
      sendSuccess(res, { available: true, hasCredentials });
    } catch (err) {
      next(err);
    }
  }

  private requireUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('UNAUTHORIZED', 'Authentication required. No access token provided.');
    }
    return userId;
  }
}

export const webAuthnController = new WebAuthnController();
