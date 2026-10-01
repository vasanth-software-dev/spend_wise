import React from 'react';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { formatINR } from '../../utils/format.js';
import { WEEKDAY_LABELS, type CalendarCell } from './calendarUtils.js';

interface CalendarGridProps {
  cells: CalendarCell[];
  selectedKey: string | null;
  loading: boolean;
  onSelect: (key: string) => void;
}

/** Monday-first month grid. Cells stay legible down to ~360px widths. */
export const CalendarGrid: React.FC<CalendarGridProps> = ({
  cells,
  selectedKey,
  loading,
  onSelect,
}) => {
  if (loading && cells.length === 0) {
    return (
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-1.5"
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.charAt(0)}</span>
          </div>
        ))}
        {Array.from({ length: 35 }).map((_, index) => (
          <Skeleton key={index} className="aspect-square sm:h-[76px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1.5"
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.charAt(0)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label="Transaction calendar">
        {cells.map((cell) => {
          const summary = cell.summary;
          const isSelected = cell.key === selectedKey;
          const hasActivity = (summary?.count ?? 0) > 0;
          const hasScheduled = cell.scheduled.length > 0;
          const hasGoals = cell.goals.length > 0;
          const hasDebts = cell.debts.length > 0;
          const income = summary?.income ?? 0;
          const expense = summary?.expense ?? 0;
          const transfer = summary?.transfer ?? 0;

          // Net is the headline figure; colour reflects direction using the
          // app's existing income / expense semantics.
          const net = summary?.net ?? 0;
          const showNet = hasActivity && net !== 0;
          const netColor = !showNet
            ? ''
            : net > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400';

          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`${cell.key}${
                hasActivity
                  ? `, income ${formatINR(summary?.income ?? 0)}, expenses ${formatINR(summary?.expense ?? 0)}`
                  : ', no transactions'
              }${hasScheduled ? `, ${cell.scheduled.length} scheduled` : ''}${
                hasGoals ? `, ${cell.goals.length} goal deadlines` : ''
              }${hasDebts ? `, ${cell.debts.length} debts due` : ''}`}
              onClick={() => onSelect(cell.key)}
              className={`relative flex flex-col items-stretch text-left rounded-xl border px-1 sm:px-1.5 pt-1.5 pb-1 sm:pt-2 sm:pb-1.5 min-h-[52px] sm:min-h-[76px] transition-all duration-150 ${
                isSelected
                  ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                  : hasActivity || hasScheduled || hasGoals || hasDebts
                  ? 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
              } ${cell.isCurrentMonth ? '' : 'opacity-45'}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`text-[11px] sm:text-xs font-bold tabular-financial ${
                    cell.isToday
                      ? 'text-brand-700 dark:text-brand-300'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {cell.dayNumber}
                </span>
                {cell.isToday && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                )}
              </div>

              {/* Scheduled markers use a hollow ring, matching the app's
                  scheduled-vs-recorded distinction. */}
              {hasScheduled && (
                <span
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-slate-400 dark:border-slate-500 sm:hidden"
                  aria-hidden="true"
                />
              )}

              {/* Goal deadlines and debt due dates get their own coloured
                  dots so they read differently from recurring items. */}
              {(hasGoals || hasDebts) && (
                <span
                  className="absolute top-1.5 right-1.5 flex items-center gap-0.5 sm:hidden"
                  aria-hidden="true"
                >
                  {hasGoals && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                  {hasDebts && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                </span>
              )}

              {hasActivity && (
                <div className="mt-auto hidden sm:block space-y-0.5">
                  {showNet && (
                    <span
                      className={`block text-[10px] font-extrabold font-mono tabular-financial leading-none truncate ${netColor}`}
                    >
                      {net > 0 ? '+' : '-'}
                      {formatINR(Math.abs(net), false)}
                    </span>
                  )}
                  <div className="flex items-center gap-1 leading-none">
                    {income > 0 && (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                        +
                      </span>
                    )}
                    {expense > 0 && (
                      <span className="text-[9px] font-bold text-rose-500">-</span>
                    )}
                    {transfer > 0 && (
                      <span className="text-[9px] font-bold text-indigo-500">⇄</span>
                    )}
                  </div>
                </div>
              )}

              {hasScheduled && (
                <span className="hidden sm:block text-[9px] font-bold text-slate-400 dark:text-slate-500 leading-none truncate">
                  {cell.scheduled.length} scheduled
                </span>
              )}

              {(hasGoals || hasDebts) && (
                <span className="hidden sm:flex items-center gap-1 leading-none" aria-hidden="true">
                  {hasGoals && (
                    <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 truncate">
                      {cell.goals.length}g
                    </span>
                  )}
                  {hasDebts && (
                    <span className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400 truncate">
                      {cell.debts.length}d
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend for the marker colours used in cells */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full border border-slate-400 dark:border-slate-500" />
          Scheduled
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Goal deadline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          Debt due
        </span>
      </div>
    </div>
  );
};
