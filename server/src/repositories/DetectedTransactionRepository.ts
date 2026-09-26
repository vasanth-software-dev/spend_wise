import { DetectedTransactionModel } from '../models/DetectedTransaction.js';
import { IDetectedTransaction } from '../types/index.js';
import { Types } from 'mongoose';

export class DetectedTransactionRepository {
  async create(data: Partial<IDetectedTransaction>): Promise<IDetectedTransaction> {
    const doc = new DetectedTransactionModel(data);
    return (await doc.save()).toObject();
  }

  async findById(id: string, userId: string): Promise<IDetectedTransaction | null> {
    return DetectedTransactionModel.findOne({ _id: id, userId }).lean();
  }

  async findByMessageId(userId: string, emailMessageId: string): Promise<IDetectedTransaction | null> {
    return DetectedTransactionModel.findOne({ userId, emailMessageId }).lean();
  }

  async findPendingByUserId(userId: string, limit = 50): Promise<IDetectedTransaction[]> {
    return DetectedTransactionModel.find({
      userId: new Types.ObjectId(userId),
      status: 'detected',
    })
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async findAllByUserId(userId: string, status?: string): Promise<IDetectedTransaction[]> {
    const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (status) query.status = status;
    return DetectedTransactionModel.find(query)
      .sort({ transactionDate: -1 })
      .lean();
  }

  async updateStatus(
    id: string,
    userId: string,
    status: 'detected' | 'confirmed' | 'rejected' | 'duplicate'
  ): Promise<IDetectedTransaction | null> {
    return DetectedTransactionModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { status } },
      { new: true }
    ).lean();
  }

  async findPotentialDuplicate(
    userId: string,
    upiReference?: string,
    amount?: number,
    transactionDate?: Date
  ): Promise<IDetectedTransaction | null> {
    if (upiReference) {
      const match = await DetectedTransactionModel.findOne({
        userId: new Types.ObjectId(userId),
        upiReference,
      }).lean();
      if (match) return match;
    }

    if (amount && transactionDate) {
      const windowMs = 60 * 60 * 1000; // 1 hr
      return DetectedTransactionModel.findOne({
        userId: new Types.ObjectId(userId),
        amount,
        transactionDate: {
          $gte: new Date(transactionDate.getTime() - windowMs),
          $lte: new Date(transactionDate.getTime() + windowMs),
        },
      }).lean();
    }

    return null;
  }
}

export const detectedTransactionRepository = new DetectedTransactionRepository();
