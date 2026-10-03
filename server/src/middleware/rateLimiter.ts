import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 mins for development/smooth experience
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 attempts per 15 mins for auth routes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login or registration attempts. Please try again after 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Passkey ceremonies are unauthenticated on the login side, so they get a
 * tighter budget than the general auth limiter. Successful ceremonies consume
 * two requests (options + verify), so 30/15min leaves plenty of headroom for
 * retries and a passwordless relogin per device while still blunting online
 * guessing against the assertion endpoint.
 */
export const webauthnLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many biometric sign-in attempts. Please try again after 15 minutes.',
    code: 'WEBAUTHN_RATE_LIMIT_EXCEEDED',
  },
});

/** Registration and credential removal require a valid session, so this is looser. */
export const webauthnAuthenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many biometric security changes. Please try again later.',
    code: 'WEBAUTHN_RATE_LIMIT_EXCEEDED',
  },
});
