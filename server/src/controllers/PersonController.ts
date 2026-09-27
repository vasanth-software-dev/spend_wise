import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { personService } from '../services/PersonService.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

export class PersonController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const people = await personService.list(req.user!.userId);
      sendSuccess(res, { people });
    } catch (error) {
      next(error);
    }
  }

  async get(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, type, categoryId } = req.query as {
        search?: string;
        type?: string;
        categoryId?: string;
      };
      const details = await personService.details(req.user!.userId, req.params.id, {
        search,
        type,
        categoryId,
      });
      if (!details) {
        sendError(res, 'Person not found', 404);
        return;
      }
      sendSuccess(res, details);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.body.name?.trim()) {
        sendError(res, 'Person name is required', 400);
        return;
      }
      const person = await personService.findOrCreate(
        req.user!.userId,
        {
          name: req.body.name,
          vpa: req.body.vpa,
          email: req.body.email,
        },
        { isManual: true }
      );
      sendSuccess(res, { person }, 'Person saved', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await personService.update(req.user!.userId, req.params.id, req.body);
      if (!updated) {
        sendError(res, 'Person not found', 404);
        return;
      }
      sendSuccess(res, { person: updated }, 'Person updated');
    } catch (error: any) {
      if (error.message && (error.message.includes('already has') || error.message.includes('already exists'))) {
        sendError(res, error.message, 400);
        return;
      }
      next(error);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await personService.delete(req.user!.userId, req.params.id);
      if (!deleted) {
        sendError(res, 'Person not found', 404);
        return;
      }
      sendSuccess(res, null, 'Person deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignTransaction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const personId = req.body.personId || null;
      const transaction = await personService.assignTransaction(
        req.user!.userId,
        req.params.id,
        personId
      );
      if (!transaction) {
        sendError(res, 'Transaction or person not found', 404);
        return;
      }
      sendSuccess(res, { transaction }, 'Person assignment updated');
    } catch (error) {
      next(error);
    }
  }
}

export const personController = new PersonController();
