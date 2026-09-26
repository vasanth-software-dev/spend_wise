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
