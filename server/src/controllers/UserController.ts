import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { userService } from '../services/UserService.js';
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from '../utils/jwt.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class UserController {
  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { name, currency, timezone, avatar } = req.body;
      const user = await userService.updateProfile(userId, { name, currency, timezone, avatar });
      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }
      sendSuccess(res, { user }, 'Profile updated');
    } catch (err) {
      next(err);
    }
  }

  async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      await userService.deleteAccount(userId);
      res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
      sendSuccess(res, null, 'Account and all associated financial data have been permanently deleted');
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();
