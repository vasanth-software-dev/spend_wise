import { accountRepository, NetWorthSummary } from '../repositories/AccountRepository.js';
import { IAccount } from '../types/index.js';
import { Types } from 'mongoose';

export class AccountService {
  async getAll(userId: string): Promise<IAccount[]> {
    return accountRepository.findByUserId(userId);
  }

  async getById(id: string, userId: string): Promise<IAccount | null> {
    return accountRepository.findById(id, userId);
  }

  async create(userId: string, data: Partial<IAccount>): Promise<IAccount> {
    return accountRepository.create({
      userId: new Types.ObjectId(userId),
      name: data.name ? data.name.trim() : 'Account',
      type: data.type || 'bank',
      balance: data.balance !== undefined ? Number(data.balance) : 0,
      currency: data.currency || 'INR',
      institutionName: data.institutionName?.trim() || undefined,
      accountNumberMasked: data.accountNumberMasked?.trim() || undefined,
      isDefault: !!data.isDefault,
      color: data.color,
      notes: data.notes?.trim() || undefined,
      isActive: true,
    });
  }

  async update(id: string, userId: string, data: Partial<IAccount>): Promise<IAccount | null> {
    const payload: Partial<IAccount> = {};
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.type !== undefined) payload.type = data.type;
    if (data.balance !== undefined) payload.balance = Number(data.balance);
    if (data.currency !== undefined) payload.currency = data.currency;
    if (data.institutionName !== undefined) payload.institutionName = data.institutionName?.trim() || undefined;
    if (data.accountNumberMasked !== undefined) payload.accountNumberMasked = data.accountNumberMasked?.trim() || undefined;
    if (data.isDefault !== undefined) payload.isDefault = !!data.isDefault;
    if (data.color !== undefined) payload.color = data.color;
    if (data.notes !== undefined) payload.notes = data.notes?.trim() || undefined;
    if (data.isActive !== undefined) payload.isActive = !!data.isActive;

    return accountRepository.update(id, userId, payload);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    return accountRepository.delete(id, userId);
  }

  async getNetWorth(userId: string): Promise<NetWorthSummary> {
    return accountRepository.getNetWorthSummary(userId);
  }
}

export const accountService = new AccountService();
