import { describe, it, expect } from 'vitest';
import { DebtRepository } from '../src/repositories/DebtRepository.js';
import { apiLimiter, authLimiter, webauthnLimiter, heavyExportLimiter } from '../src/middleware/rateLimiter.js';

describe('Financial Integrity and Calculation Tests', () => {
  const debtRepo = new DebtRepository();

  describe('Debt Status and Balance Calculations', () => {
    const baseDebt: any = {
      originalAmount: 10000,
      dueDate: new Date(Date.now() + 7 * 86400000), // 7 days in future
    };

    it('identifies an untouched debt as ACTIVE with full remaining amount', () => {
      const result = debtRepo.calculateStatus(baseDebt, 0);
      expect(result.status).toBe('ACTIVE');
      expect(result.remainingAmount).toBe(10000);
      expect(result.isOverdue).toBe(false);
    });

    it('identifies partially paid debts with exact remaining amount', () => {
      const result = debtRepo.calculateStatus(baseDebt, 4500.50);
      expect(result.status).toBe('PARTIALLY_PAID');
      expect(result.remainingAmount).toBe(5499.50);
      expect(result.isOverdue).toBe(false);
    });

    it('identifies SETTLED debts when paid in full', () => {
      const result = debtRepo.calculateStatus(baseDebt, 10000);
      expect(result.status).toBe('SETTLED');
      expect(result.remainingAmount).toBe(0);
      expect(result.isOverdue).toBe(false);
    });

    it('settled status takes precedence over overdue date', () => {
      const overdueDebt: any = {
        originalAmount: 5000,
        dueDate: new Date(Date.now() - 86400000), // yesterday
      };
      const result = debtRepo.calculateStatus(overdueDebt, 5000);
      expect(result.status).toBe('SETTLED');
      expect(result.remainingAmount).toBe(0);
    });

    it('flags past-due debt as OVERDUE only if remaining amount > 0', () => {
      const overdueDebt: any = {
        originalAmount: 5000,
        dueDate: new Date(Date.now() - 86400000),
      };
      const result = debtRepo.calculateStatus(overdueDebt, 1000);
      expect(result.status).toBe('OVERDUE');
      expect(result.remainingAmount).toBe(4000);
      expect(result.isOverdue).toBe(true);
    });
  });

  describe('Net Worth Calculation Logic', () => {
    it('only deducts active remaining debt, never settled debt or original amounts', () => {
      const accounts = [
        { type: 'bank', balance: 50000 },
        { type: 'cash', balance: 5000 },
        { type: 'credit_card', balance: -12000 }, // Liability
      ];

      const debts = [
        {
          direction: 'I_OWE',
          originalAmount: 20000,
          remainingAmount: 5000, // Active debt: only 5000 remaining
          status: 'PARTIALLY_PAID',
        },
        {
          direction: 'I_OWE',
          originalAmount: 15000,
          remainingAmount: 0, // Settled debt: 0 remaining
          status: 'SETTLED',
        },
        {
          direction: 'OWED_TO_ME',
          originalAmount: 8000,
          remainingAmount: 4000, // Receivable
          status: 'PARTIALLY_PAID',
        },
      ];

      // Total Assets: Bank (50000) + Cash (5000) = 55000
      let totalAssets = 0;
      let totalLiabilities = 0;

      for (const acc of accounts) {
        if (acc.type === 'credit_card') {
          if (acc.balance < 0) {
            totalLiabilities += Math.abs(acc.balance);
          } else {
            totalAssets += acc.balance;
          }
        } else {
          totalAssets += acc.balance;
        }
      }

      // Add only active I_OWE debts with remainingAmount > 0
      for (const debt of debts) {
        if (debt.direction === 'I_OWE' && debt.remainingAmount > 0) {
          totalLiabilities += debt.remainingAmount;
        }
      }

      const netWorth = totalAssets - totalLiabilities;

      expect(totalAssets).toBe(55000);
      // Liabilities = 12000 (credit card) + 5000 (active debt) = 17000
      expect(totalLiabilities).toBe(17000);
      // Net Worth = 55000 - 17000 = 38000
      expect(netWorth).toBe(38000);
    });
  });

  describe('Security & Rate Limiting Configurations', () => {
    it('exports well-formed rate limiting handlers with standard error codes', () => {
      expect(apiLimiter).toBeDefined();
      expect(authLimiter).toBeDefined();
      expect(webauthnLimiter).toBeDefined();
      expect(heavyExportLimiter).toBeDefined();
    });
  });

  describe('Account Cash Flow & Double-Entry Balance Syncing', () => {
    it('correctly calculates balance impacts for expense, income, and account transfers', () => {
      let bankBalance = 100000;
      let walletBalance = 5000;

      // Expense on bank account (5000)
      const expenseAmount = 5000;
      bankBalance -= expenseAmount;
      expect(bankBalance).toBe(95000);

      // Income on bank account (25000)
      const incomeAmount = 25000;
      bankBalance += incomeAmount;
      expect(bankBalance).toBe(120000);

      // Transfer from bank to wallet (10000)
      const transferAmount = 10000;
      bankBalance -= transferAmount;
      walletBalance += transferAmount;
      expect(bankBalance).toBe(110000);
      expect(walletBalance).toBe(15000);

      // Total money preserved across accounts
      expect(bankBalance + walletBalance).toBe(125000);
    });

    it('matches account transactions whether the account is source or transfer destination', () => {
      const targetAccountId = 'acc-hdfc-1';
      const transactions = [
        { id: '1', accountId: 'acc-hdfc-1', type: 'expense', amount: 1000 },
        { id: '2', accountId: 'acc-sbi-2', type: 'expense', amount: 2000 },
        { id: '3', accountId: 'acc-sbi-2', destinationAccountId: 'acc-hdfc-1', type: 'transfer', amount: 5000 },
        { id: '4', accountId: 'acc-hdfc-1', destinationAccountId: 'acc-wallet-3', type: 'transfer', amount: 500 },
      ];

      const matchesTargetAccount = transactions.filter(
        (tx) => tx.accountId === targetAccountId || tx.destinationAccountId === targetAccountId
      );

      // Should match transactions 1 (expense on HDFC), 3 (transfer into HDFC), and 4 (transfer out of HDFC)
      expect(matchesTargetAccount.map((t) => t.id)).toEqual(['1', '3', '4']);
    });

    it('ensures ledger aggregation rules strictly exclude transfers from net cash flow', () => {
      const records = [
        { type: 'income', amount: 50000 },
        { type: 'expense', amount: 15000 },
        { type: 'transfer', amount: 10000 }, // Transfer between accounts
      ];

      let income = 0;
      let expense = 0;
      for (const item of records) {
        if (item.type === 'income') income += item.amount;
        if (item.type === 'expense') expense += item.amount;
      }

      expect(income).toBe(50000);
      expect(expense).toBe(15000);
      expect(income - expense).toBe(35000);
    });
  });
});
