import jwt, { SignOptions } from 'jsonwebtoken';
import { CookieOptions } from 'express';
import { env } from '../config/env.js';
import { UserSessionPayload } from '../types/index.js';

export function generateAccessToken(payload: UserSessionPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRY as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function generateRefreshToken(payload: UserSessionPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRY as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): UserSessionPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as UserSessionPayload;
}

export function verifyRefreshToken(token: string): UserSessionPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as UserSessionPayload;
}

export const REFRESH_COOKIE_NAME = 'spendwise_refresh_token';

export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const clearCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/v1/auth',
};

/**
 * Cookie options aware of ngrok/https.
 * If the incoming request is https (ngrok sends x-forwarded-proto=https,
 * or PUBLIC_API_URL is https), use Secure + SameSite=None so the
 * cross-origin frontend (other ngrok URL) can receive the refresh cookie.
 * Otherwise fall back to the default Lax cookie for localhost dev.
 */
export function getRefreshCookieOptions(req?: { headers?: Record<string, unknown>; secure?: boolean }): CookieOptions {
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] ?? '').toLowerCase();
  const isHttps = forwardedProto.includes('https') || req?.secure === true;
  const publicIsHttps = (env.PUBLIC_API_URL ?? '').startsWith('https://');
  if (isHttps || publicIsHttps || env.NODE_ENV === 'production') {
    return { ...refreshCookieOptions, secure: true, sameSite: 'none' };
  }
  return refreshCookieOptions;
}
