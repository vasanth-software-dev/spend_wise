import { Router } from 'express';
import { personController } from '../controllers/PersonController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res, next) => personController.list(req, res, next));
router.post('/', (req, res, next) => personController.create(req, res, next));
router.get('/:id', (req, res, next) => personController.get(req, res, next));
router.put('/:id', (req, res, next) => personController.update(req, res, next));
router.patch('/:id', (req, res, next) => personController.update(req, res, next));
router.delete('/:id', (req, res, next) => personController.delete(req, res, next));

export default router;
