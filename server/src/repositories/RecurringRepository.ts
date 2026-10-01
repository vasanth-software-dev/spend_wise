import { RecurringTransactionModel } from '../models/RecurringTransaction.js';
import { IRecurringTransaction } from '../types/index.js';
import { Types } from 'mongoose';

export class RecurringRepository {
  async create(data: Partial<IRecurringTransaction>): Promise<IRecurringTransaction> {
    const doc = new RecurringTransactionModel(data);
    return (await doc.save()).toObject();
  }

  async findById(id: string, userId: string): Promise<IRecurringTransaction | null> {
    return RecurringTransactionModel.findOne({ _id: id, userId }).populate('categoryId').lean();
  }

  async findByUserId(userId: string): Promise<IRecurringTransaction[]> {
    return RecurringTransactionModel.find({ userId: new Types.ObjectId(userId) })
      .populate('categoryId')
      .sort({ nextDueDate: 1 })
      .lean();
  }

  async findUpcoming(userId: string, limit = 5): Promise<IRecurringTransaction[]> {
    return RecurringTransactionModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
      nextDueDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // from yesterday onwards
    })
      .populate('categoryId')
      .sort({ nextDueDate: 1 })
      .limit(limit)
      .lean();
  }

  /**
   * Active recurring items whose next due date lands inside the window. Used by
   * the calendar to project scheduled occurrences; the stored items stay the
   * single source of truth so no duplicate schedule is introduced.
   */
  async findActiveDueBetween(
    userId: string,
    start: Date,
    end: Date
  ): Promise<IRecurringTransaction[]> {
    return RecurringTransactionModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
      nextDueDate: { $gte: start, $lte: end },
    })
      .populate('categoryId', 'name icon color type')
      .lean();
  }

  async update(id: string, userId: string, updateData: Partial<IRecurringTransaction>): Promise<IRecurringTransaction | null> {
    return RecurringTransactionModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: updateData },
      { new: true }
    )
      .populate('categoryId')
      .lean();
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await RecurringTransactionModel.findOneAndDelete({ _id: id, userId });
    return !!res;
  }
}

export const recurringRepository = new RecurringRepository();
