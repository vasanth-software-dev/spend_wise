import { Router } from 'express';
import { authController } from '../controllers/AuthController.js';
import webauthnRoutes from './webauthnRoutes.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema } from '../validators/authValidators.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), (req, res, next) => authController.register(req, res, next));
router.post('/login', authLimiter, validate(loginSchema), (req, res, next) => authController.login(req, res, next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', requireAuth, (req, res, next) => authController.logout(req, res, next));
router.get('/me', requireAuth, (req, res, next) => authController.me(req, res, next));

// Google Socialite OAuth Endpoints
router.get('/google', (req, res, next) => authController.googleAuth(req, res, next));
router.get('/google/callback', (req, res, next) => authController.googleCallback(req, res, next));
router.post('/google/dev-login', (req, res, next) => authController.googleDevLogin(req, res, next));

// WebAuthn / Passkey (biometric) authentication.
// Additional unlock method layered on top of the existing JWT session; it does
// not replace Google Login.
router.use('/webauthn', webauthnRoutes);

// Session Management (Requirement 10)
router.get('/sessions', requireAuth, (req, res, next) => authController.getSessions(req, res, next));
router.delete('/sessions/:sessionId', requireAuth, (req, res, next) => authController.revokeSession(req, res, next));
router.post('/sessions/logout-all', requireAuth, (req, res, next) => authController.logoutAll(req, res, next));

export default router;
