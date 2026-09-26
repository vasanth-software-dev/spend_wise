import { Schema, model } from 'mongoose';
import { IEmailAccount } from '../types/index.js';

const emailAccountSchema = new Schema<IEmailAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: {
      type: String,
      enum: ['gmail', 'mock', 'outlook', 'yahoo', 'imap', 'forwarding'],
      required: true,
      default: 'gmail',
    },
    email: { type: String, required: true, trim: true, lowercase: true },
    providerAccountId: { type: String, trim: true },
    forwardingAddress: { type: String, trim: true, lowercase: true },
    forwardingToken: { type: String, trim: true, lowercase: true },
    lastVerificationCode: { type: String, trim: true },
    lastVerificationSubject: { type: String, trim: true },
    encryptedAccessToken: { type: String },
    encryptedRefreshToken: { type: String },
    tokenExpiresAt: { type: Date },
    status: {
      type: String,
      enum: ['active', 'paused', 'error', 'revoked'],
      default: 'active',
    },
    lastSyncAt: { type: Date },
    syncCursor: { type: String },
    syncError: { type: String },
    detectedCount: { type: Number, default: 0 },
    syncFrequencyMinutes: { type: Number, default: 60 },
  },
  {
    timestamps: true,
  }
);

emailAccountSchema.index({ userId: 1, email: 1 }, { unique: true });
emailAccountSchema.index({ provider: 1, providerAccountId: 1 });
emailAccountSchema.index({ forwardingToken: 1 }, { sparse: true });
emailAccountSchema.index({ forwardingAddress: 1 }, { sparse: true });

export const EmailAccountModel = model<IEmailAccount>('EmailAccount', emailAccountSchema);
