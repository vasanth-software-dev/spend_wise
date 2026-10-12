import { budgetRepository, BudgetWithSpending } from '../repositories/BudgetRepository.js';
import { notificationRepository } from '../repositories/NotificationRepository.js';
import { NotificationModel } from '../models/Notification.js';
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
    return budgetRepository.getBudgetsWithProgress(userId);
  }

  /**
   * Evaluates budgets and creates at most one notification per budget per 24h.
   */
  async checkBudgetAlerts(userId: string): Promise<void> {
    const budgets = await budgetRepository.getBudgetsWithProgress(userId);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const b of budgets) {
      if (!b.isExceeded && !b.isWarning) continue;

      const notifType = b.isExceeded ? 'budget_exceeded' : 'budget_warning';
      const existing = await NotificationModel.findOne({
        userId: new Types.ObjectId(userId),
        type: notifType,
        'data.budgetId': String(b._id),
        createdAt: { $gte: oneDayAgo },
      }).lean();

      if (!existing) {
        await notificationRepository.create({
          userId: new Types.ObjectId(userId),
          title: b.isExceeded ? `Budget Exceeded: ${b.name}` : `Budget Warning: ${b.name}`,
          message: b.isExceeded
            ? `You have spent ₹${b.spent.toLocaleString('en-IN')} of your ₹${b.amount.toLocaleString('en-IN')} budget (${b.percentageUsed}%).`
            : `You have used ${b.percentageUsed}% of your ${b.name} budget. ₹${b.remaining.toLocaleString('en-IN')} remaining.`,
          type: notifType,
          data: { budgetId: String(b._id), percentageUsed: b.percentageUsed },
        });
      }
    }
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
