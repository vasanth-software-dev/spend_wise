import { Schema, model } from 'mongoose';
import { IAuditLog } from '../types/index.js';

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    action: {
      type: String,
      enum: [
        'LOGIN',
        'LOGOUT',
        'PASSWORD_CHANGED',
        'EMAIL_CONNECTED',
        'EMAIL_DISCONNECTED',
        'SYNC_STARTED',
        'SYNC_COMPLETED',
        'SYNC_FAILED',
        'ACCOUNT_DELETED',
        'INBOUND_EMAIL_PROCESSED',
        'PASSKEY_REGISTERED',
        'PASSKEY_REMOVED',
      ],
      required: true,
      index: true,
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, expires: '90d' }, // 90 days retention
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLogModel = model<IAuditLog>('AuditLog', auditLogSchema);
