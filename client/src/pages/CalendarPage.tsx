import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Repeat, AlertTriangle, Target } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import {
  fetchCalendarDayThunk,
  fetchCalendarMonthThunk,
  fetchCalendarUpcomingThunk,
} from '../store/slices/calendarSlice.js';
import { fetchCategoriesThunk } from '../store/slices/categorySlice.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { TransactionModal } from '../features/transactions/TransactionModal.js';
import { TransactionDrawer } from '../features/transactions/TransactionDrawer.js';
import { CalendarGrid } from '../features/calendar/CalendarGrid.js';
import { CalendarDayPanel } from '../features/calendar/CalendarDayPanel.js';
import { CalendarMobileList, MobileDayItem } from '../features/calendar/CalendarMobileList.js';
import { UpcomingList } from '../features/calendar/UpcomingList.js';
import { buildMonthGrid, formatMonthLabel, toDayKey } from '../features/calendar/calendarUtils.js';
import { formatINR, formatDate } from '../utils/format.js';
import type { CalendarDaySummary, Transaction } from '../types/index.js';

export const CalendarPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { month, day, upcoming, loading, dayLoading, upcomingLoading, error } = useAppSelector(
    (state) => state.calendar
  );

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedKey, setSelectedKey] = useState<string>(toDayKey(today));
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    dispatch(fetchCalendarMonthThunk({ year: viewYear, month: viewMonth }));
    dispatch(fetchCalendarDayThunk(selectedKey));
    dispatch(fetchCalendarUpcomingThunk(45));
    dispatch(fetchCategoriesThunk());
  }, [dispatch, viewYear, viewMonth, selectedKey]);

  const cells = useMemo(() => {
    const summaryMap: Record<string, CalendarDaySummary> = {};
    for (const item of month?.days ?? []) summaryMap[item.date] = item;
    return buildMonthGrid(
      viewYear,
      viewMonth,
      summaryMap,
      month?.scheduled ?? [],
      today,
      month?.goals ?? [],
      month?.debts ?? []
    );
  }, [viewYear, viewMonth, month, today]);

  const mobileItems = useMemo<MobileDayItem[]>(() => {
    // Days are listed when they carry anything at all: transactions, scheduled
    // occurrences, a goal deadline, or a debt falling due.
    return cells
      .filter((cell) => cell.isCurrentMonth)
      .filter(
        (cell) =>
          (cell.summary?.count ?? 0) > 0 ||
          cell.scheduled.length > 0 ||
          cell.goals.length > 0 ||
          cell.debts.length > 0
      )
      .map((cell) => ({
        key: cell.key,
        summary: cell.summary,
        scheduled: cell.scheduled,
        goals: cell.goals,
        debts: cell.debts,
      }));
  }, [cells]);

  const totals = month?.totals;

  const goToMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth() + 1);
  };

  const goToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth() + 1);
    setSelectedKey(toDayKey(now));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Calendar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Understand your income, expenses, and transfers by date.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          onClick={() => setIsAddOpen(true)}
          className="shadow-2xs self-start sm:self-auto"
        >
          Add Transaction
        </Button>
      </div>

      {error && !loading && (
        <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-600 dark:text-rose-400 font-semibold">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Month navigation */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToMonth(-1)}
              aria-label="Previous month"
              className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-[background-color,border-color] duration-150 ease-out-expo shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white min-w-[130px] sm:min-w-[160px] text-center">
              {formatMonthLabel(viewYear, viewMonth)}
            </h2>
            <button
              onClick={() => goToMonth(1)}
              aria-label="Next month"
              className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-[background-color,border-color] duration-150 ease-out-expo shadow-2xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        {/* Month totals */}
        {totals && (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Income
              </span>
              <span className="block text-xs sm:text-sm font-extrabold font-mono tabular-financial text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
                {formatINR(totals.income)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Expenses
              </span>
              <span className="block text-xs sm:text-sm font-extrabold font-mono tabular-financial text-rose-700 dark:text-rose-300 mt-0.5 truncate">
                {formatINR(totals.expense)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/70 dark:border-white/5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Net
              </span>
              <span
                className={`block text-xs sm:text-sm font-extrabold font-mono tabular-financial mt-0.5 truncate ${
                  totals.net >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-rose-700 dark:text-rose-300'
                }`}
              >
                {formatINR(totals.net)}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Grid (desktop/tablet) + agenda (mobile) and day panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4 sm:p-5 lg:col-span-2">
          {/* Month grid: hidden on phones where cells get too narrow */}
          <div className="hidden sm:block">
            <CalendarGrid
              cells={cells}
              selectedKey={selectedKey}
              loading={loading && !month}
              onSelect={setSelectedKey}
            />
          </div>

          {/* Mobile agenda */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {formatMonthLabel(viewYear, viewMonth)}
                </span>
              </div>
            </div>

            {loading && mobileItems.length === 0 ? (
              <div className="space-y-2 pt-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : mobileItems.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="w-8 h-8 text-slate-400" />}
                title="Nothing scheduled this month"
                description="Add a transaction, goal deadline, or debt to see it on the calendar."
                actionText="Add a transaction"
                onAction={() => setIsAddOpen(true)}
                className="my-6"
              />
            ) : (
              <CalendarMobileList
                items={mobileItems}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
              />
            )}
          </div>
        </Card>

        {/* Day details: below the calendar on mobile, side panel on desktop */}
        <Card className="p-4 sm:p-5 flex flex-col">
          <CalendarDayPanel
            detail={day}
            loading={dayLoading}
            onAddTransaction={() => setIsAddOpen(true)}
            onSelectTransaction={setSelectedTx}
          />
        </Card>
      </div>

      {/* Upcoming scheduled activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    Scheduled in this month
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Projected from your recurring bills and salary
                  </p>
                </div>
              </div>
              <Link
                to="/recurring"
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-bold"
              >
                Manage
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {loading && (month?.scheduled.length ?? 0) === 0 ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : (month?.scheduled.length ?? 0) === 0 ? (
                <p className="col-span-full text-xs text-slate-400 py-6 text-center font-medium">
                  No recurring items fall in {formatMonthLabel(viewYear, viewMonth)}.
                </p>
              ) : (
                (month?.scheduled ?? []).slice(0, 8).map((item) => (
                  <div
                    key={`${item.recurringTransactionId}-${item.date}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/70 dark:bg-slate-850/50 border border-slate-100 dark:border-slate-800/80"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {formatDate(item.date, 'd MMM yyyy')} · {item.frequency}
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
                      {item.type === 'income' ? '+' : '○ '}
                      {formatINR(item.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <UpcomingList
          upcoming={upcoming?.upcoming ?? []}
          goals={upcoming?.goals ?? []}
          debts={upcoming?.debts ?? []}
          loading={upcomingLoading}
          limit={6}
          footerLink={{ to: '/calendar', label: 'See on calendar' }}
        />
      </div>

      {/* Goal deadlines and debts due inside the viewed month */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Deadlines & dues in {formatMonthLabel(viewYear, viewMonth)}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Goal target dates and unsettled debt due dates
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {loading &&
          (month?.goals.length ?? 0) === 0 &&
          (month?.debts.length ?? 0) === 0 ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : (month?.goals.length ?? 0) === 0 && (month?.debts.length ?? 0) === 0 ? (
            <p className="col-span-full text-xs text-slate-400 py-6 text-center font-medium">
              No goal deadlines or debts due in {formatMonthLabel(viewYear, viewMonth)}.
            </p>
          ) : (
            <>
              {(month?.goals ?? []).slice(0, 6).map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/20"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {formatDate(goal.date, 'd MMM yyyy')} · Goal deadline
                    </p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 tracking-tight text-xs truncate mt-0.5">
                      {goal.name}
                    </p>
                  </div>
                  <span className="font-extrabold font-mono tabular-financial text-xs sm:text-sm flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                    {formatINR(goal.remainingAmount)}
                  </span>
                </div>
              ))}

              {(month?.debts ?? []).slice(0, 6).map((debt) => (
                <div
                  key={debt.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-rose-500/5 dark:bg-rose-500/5 border border-rose-500/20"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      {formatDate(debt.date, 'd MMM yyyy')} ·{' '}
                      {debt.direction === 'I_OWE' ? 'You owe' : 'Owed to you'}
                    </p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 tracking-tight text-xs truncate mt-0.5">
                      {debt.personName}
                    </p>
                  </div>
                  <span className="font-extrabold font-mono tabular-financial text-xs sm:text-sm flex-shrink-0 text-rose-600 dark:text-rose-400">
                    {formatINR(debt.remainingAmount)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </Card>

      {/* Reuses the existing transaction creation flow, pre-filled with the
          selected calendar day. */}
      <TransactionModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        defaultDate={selectedKey}
        onSuccess={() => {
          dispatch(fetchCalendarMonthThunk({ year: viewYear, month: viewMonth }));
          dispatch(fetchCalendarDayThunk(selectedKey));
        }}
      />

      <TransactionDrawer
        transaction={selectedTx}
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        onEdit={() => setSelectedTx(null)}
      />
    </div>
  );
};
