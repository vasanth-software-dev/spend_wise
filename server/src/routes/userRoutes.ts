import { Router } from 'express';
import { userController } from '../controllers/UserController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.patch('/profile', (req, res, next) => userController.updateProfile(req, res, next));
router.delete('/account', (req, res, next) => userController.deleteAccount(req, res, next));

export default router;
