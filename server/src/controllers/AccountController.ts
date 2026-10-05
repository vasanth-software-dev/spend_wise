import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { accountService } from '../services/AccountService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class AccountController {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const accounts = await accountService.getAll(userId);
      sendSuccess(res, { accounts });
    } catch (err) {
      next(err);
    }
  }

  async getNetWorth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const summary = await accountService.getNetWorth(userId);
      sendSuccess(res, { summary });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const account = await accountService.getById(id, userId);
      if (!account) {
        sendError(res, 'Account not found', 404);
        return;
      }
      sendSuccess(res, { account });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const account = await accountService.create(userId, req.body);
      sendSuccess(res, { account }, 'Account created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const account = await accountService.update(id, userId, req.body);
      if (!account) {
        sendError(res, 'Account not found', 404);
        return;
      }
      sendSuccess(res, { account }, 'Account updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const deleted = await accountService.delete(id, userId);
      if (!deleted) {
        sendError(res, 'Account not found', 404);
        return;
      }
      sendSuccess(res, null, 'Account deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const accountController = new AccountController();
