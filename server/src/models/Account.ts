import { Schema, model } from 'mongoose';
import { IAccount } from '../types/index.js';

const accountSchema = new Schema<IAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['bank', 'cash', 'credit_card', 'wallet', 'investment', 'other'],
      required: true,
      default: 'bank',
    },
    balance: { type: Number, required: true, default: 0 },
    currency: { type: String, default: 'INR', uppercase: true },
    institutionName: { type: String, trim: true, default: '' },
    accountNumberMasked: { type: String, trim: true, default: '' },
    color: { type: String, default: '#10b981' },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
  }
);

accountSchema.index({ userId: 1, isActive: 1 });
accountSchema.index({ userId: 1, type: 1 });

export const AccountModel = model<IAccount>('Account', accountSchema);
