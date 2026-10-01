import { google } from 'googleapis';
import { env, getPublicApiBase } from '../../config/env.js';

export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  verifiedEmail: boolean;
}

/**
 * Resolve which redirect URI to use for Google OAuth.
 * - Explicit `redirectUri` param wins (allows ?redirect_uri= override).
 * - Else if PUBLIC_API_URL is set (ngrok), build
 *   `<PUBLIC_API_URL>/api/v1/auth/google/callback` so the exact
 *   ngrok https URL is sent to Google (must match Google Console entry).
 * - Else fall back to env GOOGLE_AUTH_REDIRECT_URI.
 */
export function resolveAuthRedirectUri(redirectUri?: string): string {
  if (redirectUri) return redirectUri;
  const publicBase = getPublicApiBase();
  if (publicBase) return `${publicBase}/api/v1/auth/google/callback`;
  return env.GOOGLE_AUTH_REDIRECT_URI || env.GOOGLE_REDIRECT_URI;
}

export class GoogleSocialiteProvider {
  /**
   * Check if Google OAuth credentials are configured.
   */
  static isConfigured(): boolean {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  }

  /**
   * Get an initialized OAuth2 client.
   */
  private static getOAuth2Client(redirectUri?: string) {
    const effectiveRedirectUri = resolveAuthRedirectUri(redirectUri);
    return new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      effectiveRedirectUri
    );
  }

  /**
   * Generate Google OAuth authorization URL for social login.
   */
  static getAuthorizationUrl(
    state?: string,
    redirectUri?: string,
    includeGmailSync: boolean = false
  ): string {
    const oauth2Client = this.getOAuth2Client(redirectUri);

    const scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    if (includeGmailSync) {
      scopes.push('https://www.googleapis.com/auth/gmail.readonly');
    }

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'select_account',
      scope: scopes,
      state: state || Buffer.from(JSON.stringify({ flow: 'social_login', ts: Date.now() })).toString('base64'),
    });
  }

  /**
   * Exchange OAuth authorization code for tokens and Google profile.
   */
  static async exchangeCode(code: string, redirectUri?: string) {
    const oauth2Client = this.getOAuth2Client(redirectUri);

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email) {
      throw new Error('Google account did not provide an email address.');
    }

    const profile: GoogleProfile = {
      id: userInfo.id || '',
      email: userInfo.email,
      name: userInfo.name || userInfo.email.split('@')[0],
      givenName: userInfo.given_name || undefined,
      familyName: userInfo.family_name || undefined,
      picture: userInfo.picture || undefined,
      verifiedEmail: Boolean(userInfo.verified_email),
    };

    return {
      profile,
      tokens,
    };
  }
}
