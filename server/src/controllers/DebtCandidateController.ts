import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { debtCandidateService } from '../services/DebtCandidateService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

function handleError(err: any, res: Response, next: NextFunction): void {
  switch (err?.message) {
    case 'CANDIDATE_NOT_FOUND':
      sendError(res, 'Debt candidate not found', 404, 'NOT_FOUND');
      return;
    case 'CANDIDATE_ALREADY_RESOLVED':
      sendError(res, 'This candidate was already reviewed', 409, 'ALREADY_RESOLVED');
      return;
    case 'DEBT_NOT_FOUND':
      sendError(res, 'Debt not found or unauthorized', 404, 'NOT_FOUND');
      return;
    case 'PAYMENT_EXCEEDS_REMAINING':
      sendError(res, 'Payment amount cannot exceed the remaining balance', 400, 'PAYMENT_EXCEEDS_REMAINING');
      return;
    case 'INVALID_AMOUNT':
    case 'INVALID_PAYMENT_AMOUNT':
      sendError(res, 'Amount must be greater than 0', 400, 'INVALID_AMOUNT');
      return;
    case 'PERSON_NOT_FOUND':
      sendError(res, 'Selected person was not found', 404, 'PERSON_NOT_FOUND');
      return;
    default:
      next(err);
  }
}

export class DebtCandidateController {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const candidates = await debtCandidateService.getCandidates(userId, req.query.status as string | undefined);
      sendSuccess(res, { candidates });
    } catch (err) {
      next(err);
    }
  }

  async getPendingCount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const count = await debtCandidateService.countPending(userId);
      sendSuccess(res, { count });
    } catch (err) {
      next(err);
    }
  }

  async accept(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const { debtId, amount, description, debtDate } = req.body || {};

      // Confirming as a repayment of an existing debt records a DebtPayment.
      // Confirming without a target debt creates a new Debt in the flow direction.
      if (debtId) {
        const result = await debtCandidateService.matchToExistingDebt(userId, id, { debtId, amount });
        const remaining = (result.debt as { remainingAmount?: number })?.remainingAmount ?? null;
        sendSuccess(
          res,
          { candidate: result.candidate, payment: result.payment, debt: result.debt },
          remaining === 0 ? 'Payment recorded — debt settled!' : 'Payment recorded against debt',
          201
        );
        return;
      }

      const result = await debtCandidateService.acceptAsNewDebt(userId, id, {
        amount,
        description,
        debtDate,
      });
      sendSuccess(res, { candidate: result.candidate, debt: result.debt }, 'Debt created from detected payment', 201);
    } catch (err: any) {
      handleError(err, res, next);
    }
  }

  async ignore(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const candidate = await debtCandidateService.ignore(userId, id);
      if (!candidate) {
        sendError(res, 'Debt candidate not found', 404, 'NOT_FOUND');
        return;
      }
      sendSuccess(res, { candidate }, 'Suggestion dismissed');
    } catch (err: any) {
      handleError(err, res, next);
    }
  }

  async ignoreAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const ids = req.body?.ids as string[] | undefined;
      const count = await debtCandidateService.ignoreAll(userId, ids);
      sendSuccess(res, { count }, `Dismissed ${count} debt suggestion${count === 1 ? '' : 's'}`);
    } catch (err: any) {
      handleError(err, res, next);
    }
  }
}

export const debtCandidateController = new DebtCandidateController();