import { GoalContributionModel, GoalModel } from '../models/Goal.js';
import { computeGoalMetrics } from '../services/GoalService.js';
import { GoalComputed, IGoal, IGoalContribution } from '../types/index.js';
import { Types } from 'mongoose';

/**
 * Repository results keep the plain `IGoal` shape: like `BudgetRepository` and
 * `RecurringRepository`, the resolved `Category` / `EmailAccount` refs are
 * returned on the wire while the typed layer keeps the raw ref union.
 */
export type GoalWithComputed = IGoal & {
  contributionCount: number;
  computed: GoalComputed;
};

export type GoalWithDetails = IGoal & {
  contributions: IGoalContribution[];
  computed: GoalComputed;
};

export class GoalRepository {
  async create(data: Partial<IGoal>): Promise<IGoal> {
    const doc = new GoalModel(data);
    return (await doc.save()).toObject();
  }

  async findById(id: string, userId: string): Promise<IGoal | null> {
    return GoalModel.findOne({ _id: id, userId })
      .populate('categoryId', 'name icon color')
      .populate('accountId', 'email provider')
      .lean();
  }

  async findByUserId(userId: string): Promise<GoalWithComputed[]> {
    const goals = await GoalModel.find({ userId: new Types.ObjectId(userId) })
      .populate('categoryId', 'name icon color')
      .populate('accountId', 'email provider')
      .sort({ createdAt: -1 })
      .lean();

    const counts = await GoalContributionModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { goalId: { $in: goals.map((g) => g._id) } } },
      { $group: { _id: '$goalId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    const now = new Date();

    return goals.map((goal) => ({
      ...goal,
      contributionCount: countMap.get(String(goal._id)) ?? 0,
      computed: computeGoalMetrics(goal, now),
    }));
  }

  /** Active goals whose deadline (`targetDate`) falls inside the given window. */
  async findWithTargetDateBetween(userId: string, start: Date, end: Date): Promise<IGoal[]> {
    return GoalModel.find({
      userId: new Types.ObjectId(userId),
      status: 'active',
      targetDate: { $ne: null, $gte: start, $lt: end },
    })
      .sort({ targetDate: 1 })
      .lean();
  }

  async findByIdWithContributions(
    id: string,
    userId: string
  ): Promise<GoalWithDetails | null> {
    const goal = await this.findById(id, userId);
    if (!goal) return null;

    const contributions = await GoalContributionModel.find({ goalId: goal._id })
      .populate('accountId', 'email provider')
      .sort({ contributionDate: -1, createdAt: -1 })
      .lean();

    return { ...goal, contributions, computed: computeGoalMetrics(goal) };
  }

  async update(id: string, userId: string, updateData: Partial<IGoal>): Promise<IGoal | null> {
    return GoalModel.findOneAndUpdate({ _id: id, userId }, { $set: updateData }, { new: true })
      .populate('categoryId', 'name icon color')
      .populate('accountId', 'email provider')
      .lean();
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const goal = await GoalModel.findOneAndDelete({ _id: id, userId });
    if (!goal) return false;
    await GoalContributionModel.deleteMany({ goalId: goal._id });
    return true;
  }

  async createContribution(data: Partial<IGoalContribution>): Promise<IGoalContribution> {
    const doc = new GoalContributionModel(data);
    return (await doc.save()).toObject();
  }

  async findContributionById(contributionId: string, goalId: string): Promise<IGoalContribution | null> {
    return GoalContributionModel.findOne({ _id: contributionId, goalId }).lean();
  }

  async deleteContribution(contributionId: string, goalId: string): Promise<boolean> {
    const res = await GoalContributionModel.findOneAndDelete({ _id: contributionId, goalId });
    return !!res;
  }
}

export const goalRepository = new GoalRepository();
