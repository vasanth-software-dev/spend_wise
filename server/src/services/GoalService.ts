import { Types } from 'mongoose';
import { goalRepository, GoalWithComputed, GoalWithDetails } from '../repositories/GoalRepository.js';
import {
  GoalComputed,
  IGoal,
  IGoalContribution,
} from '../types/index.js';

export interface CreateGoalDTO {
  name: string;
  description?: string | null;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: Date | string | null;
  monthlyContribution?: number | null;
  categoryId?: string | null;
  accountId?: string | null;
  icon?: string;
  color?: string;
}

export interface AddContributionDTO {
  amount: number;
  accountId?: string | null;
  contributionDate?: Date | string | null;
  note?: string | null;
}

function toDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/** Round to at most 2 decimals, avoiding 2500.0000000000005 style artefacts. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Whole (or partial) months between `from` and `to`, both read as calendar
 * months. A future date that is less than a full month away still counts as 1
 * month so a "very short target period" never divides by zero.
 */
export function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  const anchor = new Date(from.getFullYear(), from.getMonth() + months, from.getDate());
  return to.getTime() >= anchor.getTime() ? months : months - 1;
}

/**
 * Derived goal figures.
 *
 * - progress            = current / target * 100
 * - remaining           = target - current (never negative)
 * - required monthly    = remaining / months remaining
 *
 * Edge cases handled explicitly: zero target, goal already completed, target
 * date in the past, no target date at all, and very short target periods.
 */
export function computeGoalMetrics(
  goal: Pick<IGoal, 'targetAmount' | 'currentAmount' | 'targetDate' | 'monthlyContribution'>,
  now: Date = new Date()
): GoalComputed {
  const targetAmount = Number(goal.targetAmount) || 0;
  const rawCurrent = Number(goal.currentAmount) || 0;
  const currentAmount = Math.max(0, rawCurrent);
  const targetDate = toDate(goal.targetDate);

  const isCompleted = targetAmount > 0 && currentAmount >= targetAmount;
  const remainingAmount = roundMoney(Math.max(0, targetAmount - currentAmount));
  const percentageComplete =
    targetAmount > 0 ? roundMoney((currentAmount / targetAmount) * 100) : 0;

  let monthsRemaining: number | null = null;
  if (targetDate) {
    if (isCompleted) {
      monthsRemaining = 0;
    } else if (targetDate.getTime() <= now.getTime()) {
      // Deadline already behind the user: nothing left to spread out.
      monthsRemaining = 0;
    } else {
      monthsRemaining = Math.max(1, monthsBetween(now, targetDate));
    }
  }

  let requiredMonthlyContribution: number | null = null;
  if (remainingAmount === 0) {
    requiredMonthlyContribution = 0;
  } else if (monthsRemaining && monthsRemaining > 0) {
    requiredMonthlyContribution = roundMoney(remainingAmount / monthsRemaining);
  }

  const monthly = Number(goal.monthlyContribution) || 0;
  let expectedCompletionDate: Date | null = null;
  if (remainingAmount === 0) {
    expectedCompletionDate = new Date(now.getTime());
  } else if (monthly > 0) {
    const monthsNeeded = Math.ceil(remainingAmount / monthly);
    expectedCompletionDate = new Date(now.getFullYear(), now.getMonth() + monthsNeeded, now.getDate());
  }

  return {
    targetAmount: roundMoney(targetAmount),
    currentAmount: roundMoney(currentAmount),
    remainingAmount,
    percentageComplete: Math.min(100, Math.max(0, percentageComplete)),
    monthsRemaining,
    requiredMonthlyContribution,
    expectedCompletionDate,
    isCompleted,
    isOverdue: !isCompleted && !!targetDate && targetDate.getTime() < now.getTime(),
  };
}

function objectIdOrNull(value?: string | null): Types.ObjectId | null {
  if (!value || !Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
}

export class GoalService {
  async getGoals(userId: string): Promise<GoalWithComputed[]> {
    return goalRepository.findByUserId(userId);
  }

  async getGoalById(id: string, userId: string): Promise<GoalWithDetails | null> {
    return goalRepository.findByIdWithContributions(id, userId);
  }

  /**
   * Re-reads a goal through the detail query so every mutation response
   * carries freshly derived progress and the up-to-date contribution history.
   */
  private async reload(id: string, userId: string): Promise<IGoal> {
    const refreshed = await goalRepository.findByIdWithContributions(id, userId);
    if (refreshed) return refreshed;
    const fallback = await goalRepository.findById(id, userId);
    if (!fallback) throw new Error('Goal not found or unauthorized');
    return fallback;
  }

  async create(userId: string, data: CreateGoalDTO): Promise<IGoal> {
    const targetAmount = Number(data.targetAmount);
    const currentAmount = Math.max(0, Number(data.currentAmount ?? 0));

    const created = await goalRepository.create({
      userId: new Types.ObjectId(userId),
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      targetAmount,
      currentAmount,
      targetDate: toDate(data.targetDate),
      monthlyContribution:
        data.monthlyContribution === null || data.monthlyContribution === undefined
          ? null
          : Number(data.monthlyContribution),
      categoryId: objectIdOrNull(data.categoryId),
      accountId: objectIdOrNull(data.accountId),
      icon: data.icon || 'Target',
      color: data.color || '#10b981',
      status: targetAmount > 0 && currentAmount >= targetAmount ? 'completed' : 'active',
    });

    return this.reload(String(created._id), userId);
  }

  async update(
    id: string,
    userId: string,
    data: Partial<CreateGoalDTO>
  ): Promise<IGoal | null> {
    const payload: Partial<IGoal> = {};

    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.description !== undefined) payload.description = data.description?.trim() || undefined;
    if (data.targetAmount !== undefined) payload.targetAmount = Number(data.targetAmount);
    if (data.currentAmount !== undefined) payload.currentAmount = Number(data.currentAmount);
    if (data.targetDate !== undefined) payload.targetDate = toDate(data.targetDate);
    if (data.monthlyContribution !== undefined) {
      payload.monthlyContribution =
        data.monthlyContribution === null ? null : Number(data.monthlyContribution);
    }
    if (data.categoryId !== undefined) payload.categoryId = objectIdOrNull(data.categoryId);
    if (data.accountId !== undefined) payload.accountId = objectIdOrNull(data.accountId);
    if (data.icon !== undefined) payload.icon = data.icon;
    if (data.color !== undefined) payload.color = data.color;

    const saved = await goalRepository.update(id, userId, payload);
    if (!saved) return null;
    return this.reload(id, userId);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    return goalRepository.delete(id, userId);
  }

  /**
   * Records savings toward a goal. Deliberately does not create a Transaction:
   * savings allocations must never inflate the user's expense reports.
   */
  async addContribution(
    goalId: string,
    userId: string,
    data: AddContributionDTO
  ): Promise<{ contribution: IGoalContribution; goal: IGoal } | null> {
    const goal = await goalRepository.findById(goalId, userId);
    if (!goal) return null;

    const amount = roundMoney(Number(data.amount));
    const contribution = await goalRepository.createContribution({
      goalId: new Types.ObjectId(goalId),
      amount,
      accountId: objectIdOrNull(data.accountId),
      contributionDate: toDate(data.contributionDate) ?? new Date(),
      note: data.note?.trim() || undefined,
    });

    const currentAmount = roundMoney(Math.max(0, Number(goal.currentAmount) || 0) + amount);
    const updated = await goalRepository.update(goalId, userId, {
      currentAmount,
      status: Number(goal.targetAmount) > 0 && currentAmount >= Number(goal.targetAmount)
        ? 'completed'
        : 'active',
    });

    return { contribution, goal: updated ? await this.reload(goalId, userId) : goal };
  }

  async removeContribution(
    goalId: string,
    userId: string,
    contributionId: string
  ): Promise<{ goal: IGoal } | null> {
    const goal = await goalRepository.findById(goalId, userId);
    if (!goal) return null;

    const contribution = await goalRepository.findContributionById(contributionId, goalId);
    if (!contribution) return null;

    await goalRepository.deleteContribution(contributionId, goalId);

    const currentAmount = roundMoney(
      Math.max(0, Number(goal.currentAmount) - Number(contribution.amount))
    );
    const updated = await goalRepository.update(goalId, userId, {
      currentAmount,
      status:
        Number(goal.targetAmount) > 0 && currentAmount >= Number(goal.targetAmount)
          ? 'completed'
          : 'active',
    });

    return { goal: updated ? await this.reload(goalId, userId) : goal };
  }
}

export const goalService = new GoalService();
export { toDate as parseGoalDate };
