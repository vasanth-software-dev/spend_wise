import { describe, it, expect } from 'vitest';
import {
  roundTo2Decimals,
  safeAdd,
  safeSubtract,
  calculateSavings,
  calculateSavingsRate,
  calculatePercentage,
  formatINR,
} from '../src/utils/currency.js';

describe('Financial Calculation Utilities', () => {
  it('handles floating point precision safely', () => {
    // 0.1 + 0.2 in JS is 0.30000000000000004
    expect(safeAdd(0.1, 0.2)).toBe(0.3);
    expect(safeSubtract(0.3, 0.1)).toBe(0.2);
    expect(roundTo2Decimals(199.999)).toBe(200);
  });

  it('calculates savings and savings rate correctly', () => {
    const income = 125000;
    const expense = 45000;
    const savings = calculateSavings(income, expense);
    expect(savings).toBe(80000);

    const savingsRate = calculateSavingsRate(income, expense);
    expect(savingsRate).toBe(64); // 80000 / 125000 * 100 = 64%
  });

  it('safely handles zero or negative income without dividing by zero', () => {
    expect(calculateSavingsRate(0, 5000)).toBe(0);
    expect(calculateSavingsRate(-1000, 5000)).toBe(0);
    expect(calculatePercentage(50, 0)).toBe(0);
  });

  it('formats Indian Rupee numbers accurately (Lakhs and Crores)', () => {
    expect(formatINR(124500)).toBe('₹1,24,500');
    expect(formatINR(500)).toBe('₹500');
    expect(formatINR(10000000)).toBe('₹1,00,00,000'); // 1 crore
    expect(formatINR(-450)).toBe('-₹450');
  });
});
