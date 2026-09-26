import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { detectedTransactionService } from '../services/DetectedTransactionService.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class DetectedTransactionController {
  async getPending(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const detected = await detectedTransactionService.getPending(userId);
      sendSuccess(res, { detectedTransactions: detected });
    } catch (err) {
      next(err);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const status = req.query.status as string;
      const detected = await detectedTransactionService.getAll(userId, status);
      sendSuccess(res, { detectedTransactions: detected });
    } catch (err) {
      next(err);
    }
  }

  async confirm(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const transaction = await detectedTransactionService.confirm(userId, id, req.body);
      sendSuccess(res, { transaction }, 'Transaction confirmed and added to your ledger', 201);
    } catch (err) {
      next(err);
    }
  }

  async reject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      await detectedTransactionService.reject(userId, id);
      sendSuccess(res, null, 'Detected transaction ignored');
    } catch (err) {
      next(err);
    }
  }

  async markDuplicate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      await detectedTransactionService.markDuplicate(userId, id);
      sendSuccess(res, null, 'Transaction marked as duplicate');
    } catch (err) {
      next(err);
    }
  }
}

export const detectedTransactionController = new DetectedTransactionController();
