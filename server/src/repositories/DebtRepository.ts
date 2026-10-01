import { DebtModel, DebtPaymentModel } from '../models/Debt.js';
import { DebtCandidateModel } from '../models/DebtCandidate.js';
import { IDebt, IDebtPayment } from '../types/index.js';
import { Types } from 'mongoose';

export interface DebtWithBalance extends IDebt {
  totalPaid: number;
  remainingAmount: number;
  status: 'ACTIVE' | 'PARTIALLY_PAID' | 'OVERDUE' | 'SETTLED';
  isOverdue: boolean;
}

export interface DebtWithPayments extends IDebt {
  payments: IDebtPayment[];
  totalPaid: number;
  remainingAmount: number;
  status: 'ACTIVE' | 'PARTIALLY_PAID' | 'OVERDUE' | 'SETTLED';
  isOverdue: boolean;
}

export class DebtRepository {
  async create(data: Partial<IDebt>): Promise<IDebt> {
    const doc = new DebtModel(data);
    return (await doc.save()).toObject();
  }

  async findById(id: string, userId: string): Promise<IDebt | null> {
    return DebtModel.findOne({ _id: id, userId }).populate('categoryId').populate('personId').lean();
  }

  async findByUserId(userId: string): Promise<IDebt[]> {
    return DebtModel.find({ userId: new Types.ObjectId(userId) })
      .populate('categoryId')
      .populate('personId')
      .sort({ createdAt: -1 })
      .lean();
  }

  async update(id: string, userId: string, updateData: Partial<IDebt>): Promise<IDebt | null> {
    return DebtModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: updateData },
      { new: true }
    )
      .populate('categoryId')
      .populate('personId')
      .lean();
  }

  /**
   * Open (not fully settled) debts for one person, with remaining balance.
   * Matching is by personId when available, otherwise by normalized name so a
   * manually entered name ("Sivashakthi S D O Sa") still resolves.
   */
  async findOpenByPerson(
    userId: string,
    person: { personId?: string | null; personName: string }
  ): Promise<DebtWithBalance[]> {
    const userObjectId = new Types.ObjectId(userId);
    // Collapse whitespace on both sides so "Sivashakthi  S D" matches
    // "Sivashakthi S D", which is how the two fields are usually typed.
    const escapeForName = (value: string) =>
      value.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const personNamePattern = new RegExp(
      `^${escapeForName(person.personName).replace(/\s+/g, '\\s+')}$`,
      'i'
    );

    const debts = await DebtModel.find({
      userId: userObjectId,
      $or: [
        ...(person.personId ? [{ personId: new Types.ObjectId(person.personId) }] : []),
        { personName: personNamePattern },
      ],
    })
      .populate('categoryId')
      .populate('personId')
      .sort({ createdAt: -1 })
      .lean();

    const results: DebtWithBalance[] = [];
    for (const debt of debts) {
      const paymentAgg = await DebtPaymentModel.aggregate([
        { $match: { debtId: new Types.ObjectId(String(debt._id)) } },
        { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
      ]);
      const totalPaid = paymentAgg[0]?.totalPaid || 0;
      const { remainingAmount, status, isOverdue } = this.calculateStatus(debt, totalPaid);
      if (remainingAmount <= 0) continue;
      results.push({ ...debt, totalPaid, remainingAmount, status, isOverdue });
    }

    return results;
  }

  /** Unsettled debts whose due date falls inside the given window. */
  async findWithDueDateBetween(userId: string, start: Date, end: Date): Promise<DebtWithBalance[]> {
    const debts = await DebtModel.find({
      userId: new Types.ObjectId(userId),
      dueDate: { $ne: null, $gte: start, $lt: end },
    })
      .populate('categoryId')
      .populate('personId')
      .sort({ dueDate: 1 })
      .lean();

    if (debts.length === 0) return [];

    const totals = await DebtPaymentModel.aggregate<{ _id: Types.ObjectId; totalPaid: number }>([
      { $match: { debtId: { $in: debts.map((d) => d._id) } } },
      { $group: { _id: '$debtId', totalPaid: { $sum: '$amount' } } },
    ]);
    const paidByDebt = new Map(totals.map((row) => [String(row._id), row.totalPaid]));

    const results: DebtWithBalance[] = [];
    for (const debt of debts) {
      const totalPaid = paidByDebt.get(String(debt._id)) || 0;
      const { remainingAmount, status, isOverdue } = this.calculateStatus(debt, totalPaid);
      if (remainingAmount <= 0) continue;
      results.push({ ...debt, totalPaid, remainingAmount, status, isOverdue });
    }
    return results;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await DebtModel.findOneAndDelete({ _id: id, userId });
    if (!res) return false;
    // Cascade-delete payment history so no orphan records survive
    await DebtPaymentModel.deleteMany({ debtId: res._id });
    // Clear suggestions that pointed at this debt so the review queue stays accurate
    await DebtCandidateModel.updateMany(
      { suggestedDebtId: res._id },
      { $set: { suggestedDebtId: null, match: 'NO_MATCH', suggestedDebtRemaining: null } }
    );
    return true;
  }

  async createPayment(data: Partial<IDebtPayment>): Promise<IDebtPayment> {
    const doc = new DebtPaymentModel(data);
    return (await doc.save()).toObject();
  }

  async getPaymentsByDebtId(debtId: string, userId: string): Promise<IDebtPayment[]> {
    // Verify debt ownership first
    const debt = await DebtModel.findOne({ _id: debtId, userId });
    if (!debt) return [];
    return DebtPaymentModel.find({ debtId }).sort({ paymentDate: -1 }).lean();
  }

  async deletePayment(paymentId: string, debtId: string, userId: string): Promise<boolean> {
    const debt = await DebtModel.findOne({ _id: debtId, userId });
    if (!debt) return false;
    const res = await DebtPaymentModel.findOneAndDelete({ _id: paymentId, debtId });
    return !!res;
  }

  /**
   * Calculate current status and remaining balance for a debt.
   * This is the single source of truth for status determination.
   */
  calculateStatus(debt: IDebt, totalPaid: number): {
    remainingAmount: number;
    status: 'ACTIVE' | 'PARTIALLY_PAID' | 'OVERDUE' | 'SETTLED';
    isOverdue: boolean;
  } {
    const remainingAmount = Math.max(0, debt.originalAmount - totalPaid);
    const now = new Date();
    const isOverdue = !!(debt.dueDate && new Date(debt.dueDate) < now && remainingAmount > 0);

    let status: 'ACTIVE' | 'PARTIALLY_PAID' | 'OVERDUE' | 'SETTLED';
    if (remainingAmount === 0) {
      status = 'SETTLED';
    } else if (isOverdue) {
      status = 'OVERDUE';
    } else if (totalPaid > 0) {
      status = 'PARTIALLY_PAID';
    } else {
      status = 'ACTIVE';
    }

    return { remainingAmount, status, isOverdue };
  }

  async getDebtsWithBalance(userId: string): Promise<DebtWithBalance[]> {
    const debts = await this.findByUserId(userId);
    const results: DebtWithBalance[] = [];

    for (const debt of debts) {
      const paymentAgg = await DebtPaymentModel.aggregate([
        { $match: { debtId: new Types.ObjectId(String(debt._id)) } },
        { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
      ]);
      const totalPaid = paymentAgg[0]?.totalPaid || 0;
      const { remainingAmount, status, isOverdue } = this.calculateStatus(debt, totalPaid);

      results.push({
        ...debt,
        totalPaid,
        remainingAmount,
        status,
        isOverdue,
      });
    }

    return results;
  }

  async getDebtWithPayments(id: string, userId: string): Promise<DebtWithPayments | null> {
    const debt = await this.findById(id, userId);
    if (!debt) return null;

    const payments = await this.getPaymentsByDebtId(id, userId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const { remainingAmount, status, isOverdue } = this.calculateStatus(debt, totalPaid);

    return {
      ...debt,
      payments,
      totalPaid,
      remainingAmount,
      status,
      isOverdue,
    };
  }
}

export const debtRepository = new DebtRepository();