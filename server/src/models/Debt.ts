import { Schema, model } from 'mongoose';
import { IDebt, IDebtPayment } from '../types/index.js';

const debtPaymentSchema = new Schema<IDebtPayment>(
  {
    debtId: { type: Schema.Types.ObjectId, ref: 'Debt', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, required: true, default: Date.now },
    accountId: { type: Schema.Types.ObjectId, ref: 'EmailAccount', default: null },
    note: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

debtPaymentSchema.index({ debtId: 1, paymentDate: -1 });

const debtSchema = new Schema<IDebt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    personName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    originalAmount: { type: Number, required: true, min: 0.01 },
    direction: {
      type: String,
      enum: ['I_OWE', 'OWED_TO_ME'],
      required: true,
      index: true,
    },
    debtDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, default: null, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    accountId: { type: Schema.Types.ObjectId, ref: 'EmailAccount', default: null },
    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

debtSchema.index({ userId: 1, direction: 1 });
debtSchema.index({ userId: 1, dueDate: 1 });
debtSchema.index({ userId: 1, createdAt: -1 });
debtSchema.index({ userId: 1, personName: 1 });

export const DebtModel = model<IDebt>('Debt', debtSchema);
export const DebtPaymentModel = model<IDebtPayment>('DebtPayment', debtPaymentSchema);