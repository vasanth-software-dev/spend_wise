import { Router } from 'express';
import { transactionController } from '../controllers/TransactionController.js';
import { personController } from '../controllers/PersonController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { createTransactionSchema, updateTransactionSchema } from '../validators/transactionValidators.js';

const router = Router();

router.use(requireAuth);

router.get('/dashboard', (req, res, next) => transactionController.getDashboard(req, res, next));
router.get('/export', (req, res, next) => transactionController.exportCSV(req, res, next));
router.post('/import', (req, res, next) => transactionController.importCSV(req, res, next));
router.post('/bulk-delete', (req, res, next) => transactionController.bulkDelete(req, res, next));
router.post('/bulk-categorize', (req, res, next) => transactionController.bulkCategorize(req, res, next));

router.get('/', (req, res, next) => transactionController.getAll(req, res, next));
router.post('/', validate(createTransactionSchema), (req, res, next) => transactionController.create(req, res, next));
router.patch('/:id/person', (req, res, next) => personController.assignTransaction(req, res, next));

router.get('/:id', (req, res, next) => transactionController.getById(req, res, next));
router.patch('/:id', validate(updateTransactionSchema), (req, res, next) => transactionController.update(req, res, next));
router.delete('/:id', (req, res, next) => transactionController.delete(req, res, next));

export default router;
