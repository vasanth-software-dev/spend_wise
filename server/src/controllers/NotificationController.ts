import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { notificationRepository } from '../repositories/NotificationRepository.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class NotificationController {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const [notifications, unreadCount] = await Promise.all([
        notificationRepository.findByUserId(userId, 50),
        notificationRepository.getUnreadCount(userId),
      ]);
      sendSuccess(res, { notifications, unreadCount });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const notification = await notificationRepository.markAsRead(id, userId);
      sendSuccess(res, { notification });
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const count = await notificationRepository.markAllAsRead(userId);
      sendSuccess(res, { updatedCount: count }, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  }
}

export const notificationController = new NotificationController();
