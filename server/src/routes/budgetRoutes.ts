import { Router } from 'express';
import { budgetController } from '../controllers/BudgetController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { createBudgetSchema } from '../validators/budgetValidators.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => budgetController.getAll(req, res, next));
router.post('/', validate(createBudgetSchema), (req, res, next) => budgetController.create(req, res, next));
router.patch('/:id', (req, res, next) => budgetController.update(req, res, next));
router.delete('/:id', (req, res, next) => budgetController.delete(req, res, next));

export default router;
