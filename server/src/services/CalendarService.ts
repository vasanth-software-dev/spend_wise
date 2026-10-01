import { recurringRepository } from '../repositories/RecurringRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { goalRepository } from '../repositories/GoalRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { getMonthYearRange } from '../utils/dateRange.js';
import { computeGoalMetrics } from './GoalService.js';
import {
  CalendarDaySummary,
  CalendarDebtMarker,
  CalendarGoalMarker,
  IRecurringTransaction,
  ITransaction,
  UpcomingOccurrence,
} from '../types/index.js';

/** Asia/Kolkata keeps day keys aligned with the rest of the analytics surface. */
export const CALENDAR_TIMEZONE = 'Asia/Kolkata';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Local-time [start, end) bounds for a single calendar day. */
export function getDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  return { start, end: new Date(start.getTime() + MS_PER_DAY) };
}

export function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addFrequency(date: Date, frequency: IRecurringTransaction['frequency']): Date {
  const next = new Date(date.getTime());
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

/**
 * Expands recurring items into concrete dated occurrences inside a window.
 *
 * Items are schedules, not transactions: they never touch the ledger, they are
 * only what the calendar renders as scheduled entries. Monthly anchors keep the
 * original day-of-month where possible, so 31 Jan rolls into Feb without
 * drifting earlier each cycle.
 */
export function projectOccurrences(
  items: Array<
    Pick<
      IRecurringTransaction,
      '_id' | 'name' | 'merchant' | 'type' | 'amount' | 'frequency' | 'startDate' | 'nextDueDate' | 'endDate'
    > & { categoryId?: unknown }
  >,
  windowStart: Date,
  windowEnd: Date,
  maxOccurrencesPerItem = 400
): UpcomingOccurrence[] {
  const results: UpcomingOccurrence[] = [];

  for (const item of items) {
    const endLimit = item.endDate ? new Date(item.endDate).getTime() : Infinity;
    let cursor = new Date(
      Math.max(new Date(item.nextDueDate).getTime(), new Date(item.startDate).getTime())
    );

    let guard = 0;
    while (cursor.getTime() <= windowEnd.getTime() && guard < maxOccurrencesPerItem) {
      guard += 1;
      if (cursor.getTime() >= windowStart.getTime() && cursor.getTime() <= endLimit) {
        results.push({
          recurringTransactionId: String(item._id),
          name: item.name,
          merchant: item.merchant,
          type: item.type,
          amount: Number(item.amount) || 0,
          categoryId: item.categoryId ?? undefined,
          date: toDayKey(cursor),
          frequency: item.frequency,
        });
      }
      cursor = addFrequency(cursor, item.frequency);
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Turns active goals into deadline markers so the calendar can surface them
 * next to transactions and recurring items.
 */
export async function buildGoalMarkers(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
  now: Date = new Date()
): Promise<CalendarGoalMarker[]> {
  const goals = await goalRepository.findWithTargetDateBetween(userId, windowStart, windowEnd);

  return goals.map((goal) => {
    const computed = computeGoalMetrics(goal, now);
    return {
      id: String(goal._id),
      name: goal.name,
      date: toDayKey(new Date(goal.targetDate as Date)),
      targetAmount: roundMoney(Number(goal.targetAmount) || 0),
      remainingAmount: computed.remainingAmount,
      percentageComplete: computed.percentageComplete,
      icon: goal.icon,
      color: goal.color,
      status: goal.status,
      isOverdue: computed.isOverdue,
    };
  });
}

/** Same idea for debts: one marker per unsettled debt with a due date. */
export async function buildDebtMarkers(
  userId: string,
  windowStart: Date,
  windowEnd: Date
): Promise<CalendarDebtMarker[]> {
  const debts = await debtRepository.findWithDueDateBetween(userId, windowStart, windowEnd);

  return debts.map((debt) => ({
    id: String(debt._id),
    personName: debt.personName,
    date: toDayKey(new Date(debt.dueDate as Date)),
    originalAmount: roundMoney(Number(debt.originalAmount) || 0),
    remainingAmount: roundMoney(debt.remainingAmount),
    direction: debt.direction,
    status: debt.status,
    isOverdue: debt.isOverdue,
  }));
}

export class CalendarService {
  async getMonth(userId: string, year: number, month: number) {
    const range = getMonthYearRange(month, year);
    const rows = await transactionRepository.getCalendarDaySummaries(userId, range.start, range.end);

    const days: CalendarDaySummary[] = rows.map((row: Record<string, unknown>) => {
      const income = roundMoney(Number(row.income) || 0);
      const expense = roundMoney(Number(row.expense) || 0);
      const transfer = roundMoney(Number(row.transfer) || 0);
      return {
        date: String(row._id),
        income,
        expense,
        transfer,
        net: roundMoney(income - expense),
        count: Number(row.count) || 0,
      };
    });

    const totals = days.reduce(
      (acc, day) => ({
        income: roundMoney(acc.income + day.income),
        expense: roundMoney(acc.expense + day.expense),
        transfer: roundMoney(acc.transfer + day.transfer),
        net: roundMoney(acc.net + day.net),
        count: acc.count + day.count,
      }),
      { income: 0, expense: 0, transfer: 0, net: 0, count: 0 }
    );

    const recurring = await recurringRepository.findActiveDueBetween(
      userId,
      range.start,
      range.end
    );
    const scheduled = projectOccurrences(recurring, range.start, range.end);
    const [goals, debts] = await Promise.all([
      buildGoalMarkers(userId, range.start, range.end),
      buildDebtMarkers(userId, range.start, range.end),
    ]);

    return {
      year,
      month,
      startDate: toDayKey(range.start),
      days,
      scheduled,
      goals,
      debts,
      totals,
    };
  }

  async getDay(userId: string, dateInput: string | Date) {
    const date =
      dateInput instanceof Date
        ? dateInput
        : new Date(`${dateInput}T00:00:00.000`);

    if (isNaN(date.getTime())) {
      return null;
    }

    const range = getDayRange(date);
    const transactions: ITransaction[] = await transactionRepository.getTransactionsForDay(
      userId,
      range.start,
      range.end
    );

    const summary = transactions.reduce(
      (acc, tx) => {
        const amount = Number(tx.amount) || 0;
        if (tx.type === 'income') acc.income = roundMoney(acc.income + amount);
        else if (tx.type === 'expense') acc.expense = roundMoney(acc.expense + amount);
        else acc.transfer = roundMoney(acc.transfer + amount);
        acc.count += 1;
        return acc;
      },
      { income: 0, expense: 0, transfer: 0, count: 0, net: 0 }
    );

    summary.net = roundMoney(summary.income - summary.expense);

    const recurring = await recurringRepository.findActiveDueBetween(
      userId,
      range.start,
      range.end
    );
    const scheduled = projectOccurrences(recurring, range.start, range.end);
    const [goals, debts] = await Promise.all([
      buildGoalMarkers(userId, range.start, range.end),
      buildDebtMarkers(userId, range.start, range.end),
    ]);

    return {
      date: toDayKey(date),
      transactions,
      summary,
      scheduled,
      goals,
      debts,
    };
  }

  async getUpcoming(userId: string, days = 30) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const end = new Date(start.getTime() + days * MS_PER_DAY);

    const recurring = await recurringRepository.findActiveDueBetween(userId, start, end);
    const upcoming = projectOccurrences(recurring, start, end);
    const [goals, debts] = await Promise.all([
      buildGoalMarkers(userId, start, end),
      buildDebtMarkers(userId, start, end),
    ]);

    const upcomingIncome = upcoming
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => roundMoney(sum + item.amount), 0);
    const upcomingExpense = upcoming
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => roundMoney(sum + item.amount), 0);

    return {
      from: toDayKey(start),
      to: toDayKey(end),
      upcoming,
      goals,
      debts,
      totals: {
        income: upcomingIncome,
        expense: upcomingExpense,
        net: roundMoney(upcomingIncome - upcomingExpense),
      },
    };
  }
}

export const calendarService = new CalendarService();
