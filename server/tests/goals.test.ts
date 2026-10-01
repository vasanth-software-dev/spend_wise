import { describe, it, expect } from 'vitest';
import {
  computeGoalMetrics,
  monthsBetween,
  roundMoney,
} from '../src/services/GoalService.js';
import { projectOccurrences, getDayRange, toDayKey } from '../src/services/CalendarService.js';
import { createGoalSchema, addContributionSchema } from '../src/validators/goalValidators.js';

const NOW = new Date(2026, 0, 15); // 15 Jan 2026

const goal = (over: Record<string, unknown> = {}) => ({
  targetAmount: 100000,
  currentAmount: 0,
  targetDate: null as Date | null,
  monthlyContribution: null as number | null,
  ...over,
});

describe('goal calculations', () => {
  it('computes progress as saved over target', () => {
    const m = computeGoalMetrics(goal({ targetAmount: 75000, currentAmount: 25000 }), NOW);
    expect(m.percentageComplete).toBe(33.33);
    expect(m.remainingAmount).toBe(50000);
  });

  it('computes remaining as target minus saved', () => {
    const m = computeGoalMetrics(goal({ targetAmount: 50000, currentAmount: 12000 }), NOW);
    expect(m.remainingAmount).toBe(38000);
  });

  it('spreads remaining over the months left', () => {
    const m = computeGoalMetrics(
      goal({ targetAmount: 100000, currentAmount: 0, targetDate: new Date(2026, 6, 15) }),
      NOW
    );
    expect(m.monthsRemaining).toBe(6);
    expect(m.requiredMonthlyContribution).toBe(16666.67);
  });

  it('rounds money to two decimals', () => {
    expect(roundMoney(16666.666666)).toBe(16666.67);
    expect(roundMoney(1000.005)).toBe(1000.01);
  });

  describe('edge cases', () => {
    it('marks a fully funded goal complete with zero remaining', () => {
      const m = computeGoalMetrics(goal({ targetAmount: 10000, currentAmount: 10000 }), NOW);
      expect(m.isCompleted).toBe(true);
      expect(m.remainingAmount).toBe(0);
      expect(m.percentageComplete).toBe(100);
      expect(m.requiredMonthlyContribution).toBe(0);
    });

    it('caps progress at 100 when overfunded', () => {
      const m = computeGoalMetrics(goal({ targetAmount: 10000, currentAmount: 15000 }), NOW);
      expect(m.percentageComplete).toBe(100);
      expect(m.remainingAmount).toBe(0);
    });

    it('flags a passed target date as overdue and skips monthly maths', () => {
      const m = computeGoalMetrics(
        goal({ targetAmount: 10000, currentAmount: 2000, targetDate: new Date(2025, 10, 1) }),
        NOW
      );
      expect(m.isOverdue).toBe(true);
      expect(m.isCompleted).toBe(false);
      expect(m.monthsRemaining).toBe(0);
      expect(m.requiredMonthlyContribution).toBeNull();
    });

    it('returns null months and monthly need when no target date is set', () => {
      const m = computeGoalMetrics(goal({ targetAmount: 10000, currentAmount: 1000 }), NOW);
      expect(m.monthsRemaining).toBeNull();
      expect(m.requiredMonthlyContribution).toBeNull();
    });

    it('treats a very short target period as one month instead of dividing by zero', () => {
      const m = computeGoalMetrics(
        goal({ targetAmount: 10000, currentAmount: 0, targetDate: new Date(2026, 0, 20) }),
        NOW
      );
      expect(m.monthsRemaining).toBe(1);
      expect(m.requiredMonthlyContribution).toBe(10000);
    });

    it('handles a zero target without dividing by zero', () => {
      const m = computeGoalMetrics(goal({ targetAmount: 0, currentAmount: 0 }), NOW);
      expect(m.percentageComplete).toBe(0);
      expect(m.isCompleted).toBe(false);
    });

    it('treats a negative stored amount as zero', () => {
      const m = computeGoalMetrics(goal({ targetAmount: 10000, currentAmount: -500 }), NOW);
      expect(m.currentAmount).toBe(0);
      expect(m.remainingAmount).toBe(10000);
    });

    it('projects completion from the planned monthly contribution', () => {
      const m = computeGoalMetrics(
        goal({ targetAmount: 100000, currentAmount: 0, monthlyContribution: 10000 }),
        NOW
      );
      expect(m.expectedCompletionDate).not.toBeNull();
      expect(m.expectedCompletionDate!.getMonth()).toBe(10); // Nov 2026 (10 x 10k)
      expect(m.expectedCompletionDate!.getFullYear()).toBe(2026);
    });

    it('returns no completion projection without a monthly plan', () => {
      const m = computeGoalMetrics(goal({ targetAmount: 100000, currentAmount: 0 }), NOW);
      expect(m.expectedCompletionDate).toBeNull();
    });
  });
});

describe('monthsBetween', () => {
  it('counts whole calendar months', () => {
    expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 5, 15))).toBe(5);
  });

  it('excludes a partial month', () => {
    expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 5, 14))).toBe(4);
  });

  it('counts zero for a negative span', () => {
    expect(monthsBetween(new Date(2026, 5, 15), new Date(2026, 0, 15))).toBe(-5);
  });
});

describe('goal validation', () => {
  it('rejects a missing goal name', () => {
    const result = createGoalSchema.safeParse({ body: { name: '', targetAmount: 100 } });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive target amount', () => {
    const result = createGoalSchema.safeParse({ body: { name: 'Laptop', targetAmount: 0 } });
    expect(result.success).toBe(false);
  });

  it('rejects a negative saved amount', () => {
    const result = createGoalSchema.safeParse({
      body: { name: 'Laptop', targetAmount: 100, currentAmount: -1 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a saved amount above the target', () => {
    const result = createGoalSchema.safeParse({
      body: { name: 'Laptop', targetAmount: 100, currentAmount: 150 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid target date', () => {
    const result = createGoalSchema.safeParse({
      body: { name: 'Laptop', targetAmount: 100, targetDate: 'not-a-date' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a zero monthly contribution when provided', () => {
    const result = createGoalSchema.safeParse({
      body: { name: 'Laptop', targetAmount: 100, monthlyContribution: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid goal and defaults the saved amount', () => {
    const result = createGoalSchema.safeParse({
      body: { name: 'New Laptop', targetAmount: 75000 },
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.body.currentAmount).toBe(0);
  });

  it('rejects a non-positive contribution', () => {
    const result = addContributionSchema.safeParse({ body: { amount: 0 } });
    expect(result.success).toBe(false);
  });
});

describe('calendar occurrence projection', () => {
  const base = {
    _id: 'r1',
    name: 'Rent',
    merchant: 'Landlord',
    type: 'expense' as const,
    amount: 18000,
    frequency: 'monthly' as const,
    startDate: new Date(2026, 0, 1),
    nextDueDate: new Date(2026, 0, 27),
    endDate: null as Date | null,
  };

  it('projects every monthly occurrence inside the window', () => {
    const occurrences = projectOccurrences([base], new Date(2026, 0, 1), new Date(2026, 2, 31));
    expect(occurrences.map((o) => o.date)).toEqual(['2026-01-27', '2026-02-27', '2026-03-27']);
  });

  it('starts from nextDueDate rather than startDate', () => {
    const occurrences = projectOccurrences([base], new Date(2026, 0, 1), new Date(2026, 0, 31));
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].date).toBe('2026-01-27');
  });

  it('stops projecting at an end date', () => {
    const bounded = { ...base, endDate: new Date(2026, 1, 28) };
    const occurrences = projectOccurrences([bounded], new Date(2026, 0, 1), new Date(2026, 5, 30));
    expect(occurrences.map((o) => o.date)).toEqual(['2026-01-27', '2026-02-27']);
  });

  it('projects weekly occurrences', () => {
    const weekly = { ...base, frequency: 'weekly' as const, nextDueDate: new Date(2026, 0, 5) };
    const occurrences = projectOccurrences([weekly], new Date(2026, 0, 1), new Date(2026, 0, 31));
    expect(occurrences.map((o) => o.date)).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
      '2026-01-26',
    ]);
  });

  it('projects yearly occurrences', () => {
    const yearly = { ...base, frequency: 'yearly' as const, nextDueDate: new Date(2026, 3, 1) };
    const occurrences = projectOccurrences([yearly], new Date(2026, 0, 1), new Date(2028, 5, 30));
    expect(occurrences.map((o) => o.date)).toEqual(['2026-04-01', '2027-04-01', '2028-04-01']);
  });

  it('returns nothing when the window precedes the schedule', () => {
    const occurrences = projectOccurrences([base], new Date(2025, 0, 1), new Date(2025, 11, 31));
    expect(occurrences).toHaveLength(0);
  });

  it('carries income type through so scheduled credit is distinguishable', () => {
    const salary = { ...base, name: 'Salary', type: 'income' as const };
    const occurrences = projectOccurrences([salary], new Date(2026, 0, 1), new Date(2026, 0, 31));
    expect(occurrences[0].type).toBe('income');
  });
});

describe('calendar day helpers', () => {
  it('builds a local-time day range', () => {
    const { start, end } = getDayRange(new Date(2026, 9, 21));
    expect(start.getDate()).toBe(21);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('formats day keys consistently', () => {
    expect(toDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});
