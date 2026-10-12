import { describe, it, expect } from 'vitest';
import { parseQuickTransaction } from '../quickTransactionParser.js';
import { Category } from '../../types/index.js';

describe('Quick Transaction Parser', () => {
  const mockCategories: Category[] = [
    { _id: 'cat_food', name: 'Food & Dining', type: 'expense', icon: 'Utensils', color: '#10b981', isDefault: true },
    { _id: 'cat_groceries', name: 'Groceries', type: 'expense', icon: 'ShoppingCart', color: '#6366f1', isDefault: true },
    { _id: 'cat_transport', name: 'Transport', type: 'expense', icon: 'Car', color: '#0ea5e9', isDefault: true },
    { _id: 'cat_salary', name: 'Salary', type: 'income', icon: 'Briefcase', color: '#10b981', isDefault: true },
    { _id: 'cat_shopping', name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#f59e0b', isDefault: true },
  ];

  it('correctly parses "Swiggy 420 food"', () => {
    const result = parseQuickTransaction('Swiggy 420 food', mockCategories);
    expect(result.amount).toBe(420);
    expect(result.merchant).toBe('Swiggy');
    expect(result.type).toBe('expense');
    expect(result.categoryId).toBe('cat_food');
    expect(result.paymentMethod).toBe('upi');
  });

  it('correctly parses "Salary 68000"', () => {
    const result = parseQuickTransaction('Salary 68000', mockCategories);
    expect(result.amount).toBe(68000);
    expect(result.type).toBe('income');
    expect(result.categoryId).toBe('cat_salary');
  });

  it('correctly parses "Uber 280 transport card"', () => {
    const result = parseQuickTransaction('Uber 280 transport card', mockCategories);
    expect(result.amount).toBe(280);
    expect(result.merchant).toBe('Uber');
    expect(result.type).toBe('expense');
    expect(result.paymentMethod).toBe('card');
    expect(result.categoryId).toBe('cat_transport');
  });

  it('correctly parses Indian rupee symbols like "₹1,250 Blinkit"', () => {
    const result = parseQuickTransaction('₹1,250 Blinkit', mockCategories);
    expect(result.amount).toBe(1250);
    expect(result.merchant).toBe('Blinkit');
    expect(result.categoryId).toBe('cat_groceries');
  });

  it('handles empty input gracefully', () => {
    const result = parseQuickTransaction('', mockCategories);
    expect(result.amount).toBeNull();
    expect(result.merchant).toBe('');
  });
});
