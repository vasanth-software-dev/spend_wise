import { Router } from 'express';
import { detectedTransactionController } from '../controllers/DetectedTransactionController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/pending', (req, res, next) => detectedTransactionController.getPending(req, res, next));
router.get('/', (req, res, next) => detectedTransactionController.getAll(req, res, next));
router.post('/:id/confirm', (req, res, next) => detectedTransactionController.confirm(req, res, next));
router.patch('/:id', (req, res, next) => detectedTransactionController.update(req, res, next));
router.post('/:id/reject', (req, res, next) => detectedTransactionController.reject(req, res, next));
router.post('/:id/duplicate', (req, res, next) => detectedTransactionController.markDuplicate(req, res, next));

export default router;
