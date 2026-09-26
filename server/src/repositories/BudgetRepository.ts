import { BudgetModel } from '../models/Budget.js';
import { TransactionModel } from '../models/Transaction.js';
import { IBudget } from '../types/index.js';
import { Types } from 'mongoose';

export interface BudgetWithSpending extends IBudget {
  spent: number;
  remaining: number;
  percentageUsed: number;
  isExceeded: boolean;
  isWarning: boolean;
}

export class BudgetRepository {
  async create(data: Partial<IBudget>): Promise<IBudget> {
    const doc = new BudgetModel(data);
    return (await doc.save()).toObject();
  }

  async findById(id: string, userId: string): Promise<IBudget | null> {
    return BudgetModel.findOne({ _id: id, userId }).populate('categoryId').lean();
  }

  async findByUserId(userId: string): Promise<IBudget[]> {
    return BudgetModel.find({ userId: new Types.ObjectId(userId) })
      .populate('categoryId')
      .sort({ createdAt: -1 })
      .lean();
  }

  async update(id: string, userId: string, updateData: Partial<IBudget>): Promise<IBudget | null> {
    return BudgetModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: updateData },
      { new: true }
    )
      .populate('categoryId')
      .lean();
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await BudgetModel.findOneAndDelete({ _id: id, userId });
    return !!res;
  }

  // Calculate actual spending against each budget
  async getBudgetsWithProgress(userId: string): Promise<BudgetWithSpending[]> {
    const budgets = await this.findByUserId(userId);
    const results: BudgetWithSpending[] = [];

    for (const budget of budgets) {
      const matchQuery: Record<string, unknown> = {
        userId: new Types.ObjectId(userId),
        status: 'confirmed',
        type: 'expense',
        transactionDate: { $gte: budget.startDate, $lte: budget.endDate },
      };

      if (budget.categoryId) {
        matchQuery.categoryId = (budget.categoryId as { _id?: Types.ObjectId })._id || budget.categoryId;
      }

      const spendingResult = await TransactionModel.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, totalSpent: { $sum: '$amount' } } },
      ]);

      const spent = spendingResult[0]?.totalSpent || 0;
      const remaining = Math.max(0, budget.amount - spent);
      const percentageUsed = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
      const threshold = budget.notificationThreshold || 80;

      results.push({
        ...budget,
        spent,
        remaining,
        percentageUsed,
        isExceeded: spent > budget.amount,
        isWarning: percentageUsed >= threshold && spent <= budget.amount,
      });
    }

    return results;
  }
}

export const budgetRepository = new BudgetRepository();
