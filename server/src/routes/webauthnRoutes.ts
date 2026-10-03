import { Router } from 'express';
import { webAuthnController } from '../controllers/WebAuthnController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { webauthnAuthenticatedLimiter, webauthnLimiter } from '../middleware/rateLimiter.js';
import {
  webauthnCredentialIdParamSchema,
  webauthnLoginOptionsSchema,
  webauthnLoginVerifySchema,
  webauthnRegisterOptionsSchema,
  webauthnRegisterVerifySchema,
} from '../validators/webauthnValidators.js';

/**
 * WebAuthn / passkey routes, mounted under the existing auth router at
 * /api/v1/auth/webauthn.
 *
 * `requireAuth` is the same JWT middleware used by every other SpendWise
 * protected route, so passkey management inherits the existing 15-minute
 * access token model.
 */
const router = Router();

// --- Registration (authenticated: the credential is bound to the session user) ---
router.post(
  '/register/options',
  requireAuth,
  webauthnAuthenticatedLimiter,
  validate(webauthnRegisterOptionsSchema),
  (req, res, next) => webAuthnController.registerOptions(req, res, next)
);
router.post(
  '/register/verify',
  requireAuth,
  webauthnAuthenticatedLimiter,
  validate(webauthnRegisterVerifySchema),
  (req, res, next) => webAuthnController.registerVerify(req, res, next)
);

// --- Authentication (public: the user is identified BY the verified assertion) ---
router.post(
  '/login/options',
  webauthnLimiter,
  validate(webauthnLoginOptionsSchema),
  (req, res, next) => webAuthnController.loginOptions(req, res, next)
);
router.post(
  '/login/verify',
  webauthnLimiter,
  validate(webauthnLoginVerifySchema),
  (req, res, next) => webAuthnController.loginVerify(req, res, next)
);

// --- Public capability probe for the login page ---
router.get('/status', (req, res, next) => webAuthnController.status(req, res, next));

// --- Credential management (authenticated, ownership-scoped) ---
router.get('/credentials', requireAuth, (req, res, next) =>
  webAuthnController.listCredentials(req, res, next)
);
router.delete(
  '/credentials/:credentialId',
  requireAuth,
  webauthnAuthenticatedLimiter,
  validate(webauthnCredentialIdParamSchema),
  (req, res, next) => webAuthnController.removeCredential(req, res, next)
);

export default router;
