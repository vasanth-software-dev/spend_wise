import React from 'react';
import { ChevronRight, Circle } from 'lucide-react';
import { formatINR, formatDate } from '../../utils/format.js';
import type {
  CalendarDaySummary,
  CalendarDebtMarker,
  CalendarGoalMarker,
  UpcomingOccurrence,
} from '../../types/index.js';

export interface MobileDayItem {
  key: string;
  /** Absent for days that only carry goal deadlines or debts due. */
  summary?: CalendarDaySummary;
  scheduled: UpcomingOccurrence[];
  goals: CalendarGoalMarker[];
  debts: CalendarDebtMarker[];
}

interface CalendarMobileListProps {
  items: MobileDayItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

/**
 * Compact agenda used instead of the month grid on phones, where a 7-column
 * grid would make cells too narrow to read amounts.
 */
export const CalendarMobileList: React.FC<CalendarMobileListProps> = ({
  items,
  selectedKey,
  onSelect,
}) => (
  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
    {items.map(({ key, summary, scheduled, goals, debts }) => {
      const net = summary?.net ?? 0;
      const isSelected = key === selectedKey;
      const count = summary?.count ?? 0;

      return (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          aria-label={`View ${key} details`}
          className={`w-full py-3 px-2.5 flex items-center justify-between gap-3 rounded-xl transition-colors text-left ${
            isSelected
              ? 'bg-brand-500/10 border border-brand-500/20'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 text-center flex-shrink-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {formatDate(key, 'MMM')}
              </span>
              <span className="block text-base font-extrabold tabular-financial text-slate-900 dark:text-white leading-tight">
                {formatDate(key, 'd')}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {summary && summary.income > 0 && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatINR(summary.income, false)}
                  </span>
                )}
                {summary && summary.expense > 0 && (
                  <span className="text-[10px] font-bold text-rose-500">
                    -{formatINR(summary.expense, false)}
                  </span>
                )}
                {summary && summary.transfer > 0 && (
                  <span className="text-[10px] font-bold text-indigo-500">
                    ⇄{formatINR(summary.transfer, false)}
                  </span>
                )}
                {goals.map((goal) => (
                  <span
                    key={goal.id}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate"
                  >
                    {goal.name}
                  </span>
                ))}
                {debts.map((debt) => (
                  <span
                    key={debt.id}
                    className="text-[10px] font-bold text-rose-600 dark:text-rose-400 truncate"
                  >
                    {debt.personName}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                {count > 0 && `${count} ${count === 1 ? 'transaction' : 'transactions'}`}
                {scheduled.length > 0 && ` · ${scheduled.length} scheduled`}
                {goals.length > 0 && ` · ${goals.length} goal ${goals.length === 1 ? 'deadline' : 'deadlines'}`}
                {debts.length > 0 && ` · ${debts.length} ${debts.length === 1 ? 'debt' : 'debts'} due`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {summary && (
              <span
                className={`text-sm font-extrabold font-mono tabular-financial ${
                  net >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {net > 0 ? '+' : net < 0 ? '-' : ''}
                {formatINR(Math.abs(net), false)}
              </span>
            )}
            {goals.length > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
            )}
            {debts.length > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" aria-hidden="true" />
            )}
            {scheduled.length > 0 && (
              <Circle className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600" />
            )}
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
          </div>
        </button>
      );
    })}
  </div>
);
