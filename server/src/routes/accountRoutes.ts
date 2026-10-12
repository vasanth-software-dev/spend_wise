import { Router } from 'express';
import { accountController } from '../controllers/AccountController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => accountController.getAll(req, res, next));
router.get('/net-worth', (req, res, next) => accountController.getNetWorth(req, res, next));
router.get('/:id', (req, res, next) => accountController.getById(req, res, next));
router.post('/', (req, res, next) => accountController.create(req, res, next));
router.patch('/:id', (req, res, next) => accountController.update(req, res, next));
router.delete('/:id', (req, res, next) => accountController.delete(req, res, next));

export default router;
