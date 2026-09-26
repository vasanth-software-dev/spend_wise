import { Router } from 'express';
import { reportController } from '../controllers/ReportController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => reportController.getReport(req, res, next));

export default router;
