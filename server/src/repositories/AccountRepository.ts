import { Types } from 'mongoose';
import { AccountModel } from '../models/Account.js';
import { DebtModel } from '../models/Debt.js';
import { IAccount } from '../types/index.js';

export interface NetWorthSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  assetsBreakdown: {
    bank: number;
    cash: number;
    wallet: number;
    investment: number;
    other: number;
    receivables: number;
  };
  liabilitiesBreakdown: {
    creditCards: number;
    debtsOwed: number;
    otherLoans: number;
  };
}

export class AccountRepository {
  async findByUserId(userId: string): Promise<IAccount[]> {
    return AccountModel.find({ userId: new Types.ObjectId(userId), isActive: true })
      .sort({ isDefault: -1, type: 1, name: 1 })
      .lean();
  }

  async findById(id: string, userId: string): Promise<IAccount | null> {
    return AccountModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    }).lean();
  }

  async create(data: Partial<IAccount>): Promise<IAccount> {
    const doc = new AccountModel(data);
    return (await doc.save()).toObject();
  }

  async update(id: string, userId: string, data: Partial<IAccount>): Promise<IAccount | null> {
    return AccountModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      { $set: data },
      { new: true }
    ).lean();
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const res = await AccountModel.deleteOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    return res.deletedCount > 0;
  }

  async getNetWorthSummary(userId: string): Promise<NetWorthSummary> {
    const userObjId = new Types.ObjectId(userId);

    const accounts = await AccountModel.find({ userId: userObjId, isActive: true }).lean();
    const debts = await DebtModel.find({ userId: userObjId }).lean();

    let bank = 0;
    let cash = 0;
    let wallet = 0;
    let investment = 0;
    let otherAssets = 0;
    let creditCards = 0;
    let otherLoans = 0;

    for (const acc of accounts) {
      const bal = Number(acc.balance) || 0;
      if (acc.type === 'credit_card') {
        creditCards += Math.abs(bal);
      } else if (bal < 0) {
        otherLoans += Math.abs(bal);
      } else {
        switch (acc.type) {
          case 'bank':
            bank += bal;
            break;
          case 'cash':
            cash += bal;
            break;
          case 'wallet':
            wallet += bal;
            break;
          case 'investment':
            investment += bal;
            break;
          default:
            otherAssets += bal;
            break;
        }
      }
    }

    let debtsOwed = 0;
    let receivables = 0;

    for (const d of debts) {
      const amt = Number(d.originalAmount) || 0;
      if (d.direction === 'I_OWE') {
        debtsOwed += amt;
      } else if (d.direction === 'OWED_TO_ME') {
        receivables += amt;
      }
    }

    const totalAssets = Math.round((bank + cash + wallet + investment + otherAssets + receivables) * 100) / 100;
    const totalLiabilities = Math.round((creditCards + debtsOwed + otherLoans) * 100) / 100;
    const netWorth = Math.round((totalAssets - totalLiabilities) * 100) / 100;

    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      assetsBreakdown: {
        bank: Math.round(bank * 100) / 100,
        cash: Math.round(cash * 100) / 100,
        wallet: Math.round(wallet * 100) / 100,
        investment: Math.round(investment * 100) / 100,
        other: Math.round(otherAssets * 100) / 100,
        receivables: Math.round(receivables * 100) / 100,
      },
      liabilitiesBreakdown: {
        creditCards: Math.round(creditCards * 100) / 100,
        debtsOwed: Math.round(debtsOwed * 100) / 100,
        otherLoans: Math.round(otherLoans * 100) / 100,
      },
    };
  }
}

export const accountRepository = new AccountRepository();
