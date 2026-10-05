import { describe, it, expect } from 'vitest';
import {
  addMoney,
  subtractMoney,
  calculatePercentageChange,
  calculateMonthlyIncome,
  calculateMonthlyExpenses,
  calculateSavings,
  calculateSavingsRate,
  calculateSafeToSpend,
  calculateMonthlyComparison,
  calculateBudgetPacing,
  calculateFinancialHealthScore,
  generateSpendingInsights,
  calculateMerchantTotals,
} from '../financialCalculations.js';
import { Transaction, Budget } from '../../types/index.js';

describe('Financial Calculations Engine', () => {
  describe('Precision-safe arithmetic', () => {
    it('accurately adds decimal values without floating-point drift', () => {
      expect(addMoney(0.1, 0.2)).toBe(0.3);
      expect(addMoney(1250.5, 49.55)).toBe(1300.05);
    });

    it('accurately subtracts decimal values', () => {
      expect(subtractMoney(0.3, 0.1)).toBe(0.2);
      expect(subtractMoney(1000, 250.75)).toBe(749.25);
    });

    it('calculates percentage changes with positive and negative shifts', () => {
      expect(calculatePercentageChange(110, 100)).toBe(10);
      expect(calculatePercentageChange(80, 100)).toBe(-20);
      expect(calculatePercentageChange(100, 0)).toBe(100);
      expect(calculatePercentageChange(0, 0)).toBe(0);
    });
  });

  describe('Monthly Income, Expenses and Savings', () => {
    const fixedNow = new Date('2026-10-15T12:00:00Z');
    const mockTx: Transaction[] = [
      {
        _id: '1',
        userId: 'u1',
        type: 'income',
        amount: 68000,
        currency: 'INR',
        merchant: 'Tech Innovations',
        paymentMethod: 'bank',
        source: 'manual',
        transactionDate: '2026-10-01T10:00:00Z',
        status: 'confirmed',
        isRecurring: false,
        createdAt: '2026-10-01',
      },
      {
        _id: '2',
        userId: 'u1',
        type: 'expense',
        amount: 25150,
        currency: 'INR',
        merchant: 'Swiggy',
        paymentMethod: 'upi',
        source: 'manual',
        transactionDate: '2026-10-05T12:00:00Z',
        status: 'confirmed',
        isRecurring: false,
        createdAt: '2026-10-05',
      },
      {
        _id: '3',
        userId: 'u1',
        type: 'expense',
        amount: 5000,
        currency: 'INR',
        merchant: 'Old Tx',
        paymentMethod: 'upi',
        source: 'manual',
        transactionDate: '2026-09-15T12:00:00Z',
        status: 'confirmed',
        isRecurring: false,
        createdAt: '2026-09-15',
      },
    ];

    it('correctly aggregates current month income and expense', () => {
      const income = calculateMonthlyIncome(mockTx, fixedNow);
      const expenses = calculateMonthlyExpenses(mockTx, fixedNow);
      expect(income).toBe(68000);
      expect(expenses).toBe(25150);

      const savings = calculateSavings(income, expenses);
      expect(savings).toBe(42850);

      const savingsRate = calculateSavingsRate(income, expenses);
      expect(savingsRate).toBe(63); // 42850 / 68000 = 63%
    });

    it('handles zero income safely without NaN or infinity', () => {
      expect(calculateSavingsRate(0, 1000)).toBe(0);
      expect(calculateSavings(0, 1000)).toBe(-1000);
    });
  });

  describe('Safe to Spend Calculation', () => {
    it('computes safe to spend with upcoming obligations and daily recommended amount', () => {
      const fixedNow = new Date('2026-10-05T12:00:00Z');
      const result = calculateSafeToSpend({
        currentBalance: 42850,
        upcomingBills: [
          { amount: 22000, type: 'expense' },
          { amount: 649, type: 'expense' },
        ],
        plannedDebts: [
          { originalAmount: 3000, remainingAmount: 3000, direction: 'I_OWE' },
        ],
        cashBuffer: 4000,
        now: fixedNow,
      });

      // Total deductions: 22000 + 649 + 3000 + 4000 = 29649
      // Safe to spend: 42850 - 29649 = 13201
      expect(result.safeToSpend).toBe(13201);
      expect(result.daysRemaining).toBe(27); // 31 - 5 + 1 = 27 days
      expect(result.dailyRecommended).toBe(Math.round(13201 / 27));
      expect(result.plannedObligationsCount).toBe(3);
    });

    it('never produces negative safe to spend when obligations exceed balance', () => {
      const result = calculateSafeToSpend({
        currentBalance: 5000,
        upcomingBills: [{ amount: 20000, type: 'expense' }],
        cashBuffer: 2000,
      });

      expect(result.safeToSpend).toBe(0);
      expect(result.dailyRecommended).toBe(0);
    });
  });

  describe('Budget Pacing and Thresholds', () => {
    const budget: Budget = {
      _id: 'b1',
      userId: 'u1',
      name: 'Food & Dining',
      amount: 10000,
      period: 'monthly',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      notificationThreshold: 80,
      spent: 0,
      remaining: 10000,
      percentageUsed: 0,
      isExceeded: false,
      isWarning: false,
      categoryId: 'cat_food',
    };

    it('calculates pace warning when spending is projected to exceed budget', () => {
      // Day 10 of 31, spent ₹7,140 (71.4% in 10 days projects to ~₹22,134)
      const testNow = new Date('2026-10-10T12:00:00Z');
      const transactions: Transaction[] = [
        {
          _id: 't1',
          userId: 'u1',
          type: 'expense',
          amount: 7140,
          currency: 'INR',
          categoryId: 'cat_food',
          merchant: 'Swiggy',
          paymentMethod: 'upi',
          source: 'manual',
          transactionDate: '2026-10-05T12:00:00Z',
          status: 'confirmed',
          isRecurring: false,
          createdAt: '2026-10-05',
        },
      ];

      const pacing = calculateBudgetPacing(budget, transactions, testNow);
      expect(pacing.spent).toBe(7140);
      expect(pacing.remaining).toBe(2860);
      expect(pacing.percentageUsed).toBe(71.4);
      expect(pacing.isPaceExceeding).toBe(true);
      expect(pacing.paceMessage).toContain('At your current pace');
    });
  });

  describe('Deterministic Financial Health Score', () => {
    it('returns structured 0-100 score with explainable factors', () => {
      const health = calculateFinancialHealthScore({
        monthlyIncome: 68000,
        monthlyExpenses: 25150,
        savingsRate: 63,
        budgets: [],
        transactions: [],
        upcomingObligations: 12000,
        currentBalance: 42850,
      });

      expect(health.totalScore).toBeGreaterThanOrEqual(70);
      expect(health.grade).toBe('Excellent');
      expect(health.factors).toHaveLength(5);
      expect(health.factors[0].name).toBe('Savings Discipline');
      expect(health.factors[0].status).toBe('excellent');
    });
  });

  describe('Top Merchants Calculation', () => {
    it('aggregates merchants and compares against previous period', () => {
      const now = new Date('2026-10-10T12:00:00Z');
      const transactions: Transaction[] = [
        {
          _id: 't1',
          userId: 'u1',
          type: 'expense',
          amount: 3240,
          currency: 'INR',
          merchant: 'Swiggy',
          paymentMethod: 'upi',
          source: 'manual',
          transactionDate: '2026-10-02T12:00:00Z',
          status: 'confirmed',
          isRecurring: false,
          createdAt: '2026-10-02',
        },
        {
          _id: 't2',
          userId: 'u1',
          type: 'expense',
          amount: 2650,
          currency: 'INR',
          merchant: 'Swiggy',
          paymentMethod: 'upi',
          source: 'manual',
          transactionDate: '2026-09-12T12:00:00Z',
          status: 'confirmed',
          isRecurring: false,
          createdAt: '2026-09-12',
        },
      ];

      const merchants = calculateMerchantTotals(transactions, 5, now);
      expect(merchants).toHaveLength(1);
      expect(merchants[0].merchant).toBe('Swiggy');
      expect(merchants[0].totalAmount).toBe(3240);
      expect(merchants[0].previousAmount).toBe(2650);
      expect(merchants[0].changePercentage).toBe(22.3);
    });
  });

  describe('Monthly Comparison and Spending Insights', () => {
    it('compares current and previous month transactions and generates insights', () => {
      const now = new Date('2026-10-15T12:00:00Z');
      const transactions: Transaction[] = [
        {
          _id: 't1',
          userId: 'u1',
          type: 'income',
          amount: 68000,
          currency: 'INR',
          merchant: 'Employer',
          paymentMethod: 'bank',
          source: 'manual',
          transactionDate: '2026-10-01T10:00:00Z',
          status: 'confirmed',
          isRecurring: false,
          createdAt: '2026-10-01',
        },
        {
          _id: 't2',
          userId: 'u1',
          type: 'expense',
          amount: 25150,
          currency: 'INR',
          categoryId: 'cat1',
          merchant: 'Swiggy',
          paymentMethod: 'upi',
          source: 'manual',
          transactionDate: '2026-10-05T12:00:00Z',
          status: 'confirmed',
          isRecurring: false,
          createdAt: '2026-10-05',
        },
        {
          _id: 't3',
          userId: 'u1',
          type: 'income',
          amount: 65000,
          currency: 'INR',
          merchant: 'Employer',
          paymentMethod: 'bank',
          source: 'manual',
          transactionDate: '2026-09-01T10:00:00Z',
          status: 'confirmed',
          isRecurring: false,
          createdAt: '2026-09-01',
        },
        {
          _id: 't4',
          userId: 'u1',
          type: 'expense',
          amount: 31400,
          currency: 'INR',
          categoryId: 'cat1',
          merchant: 'Swiggy',
          paymentMethod: 'upi',
          source: 'manual',
          transactionDate: '2026-09-05T12:00:00Z',
          status: 'confirmed',
          isRecurring: false,
          createdAt: '2026-09-05',
        },
      ];

      const comparison = calculateMonthlyComparison(
        transactions,
        [{ _id: 'cat1', name: 'Food & Dining' }],
        now
      );

      expect(comparison.currentMonth.income).toBe(68000);
      expect(comparison.currentMonth.expenses).toBe(25150);
      expect(comparison.previousMonth.income).toBe(65000);
      expect(comparison.previousMonth.expenses).toBe(31400);
      expect(comparison.changes.expensesChangePercent).toBe(-19.9);

      const insights = generateSpendingInsights({
        monthlyComparison: comparison,
        budgets: [],
        transactions,
        upcomingBills: [],
        safeToSpend: {
          safeToSpend: 12450,
          dailyRecommended: 415,
          daysRemaining: 17,
          totalDaysInMonth: 31,
          currentBalance: 42850,
          upcomingObligations: 15000,
          plannedObligationsCount: 1,
          cashBuffer: 4000,
          explanation: 'Good',
        },
      });

      expect(insights.length).toBeGreaterThan(0);
      expect(insights.some((i) => i.id === 'spending-decreased')).toBe(true);
    });
  });
});
