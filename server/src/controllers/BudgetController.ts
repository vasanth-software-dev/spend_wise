import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { budgetService } from '../services/BudgetService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class BudgetController {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const budgets = await budgetService.getBudgets(userId);
      sendSuccess(res, { budgets });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const budget = await budgetService.createBudget(userId, req.body);
      sendSuccess(res, { budget }, 'Budget established successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const budget = await budgetService.updateBudget(id, userId, req.body);
      if (!budget) {
        sendError(res, 'Budget not found or unauthorized', 404);
        return;
      }
      sendSuccess(res, { budget }, 'Budget updated');
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const deleted = await budgetService.deleteBudget(id, userId);
      if (!deleted) {
        sendError(res, 'Budget not found or unauthorized', 404);
        return;
      }
      sendSuccess(res, null, 'Budget deleted');
    } catch (err) {
      next(err);
    }
  }
}

export const budgetController = new BudgetController();
