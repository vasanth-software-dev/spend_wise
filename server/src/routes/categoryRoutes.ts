import { Router } from 'express';
import { categoryController } from '../controllers/CategoryController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { createCategorySchema } from '../validators/budgetValidators.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => categoryController.getAll(req, res, next));
router.post('/', validate(createCategorySchema), (req, res, next) => categoryController.create(req, res, next));
router.patch('/:id', (req, res, next) => categoryController.update(req, res, next));
router.delete('/:id', (req, res, next) => categoryController.delete(req, res, next));

export default router;
