import { DetectedTransactionModel } from '../models/DetectedTransaction.js';
import { IDetectedTransaction } from '../types/index.js';
import { Types } from 'mongoose';
import { buildRefNoQueryPattern } from '../utils/referenceNumber.js';

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

  async findPendingByUserId(userId: string, limit = 500): Promise<IDetectedTransaction[]> {
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

  async updateManyStatus(
    userId: string,
    status: 'detected' | 'confirmed' | 'rejected' | 'duplicate',
    ids?: string[]
  ): Promise<number> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (ids && ids.length > 0) {
      query._id = { $in: ids.map((id) => new Types.ObjectId(id)) };
    } else {
      query.status = 'detected';
    }
    const res = await DetectedTransactionModel.updateMany(query, { $set: { status } });
    return res.modifiedCount;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<IDetectedTransaction>
  ): Promise<IDetectedTransaction | null> {
    return DetectedTransactionModel.findOneAndUpdate(
      { _id: id, userId: new Types.ObjectId(userId) },
      { $set: data },
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
      const refPattern = buildRefNoQueryPattern(upiReference);
      const orClauses: Record<string, unknown>[] = [
        { upiReference },
        { bankReference: upiReference },
      ];
      if (refPattern) {
        orClauses.push({ upiReference: { $regex: refPattern } });
        orClauses.push({ bankReference: { $regex: refPattern } });
      }

      const match = await DetectedTransactionModel.findOne({
        userId: new Types.ObjectId(userId),
        $or: orClauses,
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
