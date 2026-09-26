import { budgetRepository, BudgetWithSpending } from '../repositories/BudgetRepository.js';
import { notificationRepository } from '../repositories/NotificationRepository.js';
import { IBudget } from '../types/index.js';
import { Types } from 'mongoose';

export interface CreateBudgetDTO {
  categoryId?: string | null;
  name: string;
  amount: number;
  period?: 'monthly' | 'yearly';
  startDate?: Date | string;
  endDate?: Date | string;
  notificationThreshold?: number;
}

export class BudgetService {
  async createBudget(userId: string, data: CreateBudgetDTO): Promise<IBudget> {
    const now = new Date();
    const startDate = data.startDate ? new Date(data.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = data.endDate ? new Date(data.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return budgetRepository.create({
      userId: new Types.ObjectId(userId),
      categoryId: data.categoryId ? new Types.ObjectId(data.categoryId) : null,
      name: data.name.trim(),
      amount: Number(data.amount),
      period: data.period || 'monthly',
      startDate,
      endDate,
      notificationThreshold: data.notificationThreshold || 80,
    });
  }

  async getBudgets(userId: string): Promise<BudgetWithSpending[]> {
    const budgets = await budgetRepository.getBudgetsWithProgress(userId);

    // Check if any budget crossed threshold and trigger notification if not already notified
    for (const b of budgets) {
      if (b.isExceeded) {
        await notificationRepository.create({
          userId: new Types.ObjectId(userId),
          title: `Budget Exceeded: ${b.name}`,
          message: `You have spent ₹${b.spent.toLocaleString('en-IN')} of your ₹${b.amount.toLocaleString('en-IN')} budget (${b.percentageUsed}%).`,
          type: 'budget_exceeded',
          data: { budgetId: String(b._id), percentageUsed: b.percentageUsed },
        });
      } else if (b.isWarning) {
        await notificationRepository.create({
          userId: new Types.ObjectId(userId),
          title: `Budget Warning: ${b.name}`,
          message: `You have used ${b.percentageUsed}% of your ${b.name} budget. ₹${b.remaining.toLocaleString('en-IN')} remaining.`,
          type: 'budget_warning',
          data: { budgetId: String(b._id), percentageUsed: b.percentageUsed },
        });
      }
    }

    return budgets;
  }

  async updateBudget(id: string, userId: string, updateData: Partial<CreateBudgetDTO>): Promise<IBudget | null> {
    const payload: Partial<IBudget> = {};
    if (updateData.name) payload.name = updateData.name.trim();
    if (updateData.amount !== undefined) payload.amount = Number(updateData.amount);
    if (updateData.categoryId !== undefined) {
      payload.categoryId = updateData.categoryId ? new Types.ObjectId(updateData.categoryId) : null;
    }
    if (updateData.notificationThreshold !== undefined) payload.notificationThreshold = updateData.notificationThreshold;

    return budgetRepository.update(id, userId, payload);
  }

  async deleteBudget(id: string, userId: string): Promise<boolean> {
    return budgetRepository.delete(id, userId);
  }
}

export const budgetService = new BudgetService();
