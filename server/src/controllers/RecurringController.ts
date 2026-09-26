import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { recurringService } from '../services/RecurringService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class RecurringController {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const recurring = await recurringService.getAll(userId);
      sendSuccess(res, { recurring });
    } catch (err) {
      next(err);
    }
  }

  async getUpcoming(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const upcoming = await recurringService.getUpcoming(userId, 5);
      sendSuccess(res, { upcoming });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const item = await recurringService.create(userId, req.body);
      sendSuccess(res, { recurring: item }, 'Recurring transaction set up', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const item = await recurringService.update(id, userId, req.body);
      if (!item) {
        sendError(res, 'Item not found or unauthorized', 404);
        return;
      }
      sendSuccess(res, { recurring: item }, 'Recurring transaction updated');
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const deleted = await recurringService.delete(id, userId);
      if (!deleted) {
        sendError(res, 'Item not found or unauthorized', 404);
        return;
      }
      sendSuccess(res, null, 'Recurring transaction removed');
    } catch (err) {
      next(err);
    }
  }
}

export const recurringController = new RecurringController();
