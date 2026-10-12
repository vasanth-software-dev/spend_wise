import { Router } from 'express';
import multer from 'multer';
import { emailAccountController } from '../controllers/EmailAccountController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Configure multer for inbound multipart/form-data payloads (SendGrid Inbound Parse, Mailgun, etc.)
const upload = multer({
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
});

// Public callback endpoint for Google OAuth & Inbound Webhooks
router.get('/gmail/callback', (req, res, next) => emailAccountController.handleGmailCallback(req, res, next));
router.post(
  '/forwarding/inbound',
  upload.any(),
  (req, res, next) => emailAccountController.handleInboundWebhook(req, res, next)
);

// Authenticated routes
router.use(requireAuth);

router.get('/', (req, res, next) => emailAccountController.getAccounts(req, res, next));
router.post('/mock/connect', (req, res, next) => emailAccountController.connectMock(req, res, next));
router.post('/forwarding/setup', (req, res, next) => emailAccountController.setupForwarding(req, res, next));
router.post('/forwarding/simulate', (req, res, next) => emailAccountController.simulateInbound(req, res, next));
router.get('/gmail/auth-url', (req, res, next) => emailAccountController.getGmailAuthUrl(req, res, next));
router.post('/:id/sync', (req, res, next) => emailAccountController.sync(req, res, next));
router.post('/:id/pause', (req, res, next) => emailAccountController.pause(req, res, next));
router.post('/:id/resume', (req, res, next) => emailAccountController.resume(req, res, next));
router.delete('/:id', (req, res, next) => emailAccountController.remove(req, res, next));

export default router;
