import { Schema, model } from 'mongoose';
import { ITransaction } from '../types/index.js';

const transactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['expense', 'income', 'transfer'],
      required: true,
      default: 'expense',
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    subcategoryId: { type: Schema.Types.ObjectId, default: null },
    merchant: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    paymentMethod: {
      type: String,
      enum: ['upi', 'bank', 'cash', 'card', 'wallet', 'other'],
      default: 'upi',
    },
    // `receipt_scan` is an attribution label only: no receipt image is ever
    // persisted. There is deliberately no `receipt_image_url` field.
    source: {
      type: String,
      enum: ['manual', 'email', 'import', 'receipt_scan'],
      default: 'manual',
    },
    sourceAccountId: { type: Schema.Types.ObjectId, ref: 'EmailAccount', default: null },
    externalTransactionId: { type: String, trim: true, default: null },
    refNo: { type: String, trim: true, default: null },
    transactionDate: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'ignored'],
      default: 'confirmed',
    },
    isRecurring: { type: Boolean, default: false },
    recurringTransactionId: { type: Schema.Types.ObjectId, ref: 'RecurringTransaction', default: null },
    personId: { type: Schema.Types.ObjectId, ref: 'Person', default: null, index: true },
    vpa: { type: String, trim: true, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual alias for person_id
transactionSchema.virtual('person_id').get(function () {
  return this.personId;
});

// Pre-save hook to keep refNo and externalTransactionId in sync
transactionSchema.pre('save', function (next) {
  if (this.refNo && !this.externalTransactionId) {
    this.externalTransactionId = this.refNo;
  } else if (this.externalTransactionId && !this.refNo) {
    this.refNo = this.externalTransactionId;
  }
  next();
});

// Indexed queries
transactionSchema.index({ userId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, categoryId: 1 });
transactionSchema.index({ userId: 1, source: 1 });
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ userId: 1, externalTransactionId: 1 });
transactionSchema.index({ userId: 1, refNo: 1 });
transactionSchema.index({ userId: 1, personId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, merchant: 'text', description: 'text', notes: 'text' });

export const TransactionModel = model<ITransaction>('Transaction', transactionSchema);
