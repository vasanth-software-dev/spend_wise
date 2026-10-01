import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Repeat, Target, Users } from 'lucide-react';
import { Card, CardTitle, CardDescription } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { formatINR } from '../../utils/format.js';
import type { CalendarDebtMarker, CalendarGoalMarker, UpcomingOccurrence } from '../../types/index.js';
import { formatRelativeDayLabel } from './calendarUtils.js';

interface UpcomingListProps {
  upcoming: UpcomingOccurrence[];
  /** Goal deadlines falling inside the same window. */
  goals?: CalendarGoalMarker[];
  /** Debts falling due inside the same window. */
  debts?: CalendarDebtMarker[];
  loading: boolean;
  limit?: number;
  /** Renders the full card with a heading; the dashboard widget disables it. */
  showHeader?: boolean;
  footerLink?: { to: string; label: string };
}

export const UpcomingList: React.FC<UpcomingListProps> = ({
  upcoming,
  goals = [],
  debts = [],
  loading,
  limit = 6,
  showHeader = true,
  footerLink,
}) => {
  const items = upcoming.slice(0, limit);
  const isEmpty = upcoming.length === 0 && goals.length === 0 && debts.length === 0;

  return (
    <Card className="p-5 sm:p-6 flex flex-col justify-between h-full">
      {showHeader && (
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base">Upcoming</CardTitle>
              <CardDescription>Bills, goal deadlines and debt dues</CardDescription>
            </div>
          </div>
          {footerLink && (
            <Link
              to={footerLink.to}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-bold flex items-center gap-0.5"
            >
              {footerLink.label}
              <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {loading && isEmpty ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : isEmpty ? (
          <p className="text-xs text-slate-400 py-6 text-center font-medium">
            No upcoming bills, goal deadlines or debts in this window.
          </p>
        ) : (
          <>
            {items.map((item) => (
              <div
                key={`${item.recurringTransactionId}-${item.date}`}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-850/50 border border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {formatRelativeDayLabel(item.date)}
                  </p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 tracking-tight text-xs truncate mt-0.5">
                    {item.name}
                  </p>
                </div>
                <span
                  className={`font-extrabold font-mono tabular-financial text-xs sm:text-sm flex-shrink-0 ${
                    item.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {item.type === 'income' ? '+' : ''}
                  {formatINR(item.amount)}
                </span>
              </div>
            ))}

            {goals.map((goal) => (
              <div
                key={goal.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {formatRelativeDayLabel(goal.date)} · Goal deadline
                    </p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 tracking-tight text-xs truncate">
                      {goal.name}
                    </p>
                  </div>
                </div>
                <span className="font-extrabold font-mono tabular-financial text-xs sm:text-sm flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                  {formatINR(goal.remainingAmount)}
                </span>
              </div>
            ))}

            {debts.map((debt) => (
              <div
                key={debt.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/20"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      {formatRelativeDayLabel(debt.date)} ·{' '}
                      {debt.direction === 'I_OWE' ? 'You owe' : 'Owed to you'}
                    </p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 tracking-tight text-xs truncate">
                      {debt.personName}
                    </p>
                  </div>
                </div>
                <span className="font-extrabold font-mono tabular-financial text-xs sm:text-sm flex-shrink-0 text-rose-600 dark:text-rose-400">
                  {formatINR(debt.remainingAmount)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {footerLink && (
        <div className="mt-6 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-center">
          <Link
            to={footerLink.to}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center gap-1 transition-colors"
          >
            {footerLink.label}
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </Card>
  );
};
