import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { calendarService } from '../services/CalendarService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class CalendarController {
  async getMonth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      const data = await calendarService.getMonth(req.user!.userId, year, month);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getDay(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await calendarService.getDay(req.user!.userId, req.query.date as string);
      if (!data) {
        sendError(res, 'A valid date is required', 400, 'INVALID_DATE');
        return;
      }
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getUpcoming(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = req.query.days ? Number(req.query.days) : 30;
      const data = await calendarService.getUpcoming(req.user!.userId, days);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  }
}

export const calendarController = new CalendarController();
