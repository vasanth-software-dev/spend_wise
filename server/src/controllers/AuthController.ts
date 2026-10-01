import { Request, Response, NextFunction } from 'express';
import { authService, ClientMetadata } from '../services/AuthService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { REFRESH_COOKIE_NAME, refreshCookieOptions, clearCookieOptions, getRefreshCookieOptions } from '../utils/jwt.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { GoogleSocialiteProvider, resolveAuthRedirectUri } from '../providers/social/GoogleSocialiteProvider.js';
import { env } from '../config/env.js';

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

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientMeta = extractClientMeta(req);
      const { user, tokens, sessionId } = await authService.register(req.body, clientMeta);

      res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions);

      sendSuccess(res, { user, accessToken: tokens.accessToken, sessionId }, 'Registration successful', 201);
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const clientMeta = extractClientMeta(req);
      const { user, tokens, sessionId } = await authService.login(email, password, clientMeta);

      res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions);

      sendSuccess(res, { user, accessToken: tokens.accessToken, sessionId }, 'Login successful');
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
      if (!refreshToken) {
        sendError(res, 'No refresh token provided in cookie', 401, 'NO_REFRESH_TOKEN');
        return;
      }

      const clientMeta = extractClientMeta(req);
      const { tokens, sessionId, user } = await authService.refreshTokens(refreshToken, clientMeta);

      res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions);

      sendSuccess(res, { user, accessToken: tokens.accessToken, sessionId }, 'Token refreshed');
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions);
      next(err);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.user?.sessionId;
      const userId = req.user?.userId;
      const ipAddress = req.ip;

      await authService.logout(sessionId, userId, ipAddress);
      res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions);

      sendSuccess(res, null, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }
      const user = await authService.getCurrentUser(req.user.userId);
      sendSuccess(res, { user });
    } catch (err) {
      next(err);
    }
  }

  async getSessions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }
      const sessions = await authService.getSessions(req.user.userId);
      sendSuccess(res, { sessions, currentSessionId: req.user.sessionId });
    } catch (err) {
      next(err);
    }
  }

  async revokeSession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }
      const { sessionId } = req.params;
      await authService.revokeSession(req.user.userId, sessionId);
      sendSuccess(res, null, 'Session revoked');
    } catch (err) {
      next(err);
    }
  }

  async logoutAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }
      const count = await authService.logoutAllSessions(req.user.userId, req.user.sessionId);
      sendSuccess(res, { revokedCount: count }, 'All other sessions have been logged out');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Socialite Google Login: Initiate OAuth authorization URL or redirect.
   */
  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!GoogleSocialiteProvider.isConfigured()) {
        sendError(
          res,
          'Google OAuth credentials are not configured on the server. Please check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET or use Demo Google Login.',
          400,
          'GOOGLE_NOT_CONFIGURED'
        );
        return;
      }

      const redirectUri = resolveAuthRedirectUri(req.query.redirect_uri as string | undefined);
      const statePayload = {
        flow: 'social_login',
        ts: Date.now(),
        clientRedirect: (req.query.client_redirect as string) || `${env.CLIENT_URL}/dashboard`,
      };
      const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');
      const includeGmail = req.query.include_gmail === 'true';
      const authUrl = GoogleSocialiteProvider.getAuthorizationUrl(state, redirectUri, includeGmail);

      if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
        sendSuccess(res, { authUrl });
      } else {
        res.redirect(authUrl);
      }
    } catch (err) {
      next(err);
    }
  }

  /**
   * Socialite Google Login Callback: Handle authorization code from Google.
   */
  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, error } = req.query;

      if (error) {
        console.error('Google OAuth callback error reported by Google:', error);
        res.redirect(`${env.CLIENT_URL}/login?error=${encodeURIComponent(String(error))}`);
        return;
      }

      if (!code) {
        res.redirect(`${env.CLIENT_URL}/login?error=missing_oauth_code`);
        return;
      }

      const clientMeta = extractClientMeta(req);
      const { profile, tokens } = await GoogleSocialiteProvider.exchangeCode(code as string);

      const authResult = await authService.handleGoogleAuth(profile, clientMeta, tokens);

      // When behind ngrok (https), the refresh cookie must be Secure + SameSite=None
      // so the cross-site redirect (backend ngrok -> frontend ngrok) can set it.
      res.cookie(REFRESH_COOKIE_NAME, authResult.tokens.refreshToken, getRefreshCookieOptions(req));

      res.redirect(
        `${env.CLIENT_URL}/auth/callback?token=${encodeURIComponent(authResult.tokens.accessToken)}&status=success`
      );
    } catch (err: any) {
      console.error('Failed to handle Google OAuth callback:', err);
      res.redirect(
        `${env.CLIENT_URL}/login?error=${encodeURIComponent(err.message || 'google_auth_failed')}`
      );
    }
  }

  /**
   * One-click Google Sign-In for Development / Demo testing.
   */
  async googleDevLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientMeta = extractClientMeta(req);
      const { user, tokens, sessionId } = await authService.handleGoogleDevLogin(req.body, clientMeta);

      res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions);

      sendSuccess(
        res,
        { user, accessToken: tokens.accessToken, sessionId },
        'Signed in successfully with Google'
      );
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
