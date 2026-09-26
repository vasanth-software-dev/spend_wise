import { Schema, model } from 'mongoose';
import { IRecurringTransaction } from '../types/index.js';

const recurringTransactionSchema = new Schema<IRecurringTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true },
    type: { type: String, enum: ['expense', 'income', 'transfer'], default: 'expense' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    merchant: { type: String, required: true, trim: true },
    paymentMethod: {
      type: String,
      enum: ['upi', 'bank', 'cash', 'card', 'wallet', 'other'],
      default: 'upi',
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      default: 'monthly',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    nextDueDate: { type: Date, required: true, index: true },
    lastProcessedDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

recurringTransactionSchema.index({ userId: 1, isActive: 1, nextDueDate: 1 });

export const RecurringTransactionModel = model<IRecurringTransaction>(
  'RecurringTransaction',
  recurringTransactionSchema
);
