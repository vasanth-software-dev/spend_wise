import { NotificationModel } from '../models/Notification.js';
import { INotification } from '../types/index.js';
import { Types } from 'mongoose';

export class NotificationRepository {
  async create(data: Partial<INotification>): Promise<INotification> {
    const doc = new NotificationModel(data);
    return (await doc.save()).toObject();
  }

  async findByUserId(userId: string, limit = 50): Promise<INotification[]> {
    return NotificationModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async markAsRead(id: string, userId: string): Promise<INotification | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true } },
      { new: true }
    ).lean();
  }

  async markAllAsRead(userId: string): Promise<number> {
    const res = await NotificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true } }
    );
    return res.modifiedCount;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return NotificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      isRead: false,
    });
  }
}

export const notificationRepository = new NotificationRepository();
