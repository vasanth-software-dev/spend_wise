import { recurringRepository } from '../repositories/RecurringRepository.js';
import { RecurringTransactionModel } from '../models/RecurringTransaction.js';
import { NotificationModel } from '../models/Notification.js';
import { transactionService } from './TransactionService.js';
import { IRecurringTransaction, ITransaction, RecurringFrequency, TransactionType, PaymentMethod } from '../types/index.js';
import { Types } from 'mongoose';

function computeNextDate(current: Date, frequency: RecurringFrequency): Date {
  const next = new Date(current);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

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
  isSubscription?: boolean;
  reminderDaysBefore?: number;
}

export class RecurringService {
  async syncOverdueDueDates(userId: string): Promise<void> {
    const overdue = await RecurringTransactionModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
      nextDueDate: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const now = new Date();
    for (const doc of overdue) {
      let nextDate = new Date(doc.nextDueDate);
      let isActive = true;

      while (nextDate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
        nextDate = computeNextDate(nextDate, doc.frequency);
        if (doc.endDate && nextDate > new Date(doc.endDate)) {
          isActive = false;
          break;
        }
      }

      await RecurringTransactionModel.updateOne(
        { _id: doc._id },
        { $set: { nextDueDate: nextDate, isActive } }
      );
    }
  }

  async syncReminders(userId: string): Promise<number> {
    const active = await RecurringTransactionModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
    });

    let count = 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const item of active) {
      const reminderDays = item.reminderDaysBefore ?? 3;
      const dueDate = new Date(item.nextDueDate);
      const dueMidnight = new Date(dueDate);
      dueMidnight.setHours(0, 0, 0, 0);

      const diffMs = dueMidnight.getTime() - now.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Trigger reminder if due within reminderDays window or due today/yesterday
      if (diffDays <= reminderDays && diffDays >= -1) {
        const alreadySent =
          item.lastReminderSentForDate &&
          new Date(item.lastReminderSentForDate).toDateString() === dueMidnight.toDateString();

        if (!alreadySent) {
          const itemTypeLabel = item.isSubscription ? 'Subscription' : 'Bill';
          const timingLabel =
            diffDays < 0
              ? 'is overdue'
              : diffDays === 0
              ? 'is due today'
              : `is due in ${diffDays} day${diffDays > 1 ? 's' : ''}`;

          await NotificationModel.create({
            userId: item.userId,
            title: `${itemTypeLabel} Reminder: ${item.name}`,
            message: `${item.name} of ${item.currency || 'INR'} ${Number(item.amount).toLocaleString('en-IN')} ${timingLabel}.`,
            type: 'bill_reminder',
            data: {
              recurringId: item._id,
              isSubscription: Boolean(item.isSubscription),
              dueDate: item.nextDueDate,
              amount: item.amount,
            },
          });

          await RecurringTransactionModel.updateOne(
            { _id: item._id },
            { $set: { lastReminderSentForDate: dueMidnight } }
          );

          count++;
        }
      }
    }

    return count;
  }

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
      isSubscription: Boolean(data.isSubscription),
      reminderDaysBefore: data.reminderDaysBefore !== undefined ? Number(data.reminderDaysBefore) : 3,
    });
  }

  async getUpcoming(userId: string, limit = 5): Promise<IRecurringTransaction[]> {
    await this.syncOverdueDueDates(userId);
    await this.syncReminders(userId);
    return recurringRepository.findUpcoming(userId, limit);
  }

  async getAll(userId: string): Promise<IRecurringTransaction[]> {
    await this.syncOverdueDueDates(userId);
    await this.syncReminders(userId);
    return recurringRepository.findByUserId(userId);
  }

  async update(id: string, userId: string, data: Partial<CreateRecurringDTO>): Promise<IRecurringTransaction | null> {
    const payload: Partial<IRecurringTransaction> = {};
    if (data.name) payload.name = data.name.trim();
    if (data.amount !== undefined) payload.amount = Number(data.amount);
    if (data.merchant) payload.merchant = data.merchant.trim();
    if (data.frequency) payload.frequency = data.frequency;
    if (data.paymentMethod) payload.paymentMethod = data.paymentMethod;
    if (data.isSubscription !== undefined) payload.isSubscription = Boolean(data.isSubscription);
    if (data.reminderDaysBefore !== undefined) payload.reminderDaysBefore = Number(data.reminderDaysBefore);
    if (data.categoryId !== undefined) {
      payload.categoryId = data.categoryId ? new Types.ObjectId(data.categoryId) : null;
    }

    return recurringRepository.update(id, userId, payload);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    return recurringRepository.delete(id, userId);
  }

  async processRecurring(
    id: string,
    userId: string
  ): Promise<{ transaction: ITransaction; recurring: IRecurringTransaction }> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Atomically claim lock to prevent concurrent double-clicks or accidental duplicate execution
    const doc = await RecurringTransactionModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
        $or: [
          { lastProcessedDate: null },
          { lastProcessedDate: { $lt: tenMinutesAgo } },
        ],
      },
      {
        $set: { lastProcessedDate: new Date() },
      },
      { new: true }
    );

    if (!doc) {
      // Check if item exists to distinguish NOT_FOUND from ALREADY_PROCESSED_RECENTLY
      const exists = await RecurringTransactionModel.findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      });
      if (!exists) {
        throw new Error('NOT_FOUND');
      }
      throw new Error('ALREADY_PROCESSED_RECENTLY');
    }

    try {
      const transaction = await transactionService.createTransaction(userId, {
        type: doc.type,
        amount: doc.amount,
        currency: doc.currency || 'INR',
        categoryId: doc.categoryId ? String(doc.categoryId) : null,
        merchant: doc.merchant || doc.name,
        paymentMethod: doc.paymentMethod || 'upi',
        source: 'manual',
        transactionDate: new Date(),
        notes: doc.isSubscription ? `Subscription payment: ${doc.name}` : `Recurring payment: ${doc.name}`,
        isRecurring: true,
      });

      const nextDate = computeNextDate(new Date(doc.nextDueDate || Date.now()), doc.frequency);
      let isActive = doc.isActive;
      if (doc.endDate && nextDate > new Date(doc.endDate)) {
        isActive = false;
      }

      doc.nextDueDate = nextDate;
      doc.isActive = isActive;
      await doc.save();

      return { transaction, recurring: doc.toObject() };
    } catch (err) {
      // If creating the transaction failed, revert the lock
      await RecurringTransactionModel.updateOne(
        { _id: doc._id },
        { $set: { lastProcessedDate: null } }
      );
      throw err;
    }
  }
}

export const recurringService = new RecurringService();
