import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { detectedTransactionService } from '../services/DetectedTransactionService.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class DetectedTransactionController {
  async getPending(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 500;
      const detected = await detectedTransactionService.getPending(userId, limit);
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

  async confirmAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const items = req.body?.items as Array<{ id: string; categoryId?: string }> | undefined;
      const result = await detectedTransactionService.confirmAll(userId, items);
      sendSuccess(
        res,
        result,
        `Confirmed and added ${result.confirmedCount} transaction${result.confirmedCount === 1 ? '' : 's'} to your ledger`,
        200
      );
    } catch (err) {
      next(err);
    }
  }

  async rejectAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const ids = req.body?.ids as string[] | undefined;
      const count = await detectedTransactionService.rejectAll(userId, ids);
      sendSuccess(res, { count }, `Cleared ${count} detected transaction${count === 1 ? '' : 's'}`);
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

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const updated = await detectedTransactionService.update(userId, id, req.body);
      sendSuccess(res, { detectedTransaction: updated }, 'Detected transaction updated');
    } catch (err) {
      next(err);
    }
  }
}

export const detectedTransactionController = new DetectedTransactionController();
