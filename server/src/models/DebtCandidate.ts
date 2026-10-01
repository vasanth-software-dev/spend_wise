import { Schema, model } from 'mongoose';
import {
  IDebtCandidate,
  DebtCandidateStatus,
  DebtCandidateMatch,
  DebtDirection,
} from '../types/index.js';

const debtCandidateSchema = new Schema<IDebtCandidate>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    personId: { type: Schema.Types.ObjectId, ref: 'Person', default: null, index: true },
    personName: { type: String, required: true, trim: true },
    vpa: { type: String, trim: true, lowercase: true, default: null },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'INR' },
    direction: {
      type: String,
      enum: ['I_OWE', 'OWED_TO_ME'],
      required: true,
    },
    transactionDate: { type: Date, required: true },
    source: { type: String, enum: ['email', 'import'], required: true },
    refNo: { type: String, trim: true, default: null },
    refNoNormalized: { type: String, default: null },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', default: null },
    sourceAccountId: { type: Schema.Types.ObjectId, ref: 'EmailAccount', default: null },
    merchant: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'MATCHED', 'IGNORED'],
      default: 'PENDING',
      index: true,
    },
    match: {
      type: String,
      enum: ['EXACT_SETTLEMENT', 'PARTIAL_PAYMENT', 'NO_MATCH'],
      default: 'NO_MATCH',
    },
    suggestedDebtId: { type: Schema.Types.ObjectId, ref: 'Debt', default: null },
    suggestedDebtRemaining: { type: Number, default: null },
    confidence: { type: Number, default: 50, min: 0, max: 100 },
    resolvedDebtId: { type: Schema.Types.ObjectId, ref: 'Debt', default: null },
    resolvedPaymentId: { type: Schema.Types.ObjectId, ref: 'DebtPayment', default: null },
  },
  {
    timestamps: true,
  }
);

debtCandidateSchema.index({ userId: 1, status: 1, createdAt: -1 });
debtCandidateSchema.index({ userId: 1, refNo: 1 });

/**
 * The UPI reference number is the primary dedupe key: the same P2P payment can
 * be seen twice (once as a bank email, once in a statement import) with the
 * reference formatted differently, so we index the normalized form.
 */
debtCandidateSchema.index(
  { userId: 1, refNoNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { refNoNormalized: { $type: 'string' } },
  }
);

debtCandidateSchema.index({ userId: 1, personId: 1, transactionDate: -1 });

export type DebtCandidateDocument = IDebtCandidate & { refNoNormalized?: string };

export const DebtCandidateModel = model<IDebtCandidate>('DebtCandidate', debtCandidateSchema);