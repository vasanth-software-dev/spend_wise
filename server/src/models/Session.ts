import { Schema, model } from 'mongoose';
import { ISession } from '../types/index.js';

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    userAgent: { type: String, default: 'Unknown' },
    ipAddress: { type: String, default: '127.0.0.1' },
    device: { type: String, default: 'Desktop' },
    browser: { type: String, default: 'Browser' },
    os: { type: String, default: 'Operating System' },
    lastActive: { type: Date, default: Date.now },
    isValid: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ userId: 1, isValid: 1 });

export const SessionModel = model<ISession>('Session', sessionSchema);
