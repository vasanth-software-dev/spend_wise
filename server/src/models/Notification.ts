import { Schema, model } from 'mongoose';
import { INotification } from '../types/index.js';

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'detected_transaction',
        'budget_warning',
        'budget_exceeded',
        'sync_completed',
        'sync_failed',
        'system',
      ],
      required: true,
      default: 'system',
    },
    data: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const NotificationModel = model<INotification>('Notification', notificationSchema);
