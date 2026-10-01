import type {
  CalendarDaySummary,
  CalendarDebtMarker,
  CalendarGoalMarker,
  UpcomingOccurrence,
} from '../../types/index.js';

export interface CalendarCell {
  /** `YYYY-MM-DD` key. */
  key: string;
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  summary?: CalendarDaySummary;
  scheduled: UpcomingOccurrence[];
  goals: CalendarGoalMarker[];
  debts: CalendarDebtMarker[];
}

/** Monday-first week layout, matching the app's financial calendar convention. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Builds the 6x7 Monday-first grid for a month, including the leading and
 * trailing days needed to fill complete weeks.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  summaries: Record<string, CalendarDaySummary>,
  scheduled: UpcomingOccurrence[],
  today: Date = new Date(),
  goalDeadlines: CalendarGoalMarker[] = [],
  debtDueDates: CalendarDebtMarker[] = []
): CalendarCell[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const mondayIndex = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month - 1, 1 - mondayIndex);

  const scheduledByDate = new Map<string, UpcomingOccurrence[]>();
  for (const item of scheduled) {
    const list = scheduledByDate.get(item.date) ?? [];
    list.push(item);
    scheduledByDate.set(item.date, list);
  }

  const goalsByDate = new Map<string, CalendarGoalMarker[]>();
  for (const goal of goalDeadlines) {
    const list = goalsByDate.get(goal.date) ?? [];
    list.push(goal);
    goalsByDate.set(goal.date, list);
  }

  const debtsByDate = new Map<string, CalendarDebtMarker[]>();
  for (const debt of debtDueDates) {
    const list = debtsByDate.get(debt.date) ?? [];
    list.push(debt);
    debtsByDate.set(debt.date, list);
  }

  const cells: CalendarCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );
    const key = toDayKey(date);
    cells.push({
      key,
      date,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month - 1 && date.getFullYear() === year,
      isToday: isSameDay(date, today),
      summary: summaries[key],
      scheduled: scheduledByDate.get(key) ?? [],
      goals: goalsByDate.get(key) ?? [],
      debts: debtsByDate.get(key) ?? [],
    });
  }

  return cells;
}

/** `YYYY-MM-DD` for the first of the given month. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** Days of the visible month that actually carry transaction activity. */
export function countActiveDays(cells: CalendarCell[]): number {
  return cells.filter((cell) => cell.isCurrentMonth && (cell.summary?.count ?? 0) > 0).length;
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

/** "Today" / "Tomorrow" / "dd MMM" label used by the upcoming list. */
export function formatRelativeDayLabel(dateKey: string, today: Date = new Date()): string {
  const date = parseDayKey(dateKey);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
