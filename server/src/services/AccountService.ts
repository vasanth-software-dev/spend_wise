import { accountRepository, NetWorthSummary } from '../repositories/AccountRepository.js';
import { IAccount } from '../types/index.js';

export class AccountService {
  async getAll(userId: string): Promise<IAccount[]> {
    return accountRepository.findByUserId(userId);
  }

  async getById(id: string, userId: string): Promise<IAccount | null> {
    return accountRepository.findById(id, userId);
  }

  async create(userId: string, data: Partial<IAccount>): Promise<IAccount> {
    return accountRepository.create({
      ...data,
      userId,
    });
  }

  async update(id: string, userId: string, data: Partial<IAccount>): Promise<IAccount | null> {
    return accountRepository.update(id, userId, data);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    return accountRepository.delete(id, userId);
  }

  async getNetWorth(userId: string): Promise<NetWorthSummary> {
    return accountRepository.getNetWorthSummary(userId);
  }
}

export const accountService = new AccountService();
