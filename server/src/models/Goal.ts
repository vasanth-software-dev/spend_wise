import { Schema, model } from 'mongoose';
import { IGoal, IGoalContribution } from '../types/index.js';

const goalContributionSchema = new Schema<IGoalContribution>(
  {
    goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    accountId: { type: Schema.Types.ObjectId, ref: 'EmailAccount', default: null },
    contributionDate: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

goalContributionSchema.index({ goalId: 1, contributionDate: -1 });

const goalSchema = new Schema<IGoal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    targetAmount: { type: Number, required: true, min: 0.01 },
    currentAmount: { type: Number, default: 0, min: 0 },
    targetDate: { type: Date, default: null },
    monthlyContribution: { type: Number, default: null, min: 0 },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    accountId: { type: Schema.Types.ObjectId, ref: 'EmailAccount', default: null },
    icon: { type: String, default: 'Target' },
    color: { type: String, default: '#10b981' },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

goalSchema.index({ userId: 1, status: 1, createdAt: -1 });
goalSchema.index({ userId: 1, targetDate: 1 });

export const GoalModel = model<IGoal>('Goal', goalSchema);
export const GoalContributionModel = model<IGoalContribution>(
  'GoalContribution',
  goalContributionSchema
);
