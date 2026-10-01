import { debtRepository, DebtWithBalance, DebtWithPayments } from '../repositories/DebtRepository.js';
import { PersonModel } from '../models/Person.js';
import { IDebt, IDebtPayment } from '../types/index.js';
import { Types } from 'mongoose';

export interface CreateDebtDTO {
  personId?: string | null;
  personName?: string;
  direction: 'I_OWE' | 'OWED_TO_ME';
  originalAmount: number;
  description?: string;
  debtDate?: Date | string;
  dueDate?: Date | string | null;
  categoryId?: string | null;
  accountId?: string | null;
  notes?: string;
}

export interface CreatePaymentDTO {
  amount: number;
  paymentDate?: Date | string;
  accountId?: string | null;
  note?: string;
}

export class DebtService {
  /** Resolve personId -> personName. Throws PERSON_NOT_FOUND if the id is invalid for this user. */
  private async resolveDebtPerson(
    userId: string,
    data: { personId?: string | null; personName?: string }
  ): Promise<{ personId: Types.ObjectId | null; personName: string }> {
    const rawId = typeof data.personId === 'string' ? data.personId.trim() : data.personId;
    if (rawId) {
      if (!Types.ObjectId.isValid(rawId)) throw new Error('PERSON_NOT_FOUND');
      const person = await PersonModel.findOne({
        _id: rawId,
        userId: new Types.ObjectId(userId),
        isDeleted: { $ne: true },
      }).lean();
      if (!person) throw new Error('PERSON_NOT_FOUND');
      return { personId: new Types.ObjectId(person._id), personName: person.name };
    }
    const manualName = data.personName?.trim();
    if (!manualName) throw new Error('PERSON_REQUIRED');
    // Manual entry (e.g. bank loan like "HDFC Personal Loan") — intentionally NOT
    // auto-added to People so banks/institutions don't pollute the contacts directory.
    return { personId: null, personName: manualName };
  }

  async createDebt(userId: string, data: CreateDebtDTO): Promise<IDebt> {
    const { personId, personName } = await this.resolveDebtPerson(userId, data);
    return debtRepository.create({
      userId: new Types.ObjectId(userId),
      personId,
      personName,
      direction: data.direction,
      originalAmount: Number(data.originalAmount),
      description: data.description?.trim() || undefined,
      debtDate: data.debtDate ? new Date(data.debtDate) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      categoryId: data.categoryId ? new Types.ObjectId(data.categoryId) : null,
      accountId: data.accountId ? new Types.ObjectId(data.accountId) : null,
      notes: data.notes?.trim() || undefined,
    });
  }

  async getDebts(userId: string): Promise<DebtWithBalance[]> {
    return debtRepository.getDebtsWithBalance(userId);
  }

  async getDebtById(id: string, userId: string): Promise<DebtWithPayments | null> {
    return debtRepository.getDebtWithPayments(id, userId);
  }

  async updateDebt(
    id: string,
    userId: string,
    updateData: Partial<CreateDebtDTO>
  ): Promise<IDebt | null> {
    // Guard: originalAmount must never drop below what has already been paid
    if (updateData.originalAmount !== undefined) {
      const existing = await debtRepository.findById(id, userId);
      if (!existing) return null;
      const payments = await debtRepository.getPaymentsByDebtId(id, userId);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      if (Number(updateData.originalAmount) < totalPaid) {
        throw new Error('AMOUNT_BELOW_PAID');
      }
    }

    const payload: Partial<IDebt> = {};
    if (updateData.personId !== undefined || updateData.personName !== undefined) {
      const wantsPersonChange =
        (typeof updateData.personId === 'string' && updateData.personId.trim().length > 0) ||
        updateData.personId === null ||
        (typeof updateData.personName === 'string' && updateData.personName.trim().length > 0);
      if (wantsPersonChange) {
        const { personId, personName } = await this.resolveDebtPerson(userId, {
          personId: updateData.personId,
          personName: updateData.personName,
        });
        payload.personId = personId;
        payload.personName = personName;
      }
    }
    if (updateData.direction) payload.direction = updateData.direction;
    if (updateData.originalAmount !== undefined)
      payload.originalAmount = Number(updateData.originalAmount);
    if (updateData.description !== undefined)
      payload.description = updateData.description?.trim() || undefined;
    if (updateData.debtDate) payload.debtDate = new Date(updateData.debtDate);
    if (updateData.dueDate !== undefined)
      payload.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
    if (updateData.categoryId !== undefined)
      payload.categoryId = updateData.categoryId ? new Types.ObjectId(updateData.categoryId) : null;
    if (updateData.accountId !== undefined)
      payload.accountId = updateData.accountId ? new Types.ObjectId(updateData.accountId) : null;
    if (updateData.notes !== undefined)
      payload.notes = updateData.notes?.trim() || undefined;

    return debtRepository.update(id, userId, payload);
  }

  async deleteDebt(id: string, userId: string): Promise<boolean> {
    return debtRepository.delete(id, userId);
  }

  async recordPayment(
    debtId: string,
    userId: string,
    data: CreatePaymentDTO
  ): Promise<{ payment: IDebtPayment; debt: DebtWithBalance }> {
    const debt = await debtRepository.findById(debtId, userId);
    if (!debt) {
      throw new Error('DEBT_NOT_FOUND');
    }

    const numericAmount = Number(data.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error('INVALID_PAYMENT_AMOUNT');
    }

    // Calculate current remaining balance
    const payments = await debtRepository.getPaymentsByDebtId(debtId, userId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = Math.max(0, debt.originalAmount - totalPaid);

    if (data.amount > remainingAmount) {
      throw new Error('PAYMENT_EXCEEDS_REMAINING');
    }

    if (remainingAmount <= 0) {
      throw new Error('PAYMENT_EXCEEDS_REMAINING');
    }

    const payment = await debtRepository.createPayment({
      debtId: new Types.ObjectId(debtId),
      amount: numericAmount,
      paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
      accountId: data.accountId ? new Types.ObjectId(data.accountId) : null,
      note: data.note?.trim() || undefined,
    });

    const updatedDebt = await debtRepository.getDebtWithPayments(debtId, userId);
    return { payment, debt: updatedDebt! };
  }

  async deletePayment(
    paymentId: string,
    debtId: string,
    userId: string
  ): Promise<DebtWithBalance | null> {
    const deleted = await debtRepository.deletePayment(paymentId, debtId, userId);
    if (!deleted) return null;
    const updated = await debtRepository.getDebtWithPayments(debtId, userId);
    return updated as unknown as DebtWithBalance | null;
  }

  /**
   * Calculate dashboard summary for a user.
   */
  async getDashboardSummary(userId: string): Promise<{
    totalIOwe: number;
    totalOwedToMe: number;
    netBalance: number;
    activeDebts: number;
    overdueDebts: number;
    settledDebts: number;
    partiallyPaidDebts: number;
  }> {
    const debts = await debtRepository.getDebtsWithBalance(userId);

    let totalIOwe = 0;
    let totalOwedToMe = 0;
    let activeDebts = 0;
    let overdueDebts = 0;
    let settledDebts = 0;
    let partiallyPaidDebts = 0;

    for (const debt of debts) {
      if (debt.direction === 'I_OWE') {
        totalIOwe += debt.remainingAmount;
      } else {
        totalOwedToMe += debt.remainingAmount;
      }

      switch (debt.status) {
        case 'ACTIVE':
          activeDebts++;
          break;
        case 'OVERDUE':
          overdueDebts++;
          break;
        case 'SETTLED':
          settledDebts++;
          break;
        case 'PARTIALLY_PAID':
          partiallyPaidDebts++;
          break;
      }
    }

    return {
      totalIOwe,
      totalOwedToMe,
      netBalance: totalOwedToMe - totalIOwe,
      activeDebts,
      overdueDebts,
      settledDebts,
      partiallyPaidDebts,
    };
  }
}

export const debtService = new DebtService();