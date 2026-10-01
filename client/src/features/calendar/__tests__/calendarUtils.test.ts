import { describe, it, expect } from 'vitest';
import {
  buildMonthGrid,
  formatMonthLabel,
  formatRelativeDayLabel,
  isSameDay,
  monthKey,
  parseDayKey,
  toDayKey,
  WEEKDAY_LABELS,
} from '../calendarUtils.js';
import type { CalendarDaySummary, CalendarDebtMarker, CalendarGoalMarker } from '../../../types/index.js';

const TODAY = new Date(2026, 9, 21);

const summary = (over: Partial<CalendarDaySummary> = {}): CalendarDaySummary => ({
  date: '2026-10-21',
  income: 0,
  expense: 0,
  transfer: 0,
  net: 0,
  count: 0,
  ...over,
});

const goalMarker = (over: Partial<CalendarGoalMarker> = {}): CalendarGoalMarker => ({
  id: 'g1',
  name: 'Goa Trip',
  date: '2026-10-15',
  targetAmount: 60000,
  remainingAmount: 25000,
  percentageComplete: 58.33,
  icon: 'Plane',
  color: '#10b981',
  status: 'active',
  isOverdue: false,
  ...over,
});

const debtMarker = (over: Partial<CalendarDebtMarker> = {}): CalendarDebtMarker => ({
  id: 'd1',
  personName: 'Siva',
  date: '2026-10-15',
  originalAmount: 5000,
  remainingAmount: 2000,
  direction: 'I_OWE',
  status: 'PARTIALLY_PAID',
  isOverdue: false,
  ...over,
});

describe('calendar grid', () => {
  it('always builds six Monday-first weeks', () => {
    const cells = buildMonthGrid(2026, 10, {}, [], TODAY);
    expect(cells).toHaveLength(42);
    expect(new Set(cells.map((c) => c.key)).size).toBe(42);
  });

  it('starts the grid on a Monday', () => {
    const cells = buildMonthGrid(2026, 10, {}, [], TODAY);
    expect(cells[0].date.getDay()).toBe(1);
  });

  it('marks days outside the viewed month', () => {
    const cells = buildMonthGrid(2026, 10, {}, [], TODAY);
    const inMonth = cells.filter((c) => c.isCurrentMonth);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0].dayNumber).toBe(1);
    expect(inMonth[30].dayNumber).toBe(31);
  });

  it('attaches transaction summaries to the matching day', () => {
    const cells = buildMonthGrid(
      2026,
      10,
      { '2026-10-21': summary({ date: '2026-10-21', income: 45000, expense: 2020, net: 42980, count: 4 }) },
      [],
      TODAY
    );
    const cell = cells.find((c) => c.key === '2026-10-21')!;
    expect(cell.summary?.net).toBe(42980);
    expect(cell.summary?.count).toBe(4);
    expect(cell.isToday).toBe(true);
  });

  it('groups scheduled occurrences onto their dates', () => {
    const scheduled = [
      {
        recurringTransactionId: 'r1',
        name: 'Rent',
        merchant: 'Landlord',
        type: 'income' as const,
        amount: 18000,
        date: '2026-10-27',
        frequency: 'monthly' as const,
      },
    ];
    const cells = buildMonthGrid(2026, 10, {}, scheduled, TODAY);
    expect(cells.find((c) => c.key === '2026-10-27')!.scheduled).toHaveLength(1);
    expect(cells.find((c) => c.key === '2026-10-05')!.scheduled).toHaveLength(0);
  });

  it('marks exactly one cell as today', () => {
    const cells = buildMonthGrid(2026, 10, {}, [], TODAY);
    expect(cells.filter((c) => c.isToday)).toHaveLength(1);
  });

  it('handles a month that starts on Monday with no spillover', () => {
    // June 2026 starts on a Monday.
    const cells = buildMonthGrid(2026, 6, {}, [], TODAY);
    expect(cells[0].isCurrentMonth).toBe(true);
    expect(cells[0].key).toBe('2026-06-01');
  });

  it('groups goal deadlines onto their dates', () => {
    const cells = buildMonthGrid(2026, 10, {}, [], TODAY, [goalMarker()]);
    expect(cells.find((c) => c.key === '2026-10-15')!.goals).toHaveLength(1);
    expect(cells.find((c) => c.key === '2026-10-16')!.goals).toHaveLength(0);
  });

  it('groups debts due onto their dates', () => {
    const cells = buildMonthGrid(2026, 10, {}, [], TODAY, [], [debtMarker()]);
    expect(cells.find((c) => c.key === '2026-10-15')!.debts).toHaveLength(1);
    expect(cells.find((c) => c.key === '2026-10-16')!.debts).toHaveLength(0);
  });

  it('defaults goal and debt markers to empty arrays', () => {
    const cells = buildMonthGrid(2026, 10, {}, [], TODAY);
    expect(cells.every((c) => c.goals.length === 0 && c.debts.length === 0)).toBe(true);
  });
});

describe('calendar date helpers', () => {
  it('round-trips day keys', () => {
    expect(toDayKey(parseDayKey('2026-10-21'))).toBe('2026-10-21');
  });

  it('pads single-digit months and days', () => {
    expect(toDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('builds month keys', () => {
    expect(monthKey(2026, 3)).toBe('2026-03-01');
  });

  it('compares calendar days', () => {
    expect(isSameDay(new Date(2026, 9, 21), new Date(2026, 9, 21, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 9, 21), new Date(2026, 9, 22))).toBe(false);
  });

  it('labels relative days for the upcoming list', () => {
    expect(formatRelativeDayLabel('2026-10-21', new Date(2026, 9, 21))).toBe('Today');
    expect(formatRelativeDayLabel('2026-10-22', new Date(2026, 9, 21))).toBe('Tomorrow');
    expect(formatRelativeDayLabel('2026-10-27', new Date(2026, 9, 21))).toBe('27 Oct');
  });

  it('formats month headings', () => {
    expect(formatMonthLabel(2026, 10)).toContain('October');
    expect(formatMonthLabel(2026, 10)).toContain('2026');
  });

  it('exposes a seven-day Monday-first week', () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
    expect(WEEKDAY_LABELS[0]).toBe('Mon');
  });
});
