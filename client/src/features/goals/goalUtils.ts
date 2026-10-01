import type { Goal, GoalComputed, GoalSummary } from '../../types/index.js';

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/** Whole (or partial) calendar months between two dates. */
export function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  const anchor = new Date(from.getFullYear(), from.getMonth() + months, from.getDate());
  return to.getTime() >= anchor.getTime() ? months : months - 1;
}

/**
 * Client-side mirror of the server goal maths, used for instant card feedback
 * and as a fallback when `computed` is not yet present on a payload.
 */
export function computeGoalMetrics(
  goal: Pick<Goal, 'targetAmount' | 'currentAmount' | 'targetDate' | 'monthlyContribution'>,
  now: Date = new Date()
): GoalComputed {
  const targetAmount = Number(goal.targetAmount) || 0;
  const currentAmount = Math.max(0, Number(goal.currentAmount) || 0);
  const targetDate = toDate(goal.targetDate);

  const isCompleted = targetAmount > 0 && currentAmount >= targetAmount;
  const remainingAmount = roundMoney(Math.max(0, targetAmount - currentAmount));
  const percentageComplete =
    targetAmount > 0 ? roundMoney((currentAmount / targetAmount) * 100) : 0;

  let monthsRemaining: number | null = null;
  if (targetDate) {
    if (isCompleted || targetDate.getTime() <= now.getTime()) {
      monthsRemaining = 0;
    } else {
      monthsRemaining = Math.max(1, monthsBetween(now, targetDate));
    }
  }

  let requiredMonthlyContribution: number | null = null;
  if (remainingAmount === 0) {
    requiredMonthlyContribution = 0;
  } else if (monthsRemaining && monthsRemaining > 0) {
    requiredMonthlyContribution = roundMoney(remainingAmount / monthsRemaining);
  }

  const monthly = Number(goal.monthlyContribution) || 0;
  let expectedCompletionDate: string | null = null;
  if (remainingAmount === 0) {
    expectedCompletionDate = now.toISOString();
  } else if (monthly > 0) {
    const monthsNeeded = Math.ceil(remainingAmount / monthly);
    expectedCompletionDate = new Date(
      now.getFullYear(),
      now.getMonth() + monthsNeeded,
      now.getDate()
    ).toISOString();
  }

  return {
    targetAmount: roundMoney(targetAmount),
    currentAmount: roundMoney(currentAmount),
    remainingAmount,
    percentageComplete: Math.min(100, Math.max(0, percentageComplete)),
    monthsRemaining,
    requiredMonthlyContribution,
    expectedCompletionDate,
    isCompleted,
    isOverdue: !isCompleted && !!targetDate && targetDate.getTime() < now.getTime(),
  };
}

export function getGoalMetrics(goal: Goal): GoalComputed {
  return goal.computed ?? computeGoalMetrics(goal);
}

export function computeGoalSummary(goals: Goal[]): GoalSummary {
  const totalTargetAmount = roundMoney(
    goals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0)
  );
  const totalSavedAmount = roundMoney(
    goals.reduce((sum, g) => sum + (Number(g.currentAmount) || 0), 0)
  );

  let activeCount = 0;
  let completedCount = 0;
  for (const goal of goals) {
    const metrics = getGoalMetrics(goal);
    if (metrics.isCompleted) completedCount += 1;
    else activeCount += 1;
  }

  return {
    totalTargetAmount,
    totalSavedAmount,
    totalRemainingAmount: roundMoney(Math.max(0, totalTargetAmount - totalSavedAmount)),
    percentageComplete:
      totalTargetAmount > 0
        ? roundMoney((totalSavedAmount / totalTargetAmount) * 100)
        : 0,
    activeCount,
    completedCount,
  };
}

export type GoalFilter = 'ALL' | 'ACTIVE' | 'COMPLETED';

export function filterGoals(goals: Goal[], filter: GoalFilter): Goal[] {
  if (filter === 'ALL') return goals;
  return goals.filter((g) => (filter === 'COMPLETED' ? getGoalMetrics(g).isCompleted : !getGoalMetrics(g).isCompleted));
}

/** Active goals closest to their deadline, for the dashboard widget. */
export function selectPriorityGoals(goals: Goal[], limit = 3): Goal[] {
  return goals
    .filter((g) => !getGoalMetrics(g).isCompleted)
    .map((goal) => {
      const target = toDate(goal.targetDate);
      return { goal, rank: target ? target.getTime() : Number.MAX_SAFE_INTEGER };
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((item) => item.goal);
}

/**
 * Deadline presets offered by the goal form. Anything other than `custom`
 * resolves to a concrete date relative to today.
 */
export const DEADLINE_PRESETS: Array<{ value: string; label: string; months: number }> = [
  { value: '1m', label: 'In 1 month', months: 1 },
  { value: '3m', label: 'In 3 months', months: 3 },
  { value: '6m', label: 'In 6 months', months: 6 },
  { value: '1y', label: 'In 1 year', months: 12 },
  { value: '2y', label: 'In 2 years', months: 24 },
  { value: '5y', label: 'In 5 years', months: 60 },
];

export const CUSTOM_DEADLINE = 'custom';
export const NO_DEADLINE = 'none';

/** Local-time `YYYY-MM-DD`, avoiding the UTC shift of `toISOString()`. */
export function toDateInputValue(value?: string | Date | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/** Same day-of-month, `months` ahead. */
export function addMonths(base: Date, months: number): Date {
  const result = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  result.setMonth(result.getMonth() + months);
  return result;
}

/** Matches a stored date back to a preset so editing shows the right option. */
export function matchDeadlinePreset(targetDate: string, today: Date = new Date()): string {
  if (!targetDate) return NO_DEADLINE;
  for (const preset of DEADLINE_PRESETS) {
    if (toDateInputValue(addMonths(today, preset.months)) === targetDate) {
      return preset.value;
    }
  }
  return CUSTOM_DEADLINE;
}
