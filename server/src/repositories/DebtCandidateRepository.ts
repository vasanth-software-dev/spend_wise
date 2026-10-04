import { DebtCandidateModel } from '../models/DebtCandidate.js';
import { IDebtCandidate } from '../types/index.js';
import { buildRefNoQueryPattern } from '../utils/referenceNumber.js';
import { Types } from 'mongoose';

export class DebtCandidateRepository {
  async create(data: Partial<IDebtCandidate>): Promise<IDebtCandidate> {
    const doc = new DebtCandidateModel(data);
    return (await doc.save()).toObject();
  }

  async findById(id: string, userId: string): Promise<IDebtCandidate | null> {
    return DebtCandidateModel.findOne({ _id: id, userId }).lean();
  }

  /**
   * Find an existing candidate for the same underlying payment. The normalized
   * reference number is the primary dedupe key; when it is missing we fall back
   * to amount + person + date so a repeated import cannot flood the review queue.
   */
  async findExisting(
    userId: string,
    input: {
      refNoNormalized?: string | null;
      personId?: string | null;
      personName?: string;
      amount: number;
      transactionDate: Date;
    }
  ): Promise<IDebtCandidate | null> {
    const userObjectId = new Types.ObjectId(userId);

    if (input.refNoNormalized) {
      const byRef = await DebtCandidateModel.findOne({
        userId: userObjectId,
        refNoNormalized: input.refNoNormalized,
      }).lean();
      if (byRef) return byRef;
    }

    const dayStart = new Date(input.transactionDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    return DebtCandidateModel.findOne({
      userId: userObjectId,
      amount: input.amount,
      transactionDate: { $gte: dayStart, $lt: dayEnd },
      ...(input.personId
        ? { personId: new Types.ObjectId(input.personId) }
        : { personName: input.personName }),
    }).lean();
  }

  async findByUserId(
    userId: string,
    status?: string,
    limit = 100
  ): Promise<IDebtCandidate[]> {
    return DebtCandidateModel.find({
      userId: new Types.ObjectId(userId),
      ...(status ? { status } : {}),
    })
      .populate('personId')
      .populate('suggestedDebtId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async findPendingByUserId(userId: string, limit = 100): Promise<IDebtCandidate[]> {
    return this.findByUserId(userId, 'PENDING', limit);
  }

  async findPendingForRef(
    userId: string,
    refNo: string
  ): Promise<IDebtCandidate | null> {
    const pattern = buildRefNoQueryPattern(refNo);
    if (!pattern) return null;
    return DebtCandidateModel.findOne({
      userId: new Types.ObjectId(userId),
      refNo: pattern,
      status: 'PENDING',
    }).lean();
  }

  async update(
    id: string,
    userId: string,
    updateData: Partial<IDebtCandidate>
  ): Promise<IDebtCandidate | null> {
    return DebtCandidateModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: updateData },
      { new: true }
    )
      .populate('personId')
      .populate('suggestedDebtId')
      .lean();
  }

  async countPending(userId: string): Promise<number> {
    return DebtCandidateModel.countDocuments({
      userId: new Types.ObjectId(userId),
      status: 'PENDING',
    });
  }

  async ignoreMany(userId: string, ids?: string[]): Promise<number> {
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      status: 'PENDING',
    };
    if (ids && ids.length > 0) {
      query._id = { $in: ids.map((id) => new Types.ObjectId(id)) };
    }
    const res = await DebtCandidateModel.updateMany(query, { $set: { status: 'IGNORED' } });
    return res.modifiedCount;
  }
}

export const debtCandidateRepository = new DebtCandidateRepository();