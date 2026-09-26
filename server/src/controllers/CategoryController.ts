import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { categoryService } from '../services/CategoryService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class CategoryController {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const categories = await categoryService.getCategories(userId);
      sendSuccess(res, { categories });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const category = await categoryService.createCategory(userId, req.body);
      sendSuccess(res, { category }, 'Category created', 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const category = await categoryService.updateCategory(id, userId, req.body);
      if (!category) {
        sendError(res, 'Category not found or system default categories cannot be modified', 400);
        return;
      }
      sendSuccess(res, { category }, 'Category updated');
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const deleted = await categoryService.deleteCategory(id, userId);
      if (!deleted) {
        sendError(res, 'Category not found or system default categories cannot be removed', 400);
        return;
      }
      sendSuccess(res, null, 'Category deleted');
    } catch (err) {
      next(err);
    }
  }
}

export const categoryController = new CategoryController();
