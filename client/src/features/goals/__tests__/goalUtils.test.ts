import { describe, it, expect } from 'vitest';
import {
  addMonths,
  computeGoalMetrics,
  computeGoalSummary,
  CUSTOM_DEADLINE,
  DEADLINE_PRESETS,
  filterGoals,
  matchDeadlinePreset,
  monthsBetween,
  NO_DEADLINE,
  selectPriorityGoals,
  toDateInputValue,
} from '../goalUtils.js';
import type { Goal } from '../../../types/index.js';

const NOW = new Date(2026, 0, 15);

const makeGoal = (over: Partial<Goal>): Goal =>
  ({
    _id: Math.random().toString(36).slice(2),
    userId: 'u1',
    name: 'Goal',
    targetAmount: 100000,
    currentAmount: 0,
    icon: 'Target',
    color: '#10b981',
    status: 'active',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...over,
  } as Goal);

describe('goal progress maths', () => {
  it('reports progress and remaining', () => {
    const m = computeGoalMetrics(
      makeGoal({ targetAmount: 75000, currentAmount: 25000 }),
      NOW
    );
    expect(m.percentageComplete).toBe(33.33);
    expect(m.remainingAmount).toBe(50000);
  });

  it('splits remaining across the months left', () => {
    const m = computeGoalMetrics(
      makeGoal({ targetAmount: 100000, currentAmount: 0, targetDate: new Date(2026, 6, 15).toISOString() }),
      NOW
    );
    expect(m.monthsRemaining).toBe(6);
    expect(m.requiredMonthlyContribution).toBe(16666.67);
  });

  it('flags a fully funded goal as complete', () => {
    const m = computeGoalMetrics(makeGoal({ currentAmount: 100000 }), NOW);
    expect(m.isCompleted).toBe(true);
    expect(m.remainingAmount).toBe(0);
  });

  it('flags a passed target date as overdue', () => {
    const m = computeGoalMetrics(
      makeGoal({ targetDate: new Date(2025, 9, 1).toISOString() }),
      NOW
    );
    expect(m.isOverdue).toBe(true);
    expect(m.requiredMonthlyContribution).toBeNull();
  });

  it('handles a very short target period', () => {
    const m = computeGoalMetrics(
      makeGoal({ targetAmount: 10000, targetDate: new Date(2026, 0, 20).toISOString() }),
      NOW
    );
    expect(m.monthsRemaining).toBe(1);
    expect(m.requiredMonthlyContribution).toBe(10000);
  });

  it('handles no target date', () => {
    const m = computeGoalMetrics(makeGoal({}), NOW);
    expect(m.monthsRemaining).toBeNull();
  });

  it('counts whole calendar months', () => {
    expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 5, 14))).toBe(4);
  });
});

describe('goal summary', () => {
  it('aggregates totals and counts', () => {
    const summary = computeGoalSummary([
      makeGoal({ targetAmount: 75000, currentAmount: 25000 }),
      makeGoal({ targetAmount: 25000, currentAmount: 25000 }),
    ]);
    expect(summary.totalTargetAmount).toBe(100000);
    expect(summary.totalSavedAmount).toBe(50000);
    expect(summary.totalRemainingAmount).toBe(50000);
    expect(summary.percentageComplete).toBe(50);
    expect(summary.activeCount).toBe(1);
    expect(summary.completedCount).toBe(1);
  });

  it('returns zeroes for an empty goal list', () => {
    const summary = computeGoalSummary([]);
    expect(summary.totalTargetAmount).toBe(0);
    expect(summary.percentageComplete).toBe(0);
    expect(summary.activeCount).toBe(0);
  });
});

describe('goal filtering and prioritisation', () => {
  const goals = [
    makeGoal({ name: 'Complete', targetAmount: 1000, currentAmount: 1000 }),
    makeGoal({ name: 'Far', targetAmount: 1000, currentAmount: 100, targetDate: new Date(2028, 0, 1).toISOString() }),
    makeGoal({ name: 'Near', targetAmount: 1000, currentAmount: 100, targetDate: new Date(2026, 2, 1).toISOString() }),
  ];

  it('filters by state', () => {
    expect(filterGoals(goals, 'ALL')).toHaveLength(3);
    expect(filterGoals(goals, 'COMPLETED').map((g) => g.name)).toEqual(['Complete']);
    expect(filterGoals(goals, 'ACTIVE').map((g) => g.name)).toEqual(['Far', 'Near']);
  });

  it('prioritises active goals by nearest deadline', () => {
    expect(selectPriorityGoals(goals).map((g) => g.name)).toEqual(['Near', 'Far']);
  });

  it('excludes completed goals from the dashboard widget', () => {
    const onlyCompleted = [makeGoal({ targetAmount: 1000, currentAmount: 1000 })];
    expect(selectPriorityGoals(onlyCompleted)).toHaveLength(0);
  });

  it('puts undated goals last', () => {
    const mixed = [
      makeGoal({ name: 'Undated', targetAmount: 1000, currentAmount: 10 }),
      makeGoal({ name: 'Dated', targetAmount: 1000, currentAmount: 10, targetDate: new Date(2027, 0, 1).toISOString() }),
    ];
    expect(selectPriorityGoals(mixed).map((g) => g.name)).toEqual(['Dated', 'Undated']);
  });
});

describe('goal deadline presets', () => {
  it('formats dates for a date input without a UTC shift', () => {
    expect(toDateInputValue(new Date(2026, 9, 21, 23, 30))).toBe('2026-10-21');
  });

  it('returns an empty string for missing or invalid dates', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue('not-a-date')).toBe('');
  });

  it('adds months while keeping the day of month', () => {
    expect(toDateInputValue(addMonths(new Date(2026, 0, 15), 3))).toBe('2026-04-15');
    expect(toDateInputValue(addMonths(new Date(2026, 0, 15), 12))).toBe('2027-01-15');
  });

  it('round-trips a preset back to its value', () => {
    for (const preset of DEADLINE_PRESETS) {
      const date = toDateInputValue(addMonths(NOW, preset.months));
      expect(matchDeadlinePreset(date, NOW)).toBe(preset.value);
    }
  });

  it('treats no date as no deadline', () => {
    expect(matchDeadlinePreset('', NOW)).toBe(NO_DEADLINE);
  });

  it('falls back to custom for dates outside the presets', () => {
    expect(matchDeadlinePreset('2026-11-17', NOW)).toBe(CUSTOM_DEADLINE);
  });
});
