import { Router } from 'express';
import { recurringController } from '../controllers/RecurringController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { createRecurringSchema } from '../validators/budgetValidators.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => recurringController.getAll(req, res, next));
router.get('/upcoming', (req, res, next) => recurringController.getUpcoming(req, res, next));
router.post('/', validate(createRecurringSchema), (req, res, next) => recurringController.create(req, res, next));
router.patch('/:id', (req, res, next) => recurringController.update(req, res, next));
router.delete('/:id', (req, res, next) => recurringController.delete(req, res, next));

export default router;
