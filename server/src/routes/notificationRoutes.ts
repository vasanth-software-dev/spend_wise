import { Router } from 'express';
import { notificationController } from '../controllers/NotificationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => notificationController.getAll(req, res, next));
router.patch('/:id/read', (req, res, next) => notificationController.markAsRead(req, res, next));
router.post('/read-all', (req, res, next) => notificationController.markAllAsRead(req, res, next));

export default router;
