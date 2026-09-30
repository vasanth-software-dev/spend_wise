import { EmailAccountModel } from '../models/EmailAccount.js';
import { IEmailAccount } from '../types/index.js';
import { Types } from 'mongoose';

export class EmailAccountRepository {
  async create(data: Partial<IEmailAccount>): Promise<IEmailAccount> {
    const doc = new EmailAccountModel(data);
    return (await doc.save()).toObject();
  }

  async findById(id: string, userId: string): Promise<IEmailAccount | null> {
    return EmailAccountModel.findOne({ _id: id, userId }).lean();
  }

  async findByUserId(userId: string): Promise<IEmailAccount[]> {
    return EmailAccountModel.find({ userId: new Types.ObjectId(userId) })
      .select('-encryptedAccessToken -encryptedRefreshToken') // Never expose tokens
      .sort({ createdAt: -1 })
      .lean();
  }

  async findByEmail(userId: string, email: string): Promise<IEmailAccount | null> {
    return EmailAccountModel.findOne({ userId, email: email.toLowerCase() }).lean();
  }

  async findByForwardingToken(token: string): Promise<IEmailAccount | null> {
    return EmailAccountModel.findOne({ forwardingToken: token.toLowerCase() }).lean();
  }

  async findByForwardingAddress(address: string): Promise<IEmailAccount | null> {
    const clean = address.toLowerCase().trim();
    return EmailAccountModel.findOne({
      $or: [
        { forwardingAddress: clean },
        { email: clean, provider: 'forwarding' },
      ],
    }).lean();
  }

  async findForwardingByUserId(userId: string): Promise<IEmailAccount | null> {
    return EmailAccountModel.findOne({ userId: new Types.ObjectId(userId), provider: 'forwarding' }).lean();
  }

  async update(id: string, userId: string, updateData: Partial<IEmailAccount>): Promise<IEmailAccount | null> {
    return EmailAccountModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: updateData },
      { new: true }
    ).lean();
  }

  async updateSyncStatus(
    id: string,
    lastSyncAt: Date,
    syncCursor?: string,
    detectedIncrement = 0,
    syncError?: string | null
  ): Promise<void> {
    const update: Record<string, unknown> = {
      lastSyncAt,
      ...(syncCursor ? { syncCursor } : {}),
      syncError: syncError || null,
      status: syncError ? 'error' : 'active',
    };
    if (detectedIncrement > 0) {
      update.$inc = { detectedCount: detectedIncrement };
    }
    await EmailAccountModel.findByIdAndUpdate(id, update);
  }

  async findAccountsDueForSync(defaultFrequencyMinutes = 3): Promise<IEmailAccount[]> {
    const now = new Date();
    const accounts = await EmailAccountModel.find({
      status: 'active',
      provider: { $in: ['gmail', 'mock'] },
    }).lean();

    return accounts.filter((acc) => {
      if (!acc.lastSyncAt) return true;
      const freq = acc.syncFrequencyMinutes ? Math.min(acc.syncFrequencyMinutes, defaultFrequencyMinutes) : defaultFrequencyMinutes;
      const nextDue = new Date(acc.lastSyncAt.getTime() + freq * 60 * 1000);
      return now >= nextDue;
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await EmailAccountModel.findOneAndDelete({ _id: id, userId });
    return !!res;
  }
}

export const emailAccountRepository = new EmailAccountRepository();
