import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

export function formatINR(amount: number, showSymbol = true): string {
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;

  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(absAmount);

  return `${isNegative ? '-' : ''}${showSymbol ? '₹' : ''}${formatted}`;
}

export function formatDate(date: string | Date, pattern = 'dd MMM yyyy'): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return format(d, pattern);
}

export function formatRelativeDate(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  if (isToday(d)) {
    return `Today at ${format(d, 'h:mm a')}`;
  }
  if (isYesterday(d)) {
    return `Yesterday at ${format(d, 'h:mm a')}`;
  }
  return formatDistanceToNow(d, { addSuffix: true });
}

export function getConfidenceBadge(score: number): { label: string; color: string } {
  if (score >= 90) return { label: `${score}% Very High`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800' };
  if (score >= 75) return { label: `${score}% Likely`, color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-800' };
  if (score >= 50) return { label: `${score}% Review`, color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800' };
  return { label: `${score}% Low`, color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800' };
}
