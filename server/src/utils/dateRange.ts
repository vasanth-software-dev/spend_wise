export interface MonthYearRange {
  start: Date;
  end: Date;
}

export function isValidMonthYear(month?: number, year?: number): boolean {
  if (month === undefined || year === undefined) return false;
  if (!Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (month < 1 || month > 12) return false;
  return year >= 1970 && year <= 9999;
}

/**
 * Local-time [start, end) bounds for a calendar month.
 */
export function getMonthYearRange(month: number, year: number): MonthYearRange {
  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end: new Date(year, month, 1, 0, 0, 0, 0),
  };
}

export function toValidDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * True when the value falls inside the given calendar month/year (local time).
 */
export function isDateInMonthYear(value: unknown, month: number, year: number): boolean {
  const date = toValidDate(value);
  if (!date) return false;
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

export function formatGmailDate(date: Date): string {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(
    date.getDate()
  ).padStart(2, '0')}`;
}
