import { Schema, model } from 'mongoose';
import { IBudget } from '../types/index.js';

const budgetSchema = new Schema<IBudget>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null }, // null means total monthly budget
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    period: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    notificationThreshold: { type: Number, default: 80, min: 1, max: 100 }, // percentage
  },
  {
    timestamps: true,
  }
);

budgetSchema.index({ userId: 1, categoryId: 1, startDate: 1 });

export const BudgetModel = model<IBudget>('Budget', budgetSchema);
