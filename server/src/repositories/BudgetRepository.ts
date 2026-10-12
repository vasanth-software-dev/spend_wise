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

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const currentYearStart = new Date(now.getFullYear(), 0, 1);
    const currentYearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const results = await Promise.all(
      budgets.map(async (budget) => {
        let windowStart = budget.startDate;
        let windowEnd = budget.endDate;

        if (budget.period === 'monthly') {
          windowStart = currentMonthStart;
          windowEnd = currentMonthEnd;
        } else if (budget.period === 'yearly') {
          windowStart = currentYearStart;
          windowEnd = currentYearEnd;
        }

        const matchQuery: Record<string, unknown> = {
          userId: new Types.ObjectId(userId),
          status: 'confirmed',
          type: 'expense',
          transactionDate: { $gte: windowStart, $lte: windowEnd },
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

        return {
          ...budget,
          startDate: windowStart,
          endDate: windowEnd,
          spent,
          remaining,
          percentageUsed,
          isExceeded: spent > budget.amount,
          isWarning: percentageUsed >= threshold && spent <= budget.amount,
        };
      })
    );

    return results;
  }
}

export const budgetRepository = new BudgetRepository();
