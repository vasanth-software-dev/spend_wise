import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { reportService } from '../services/ReportService.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class ReportController {
  async getReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { startDate, endDate } = req.query;

      const now = new Date();
      const start = startDate ? new Date(startDate as string) : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = endDate ? new Date(endDate as string) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const report = await reportService.generateComprehensiveReport(userId, start, end);
      sendSuccess(res, report);
    } catch (err) {
      next(err);
    }
  }
}

export const reportController = new ReportController();
