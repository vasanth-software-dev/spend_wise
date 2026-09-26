import { AuditLogModel } from '../models/AuditLog.js';
import { IAuditLog } from '../types/index.js';
import { Types } from 'mongoose';

export class AuditLogRepository {
  async log(data: Partial<IAuditLog>): Promise<IAuditLog> {
    const doc = new AuditLogModel(data);
    return (await doc.save()).toObject();
  }

  async findByUserId(userId: string, limit = 50): Promise<IAuditLog[]> {
    return AuditLogModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

export const auditLogRepository = new AuditLogRepository();
