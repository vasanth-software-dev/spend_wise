import { Router } from 'express';
import { debtCandidateController } from '../controllers/DebtCandidateController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { resolveDebtCandidateSchema } from '../validators/debtCandidateValidators.js';

const router = Router();

router.use(requireAuth);

router.get('/pending-count', (req, res, next) => debtCandidateController.getPendingCount(req, res, next));
router.get('/', (req, res, next) => debtCandidateController.getAll(req, res, next));
router.post('/ignore-all', (req, res, next) => debtCandidateController.ignoreAll(req, res, next));
router.post('/:id/resolve', validate(resolveDebtCandidateSchema), (req, res, next) =>
  debtCandidateController.accept(req, res, next)
);
router.post('/:id/ignore', (req, res, next) => debtCandidateController.ignore(req, res, next));

export default router;