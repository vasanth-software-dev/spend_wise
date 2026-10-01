import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { goalService } from '../services/GoalService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class GoalController {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const goals = await goalService.getGoals(req.user!.userId);
      sendSuccess(res, { goals });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const goal = await goalService.getGoalById(req.params.id, req.user!.userId);
      if (!goal) {
        sendError(res, 'Goal not found or unauthorized', 404, 'NOT_FOUND');
        return;
      }
      sendSuccess(res, { goal });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const goal = await goalService.create(req.user!.userId, req.body);
      sendSuccess(res, { goal }, 'Goal created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const goal = await goalService.update(req.params.id, req.user!.userId, req.body);
      if (!goal) {
        sendError(res, 'Goal not found or unauthorized', 404, 'NOT_FOUND');
        return;
      }
      sendSuccess(res, { goal }, 'Goal updated');
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await goalService.delete(req.params.id, req.user!.userId);
      if (!deleted) {
        sendError(res, 'Goal not found or unauthorized', 404, 'NOT_FOUND');
        return;
      }
      sendSuccess(res, null, 'Goal deleted');
    } catch (err) {
      next(err);
    }
  }

  async addContribution(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await goalService.addContribution(
        req.params.id,
        req.user!.userId,
        req.body
      );
      if (!result) {
        sendError(res, 'Goal not found or unauthorized', 404, 'NOT_FOUND');
        return;
      }
      sendSuccess(res, { goal: result.goal, contribution: result.contribution }, 'Contribution added');
    } catch (err) {
      next(err);
    }
  }

  async deleteContribution(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await goalService.removeContribution(
        req.params.id,
        req.user!.userId,
        req.params.contributionId
      );
      if (!result) {
        sendError(res, 'Contribution not found or unauthorized', 404, 'NOT_FOUND');
        return;
      }
      sendSuccess(res, { goal: result.goal }, 'Contribution removed');
    } catch (err) {
      next(err);
    }
  }
}

export const goalController = new GoalController();
