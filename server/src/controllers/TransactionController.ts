import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { transactionService } from '../services/TransactionService.js';
import { categoryRepository } from '../repositories/CategoryRepository.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { predictCategoryWithAPI } from '../utils/categoryPredictor.js';
import {
  mapToExistingCategoryName,
  transactionClassificationService,
} from '../services/TransactionClassificationService.js';

export class TransactionController {
  async predictCategory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text, merchant, vpa, type } = req.body;
      const predictedCategory = await predictCategoryWithAPI(text || '', { merchant, vpa });
      sendSuccess(res, { category: predictedCategory, type: type || 'expense' });
    } catch (err) {
      next(err);
    }
  }

  async predictCategoryBatch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        sendError(res, 'Items array is required', 400);
        return;
      }

      const userId = req.user!.userId;
      const categories = await categoryRepository.findByUserId(userId);
      const results = await Promise.all(
        items.map(async (item: {
          id?: string;
          description?: string;
          notes?: string;
          text?: string;
          narration?: string;
          merchant?: string;
          amount?: number;
          date?: string;
          type?: string;
          category?: string;
          vpa?: string;
        }) => {
          const description = item.description || item.notes || item.text || item.narration || item.merchant || '';
          const merchant = item.merchant || '';
          const type = item.type || 'expense';
          const parserCategory = item.category || await predictCategoryWithAPI(description, { merchant, vpa: item.vpa });

          // Self transfers are neither income nor expense: keep the parser result and skip AI
          if (type === 'transfer' || /self\s*transfer/i.test(parserCategory)) {
            const transferCategory =
              categories.find((c) => /self\s*transfer/i.test(c.name))?.name ||
              categories.find((c) => c.type === 'both' && /transfer/i.test(c.name))?.name ||
              'Self Transfer';
            return {
              id: item.id,
              name: merchant,
              category: transferCategory,
              type: 'transfer',
            };
          }

          const classification = await transactionClassificationService.classify(
            {
              description,
              amount: Number(item.amount) || 0,
              type,
              date: item.date || '',
              merchant,
            },
            { name: merchant, category: parserCategory }
          );
          const category = mapToExistingCategoryName(categories, classification.category)
            || parserCategory
            || 'Other';
          let resolvedType = type;
          if (classification.category === 'Salary / Income' || classification.category === 'Refund') {
            resolvedType = 'income';
          }

          if (category === 'Salary') {
            resolvedType = 'income';
          }
          return {
            id: item.id,
            name: classification.name,
            category,
            type: resolvedType,
          };
        })
      );

      sendSuccess(res, { predictions: results });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const transaction = await transactionService.createTransaction(userId, req.body);
      sendSuccess(res, { transaction }, 'Transaction recorded successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const {
        startDate,
        endDate,
        categoryId,
        type,
        paymentMethod,
        source,
        status,
        minAmount,
        maxAmount,
        merchant,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      } = req.query;

      const result = await transactionService.getTransactions({
        userId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        categoryId: categoryId as string,
        type: type as 'expense' | 'income' | 'transfer',
        paymentMethod: paymentMethod as string,
        source: source as string,
        status: status as string,
        minAmount: minAmount ? Number(minAmount) : undefined,
        maxAmount: maxAmount ? Number(maxAmount) : undefined,
        merchant: merchant as string,
        search: search as string,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        sortBy: sortBy as 'transactionDate' | 'amount' | 'merchant' | 'createdAt',
        sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
      });

      sendSuccess(res, { transactions: result.transactions }, 'Transactions fetched', 200, {
        page: result.page,
        limit: limit ? Number(limit) : 20,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Read-only duplicate probe for the receipt scanner. Returns the existing
   * transaction so the UI can offer "Review existing" / "Add anyway". It never
   * creates or modifies a transaction.
   */
  async checkDuplicate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { amount, merchant, transactionDate, refNo, type, paymentMethod } = req.body || {};

      if (!merchant || !String(merchant).trim()) {
        sendError(res, 'Merchant is required to check for duplicates', 400);
        return;
      }

      const result = await transactionService.checkPossibleDuplicate(userId, {
        amount: Number(amount) || 0,
        merchant: String(merchant),
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        refNo: refNo ? String(refNo).trim() : undefined,
        type: type === 'income' ? 'income' : 'expense',
        paymentMethod,
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const transaction = await transactionService.getTransactionById(id, userId);

      if (!transaction) {
        sendError(res, 'Transaction not found', 404, 'NOT_FOUND');
        return;
      }

      sendSuccess(res, { transaction });
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const transaction = await transactionService.updateTransaction(id, userId, req.body);

      if (!transaction) {
        sendError(res, 'Transaction not found or unauthorized', 404, 'NOT_FOUND');
        return;
      }

      sendSuccess(res, { transaction }, 'Transaction updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const deleted = await transactionService.deleteTransaction(id, userId);

      if (!deleted) {
        sendError(res, 'Transaction not found or unauthorized', 404, 'NOT_FOUND');
        return;
      }

      sendSuccess(res, null, 'Transaction deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  async bulkDelete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { ids } = req.body;
      if (!Array.isArray(ids) || !ids.length) {
        sendError(res, 'Array of transaction IDs required', 400);
        return;
      }

      const count = await transactionService.bulkDelete(ids, userId);
      sendSuccess(res, { deletedCount: count }, `${count} transactions deleted`);
    } catch (err) {
      next(err);
    }
  }

  async bulkCategorize(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { ids, categoryId } = req.body;
      if (!Array.isArray(ids) || !ids.length || !categoryId) {
        sendError(res, 'Transaction IDs and categoryId are required', 400);
        return;
      }

      const count = await transactionService.bulkCategorize(ids, userId, categoryId);
      sendSuccess(res, { updatedCount: count }, `${count} transactions categorized`);
    } catch (err) {
      next(err);
    }
  }

  async getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const timeRange = (req.query.timeRange as 'today' | '7d' | '30d' | '3m' | '6m' | '1y') || '30d';
      const data = await transactionService.getDashboardData(userId, timeRange);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  }

  async importCSV(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { rows } = req.body;
      if (!Array.isArray(rows) || !rows.length) {
        sendError(res, 'Rows array is required for CSV import', 400);
        return;
      }

      const result = await transactionService.importTransactions(userId, rows);
      sendSuccess(res, result, `Imported ${result.importedCount} transactions`);
    } catch (err) {
      next(err);
    }
  }

  async exportCSV(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const csv = await transactionService.exportTransactionsToCSV({
        userId,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        categoryId: req.query.categoryId as string,
        type: req.query.type as 'expense' | 'income' | 'transfer',
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="spendwise-transactions.csv"');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
}

export const transactionController = new TransactionController();
