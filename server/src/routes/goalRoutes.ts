import { Router } from 'express';
import { goalController } from '../controllers/GoalController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import {
  addContributionSchema,
  createGoalSchema,
  updateGoalSchema,
} from '../validators/goalValidators.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => goalController.getAll(req, res, next));
router.post('/', validate(createGoalSchema), (req, res, next) => goalController.create(req, res, next));
router.get('/:id', (req, res, next) => goalController.getById(req, res, next));
router.patch('/:id', validate(updateGoalSchema), (req, res, next) => goalController.update(req, res, next));
router.delete('/:id', (req, res, next) => goalController.delete(req, res, next));
router.post(
  '/:id/contributions',
  validate(addContributionSchema),
  (req, res, next) => goalController.addContribution(req, res, next)
);
router.delete(
  '/:id/contributions/:contributionId',
  (req, res, next) => goalController.deleteContribution(req, res, next)
);

export default router;
