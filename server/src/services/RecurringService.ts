import { recurringRepository } from '../repositories/RecurringRepository.js';
import { IRecurringTransaction, RecurringFrequency, TransactionType, PaymentMethod } from '../types/index.js';
import { Types } from 'mongoose';

export interface CreateRecurringDTO {
  name: string;
  amount: number;
  currency?: string;
  type?: TransactionType;
  categoryId?: string | null;
  merchant: string;
  paymentMethod?: PaymentMethod;
  frequency: RecurringFrequency;
  startDate: Date | string;
  endDate?: Date | string | null;
}

export class RecurringService {
  async create(userId: string, data: CreateRecurringDTO): Promise<IRecurringTransaction> {
    const startDate = new Date(data.startDate);
    const nextDueDate = new Date(startDate);

    return recurringRepository.create({
      userId: new Types.ObjectId(userId),
      name: data.name.trim(),
      amount: Number(data.amount),
      currency: data.currency || 'INR',
      type: data.type || 'expense',
      categoryId: data.categoryId ? new Types.ObjectId(data.categoryId) : null,
      merchant: data.merchant.trim(),
      paymentMethod: data.paymentMethod || 'upi',
      frequency: data.frequency,
      startDate,
      endDate: data.endDate ? new Date(data.endDate) : null,
      nextDueDate,
      isActive: true,
    });
  }

  async getUpcoming(userId: string, limit = 5): Promise<IRecurringTransaction[]> {
    return recurringRepository.findUpcoming(userId, limit);
  }

  async getAll(userId: string): Promise<IRecurringTransaction[]> {
    return recurringRepository.findByUserId(userId);
  }

  async update(id: string, userId: string, data: Partial<CreateRecurringDTO>): Promise<IRecurringTransaction | null> {
    const payload: Partial<IRecurringTransaction> = {};
    if (data.name) payload.name = data.name.trim();
    if (data.amount !== undefined) payload.amount = Number(data.amount);
    if (data.merchant) payload.merchant = data.merchant.trim();
    if (data.frequency) payload.frequency = data.frequency;
    if (data.paymentMethod) payload.paymentMethod = data.paymentMethod;
    if (data.categoryId !== undefined) {
      payload.categoryId = data.categoryId ? new Types.ObjectId(data.categoryId) : null;
    }

    return recurringRepository.update(id, userId, payload);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    return recurringRepository.delete(id, userId);
  }
}

export const recurringService = new RecurringService();
