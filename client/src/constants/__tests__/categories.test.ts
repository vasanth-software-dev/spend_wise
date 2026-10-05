import { describe, it, expect } from 'vitest';
import {
  resolveCategoryMeta,
  getCategoryColorStyle,
  buildCategoryOptions,
} from '../categories.js';

describe('getCategoryColorStyle', () => {
  it('correctly creates bg and border with alpha for standard 6-digit hex', () => {
    const style = getCategoryColorStyle('#f97316');
    expect(style.color).toBe('#f97316');
    expect(style.bg).toBe('#f973161f');
    expect(style.border).toBe('#f9731633');
  });

  it('expands 3-digit hex and applies alpha', () => {
    const style = getCategoryColorStyle('#abc');
    expect(style.color).toBe('#aabbcc');
    expect(style.bg).toBe('#aabbcc1f');
    expect(style.border).toBe('#aabbcc33');
  });

  it('handles hex without leading hash', () => {
    const style = getCategoryColorStyle('10b981');
    expect(style.color).toBe('#10b981');
    expect(style.bg).toBe('#10b9811f');
    expect(style.border).toBe('#10b98133');
  });

  it('handles empty or undefined color with slate default', () => {
    const style = getCategoryColorStyle(undefined);
    expect(style.color).toBe('#64748b');
    expect(style.bg).toBe('#64748b1f');
    expect(style.border).toBe('#64748b33');
  });
});

describe('resolveCategoryMeta', () => {
  const availableCategories = [
    {
      _id: 'cat-123',
      name: 'Custom Gaming',
      icon: 'Gamepad2',
      color: '#8b5cf6',
      type: 'expense' as const,
    },
    {
      _id: 'cat-456',
      name: 'Salary',
      icon: 'Briefcase',
      color: '#22c55e',
      type: 'income' as const,
    },
  ];

  it('resolves fully populated category object directly', () => {
    const meta = resolveCategoryMeta({
      _id: 'c1',
      name: 'Food & Dining',
      icon: 'Utensils',
      color: '#f97316',
    });

    expect(meta.name).toBe('Food & Dining');
    expect(meta.icon).toBe('Utensils');
    expect(meta.color).toBe('#f97316');
    expect(meta.bg).toBe('#f973161f');
    expect(meta.border).toBe('#f9731633');
  });

  it('resolves category by ID from availableCategories list', () => {
    const meta = resolveCategoryMeta('cat-123', availableCategories);

    expect(meta.name).toBe('Custom Gaming');
    expect(meta.icon).toBe('Gamepad2');
    expect(meta.color).toBe('#8b5cf6');
    expect(meta.bg).toBe('#8b5cf61f');
    expect(meta.border).toBe('#8b5cf633');
  });

  it('resolves category by name string from FALLBACK_CATEGORIES', () => {
    const meta = resolveCategoryMeta('Shopping');

    expect(meta.name).toBe('Shopping');
    expect(meta.icon).toBe('ShoppingCart');
    expect(meta.color).toBe('#ec4899');
    expect(meta.bg).toBe('#ec48991f');
    expect(meta.border).toBe('#ec489933');
  });

  it('fills in missing color/icon on object using available or fallback match', () => {
    const meta = resolveCategoryMeta(
      { _id: 'cat-456', name: 'Salary' },
      availableCategories
    );

    expect(meta.name).toBe('Salary');
    expect(meta.icon).toBe('Briefcase');
    expect(meta.color).toBe('#22c55e');
  });

  it('falls back to Uncategorized with neutral slate color for null or undefined', () => {
    const meta = resolveCategoryMeta(null);

    expect(meta.name).toBe('Uncategorized');
    expect(meta.icon).toBe('Tag');
    expect(meta.color).toBe('#64748b');
    expect(meta.bg).toBe('#64748b1f');
    expect(meta.border).toBe('#64748b33');
  });

  it('buildCategoryOptions assigns color and icon fallback when missing on custom item', () => {
    const { expense } = buildCategoryOptions([
      { name: 'Groceries', type: 'expense' },
    ]);
    expect(expense.length).toBeGreaterThan(0);
    const groceries = expense.find((e) => e.name === 'Groceries');
    expect(groceries?.color).toBe('#10b981');
    expect(groceries?.icon).toBe('ShoppingBag');
  });
});
