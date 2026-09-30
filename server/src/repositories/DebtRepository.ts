import { DebtModel, DebtPaymentModel } from '../models/Debt.js';
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
    return DebtModel.findOne({ _id: id, userId }).populate('categoryId').lean();
  }

  async findByUserId(userId: string): Promise<IDebt[]> {
    return DebtModel.find({ userId: new Types.ObjectId(userId) })
      .populate('categoryId')
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
      .lean();
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await DebtModel.findOneAndDelete({ _id: id, userId });
    if (!res) return false;
    // Cascade-delete payment history so no orphan records survive
    await DebtPaymentModel.deleteMany({ debtId: res._id });
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