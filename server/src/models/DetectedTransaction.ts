import { Schema, model } from 'mongoose';
import { IDetectedTransaction } from '../types/index.js';

const detectedTransactionSchema = new Schema<IDetectedTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    emailAccountId: { type: Schema.Types.ObjectId, ref: 'EmailAccount', required: true },
    emailMessageId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR', uppercase: true },
    merchant: { type: String, required: true, trim: true },
    transactionDate: { type: Date, required: true },
    transactionType: { type: String, enum: ['expense', 'income'], default: 'expense' },
    upiReference: { type: String, trim: true, default: null },
    bankReference: { type: String, trim: true, default: null },
    sender: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    rawMetadata: { type: Schema.Types.Mixed, default: {} },
    confidenceScore: { type: Number, required: true, min: 0, max: 100 },
    suggestedCategory: { type: String, trim: true, default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    status: {
      type: String,
      enum: ['detected', 'confirmed', 'rejected', 'duplicate'],
      default: 'detected',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

detectedTransactionSchema.index({ userId: 1, status: 1 });
detectedTransactionSchema.index({ userId: 1, emailAccountId: 1 });
detectedTransactionSchema.index({ userId: 1, upiReference: 1 });
detectedTransactionSchema.index({ userId: 1, emailMessageId: 1 }, { unique: true });

export const DetectedTransactionModel = model<IDetectedTransaction>(
  'DetectedTransaction',
  detectedTransactionSchema
);
