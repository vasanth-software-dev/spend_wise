import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { debtService } from '../services/DebtService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class DebtController {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const debts = await debtService.getDebts(userId);
      sendSuccess(res, { debts });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const debt = await debtService.getDebtById(id, userId);
      if (!debt) {
        sendError(res, 'Debt not found or unauthorized', 404, 'NOT_FOUND');
        return;
      }
      sendSuccess(res, { debt });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const debt = await debtService.createDebt(userId, req.body);
      sendSuccess(res, { debt }, 'Debt recorded successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const debt = await debtService.updateDebt(id, userId, req.body);
      if (!debt) {
        sendError(res, 'Debt not found or unauthorized', 404, 'NOT_FOUND');
        return;
      }
      sendSuccess(res, { debt }, 'Debt updated successfully');
    } catch (err: any) {
      if (err?.message === 'AMOUNT_BELOW_PAID') {
        sendError(
          res,
          'Original amount cannot be less than the amount already paid. Delete or adjust payments first.',
          400,
          'AMOUNT_BELOW_PAID'
        );
        return;
      }
      next(err);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const deleted = await debtService.deleteDebt(id, userId);
      if (!deleted) {
        sendError(res, 'Debt not found or unauthorized', 404, 'NOT_FOUND');
        return;
      }
      sendSuccess(res, null, 'Debt deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const summary = await debtService.getDashboardSummary(userId);
      sendSuccess(res, { summary });
    } catch (err) {
      next(err);
    }
  }

  async recordPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const result = await debtService.recordPayment(id, userId, req.body);
      const settled = result.debt.remainingAmount === 0;
      sendSuccess(
        res,
        { payment: result.payment, debt: result.debt },
        settled ? 'Payment recorded — debt settled!' : 'Payment recorded successfully',
        201
      );
    } catch (err: any) {
      if (err?.message === 'DEBT_NOT_FOUND') {
        sendError(res, 'Debt not found or unauthorized', 404, 'NOT_FOUND');
        return;
      }
      if (err?.message === 'PAYMENT_EXCEEDS_REMAINING') {
        sendError(res, 'Payment amount cannot exceed the remaining balance', 400, 'PAYMENT_EXCEEDS_REMAINING');
        return;
      }
      if (err?.message === 'INVALID_PAYMENT_AMOUNT') {
        sendError(res, 'Payment amount must be greater than 0', 400, 'INVALID_PAYMENT_AMOUNT');
        return;
      }
      next(err);
    }
  }

  async deletePayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id, paymentId } = req.params;
      const debt = await debtService.deletePayment(paymentId, id, userId);
      if (!debt) {
        sendError(res, 'Payment or debt not found', 404, 'NOT_FOUND');
        return;
      }
      sendSuccess(res, { debt }, 'Payment removed');
    } catch (err) {
      next(err);
    }
  }
}

export const debtController = new DebtController();
