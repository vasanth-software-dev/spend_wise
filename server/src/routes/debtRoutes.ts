import { Router } from 'express';
import { debtController } from '../controllers/DebtController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  createDebtSchema,
  updateDebtSchema,
  recordPaymentSchema,
} from '../validators/debtValidators.js';

const router = Router();

router.use(requireAuth);

// Summary must be declared before /:id to avoid param capture
router.get('/summary', (req, res, next) => debtController.getSummary(req, res, next));
router.get('/', (req, res, next) => debtController.getAll(req, res, next));
router.post('/', validate(createDebtSchema), (req, res, next) => debtController.create(req, res, next));
router.get('/:id', (req, res, next) => debtController.getById(req, res, next));
router.patch('/:id', validate(updateDebtSchema), (req, res, next) => debtController.update(req, res, next));
router.put('/:id', validate(updateDebtSchema), (req, res, next) => debtController.update(req, res, next));
router.delete('/:id', (req, res, next) => debtController.delete(req, res, next));

// Payment sub-routes
router.post('/:id/payments', validate(recordPaymentSchema), (req, res, next) => debtController.recordPayment(req, res, next));
router.delete('/:id/payments/:paymentId', (req, res, next) => debtController.deletePayment(req, res, next));

export default router;