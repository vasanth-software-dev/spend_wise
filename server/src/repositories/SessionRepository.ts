import { SessionModel } from '../models/Session.js';
import { ISession } from '../types/index.js';

export class SessionRepository {
  async create(sessionData: Partial<ISession>): Promise<ISession> {
    const session = new SessionModel(sessionData);
    return (await session.save()).toObject();
  }

  async findById(id: string): Promise<ISession | null> {
    return SessionModel.findById(id).lean();
  }

  async findActiveByUserId(userId: string): Promise<ISession[]> {
    return SessionModel.find({ userId, isValid: true }).sort({ lastActive: -1 }).lean();
  }

  async updateLastActive(id: string): Promise<void> {
    await SessionModel.findByIdAndUpdate(id, { $set: { lastActive: new Date() } });
  }

  async updateRefreshToken(
    id: string,
    refreshTokenHash: string,
    meta?: { userAgent?: string; ipAddress?: string; device?: string; browser?: string; os?: string }
  ): Promise<void> {
    await SessionModel.findByIdAndUpdate(id, {
      $set: {
        refreshTokenHash,
        lastActive: new Date(),
        ...(meta?.userAgent ? { userAgent: meta.userAgent } : {}),
        ...(meta?.ipAddress ? { ipAddress: meta.ipAddress } : {}),
        ...(meta?.device ? { device: meta.device } : {}),
        ...(meta?.browser ? { browser: meta.browser } : {}),
        ...(meta?.os ? { os: meta.os } : {}),
      },
    });
  }

  async invalidate(id: string): Promise<boolean> {
    const res = await SessionModel.findByIdAndUpdate(id, { $set: { isValid: false } });
    return !!res;
  }

  async invalidateAllForUser(userId: string, exceptSessionId?: string): Promise<number> {
    const query: Record<string, unknown> = { userId, isValid: true };
    if (exceptSessionId) {
      query._id = { $ne: exceptSessionId };
    }
    const res = await SessionModel.updateMany(query, { $set: { isValid: false } });
    return res.modifiedCount;
  }
}

export const sessionRepository = new SessionRepository();
