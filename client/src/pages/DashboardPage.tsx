import React, { useEffect, useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  PiggyBank,
  Plus,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import { DashboardTimeRange, fetchDashboardThunk, setTimeRange } from '../store/slices/dashboardSlice.js';
import { fetchPendingDetectedThunk } from '../store/slices/detectedTransactionSlice.js';
import { fetchUpcomingThunk } from '../store/slices/recurringSlice.js';
import { fetchCategoriesThunk } from '../store/slices/categorySlice.js';
import { fetchGoalsThunk } from '../store/slices/goalSlice.js';
import { fetchCalendarUpcomingThunk } from '../store/slices/calendarSlice.js';
import { StatCard } from '../components/ui/StatCard.js';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { StatCardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton.js';
import { CategoryIcon } from '../components/ui/CategoryIcon.js';
import { formatINR, formatRelativeDate } from '../utils/format.js';
import { ExpenseTrendChart } from '../features/dashboard/ExpenseTrendChart.js';
import { CategoryBreakdownChart } from '../features/dashboard/CategoryBreakdownChart.js';
import { TopMerchantsChart } from '../features/dashboard/TopMerchantsChart.js';
import { DetectedTransactionReviewCenter } from '../features/emailSync/DetectedTransactionReviewCenter.js';
import { GoalsWidget } from '../features/dashboard/GoalsWidget.js';
import { UpcomingList } from '../features/calendar/UpcomingList.js';
import { TransactionModal } from '../features/transactions/TransactionModal.js';
import { TransactionDrawer } from '../features/transactions/TransactionDrawer.js';
import { Transaction } from '../types/index.js';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const {
    summary,
    spendingTrend,
    categoryBreakdown,
    topMerchants,
    recentTransactions,
    timeRange,
    loading,
  } = useAppSelector((state) => state.dashboard);

  const upcomingBills = useAppSelector((state) => state.recurring.upcomingList);
  const goals = useAppSelector((state) => state.goals.goals);
  const goalsLoading = useAppSelector((state) => state.goals.loading);
  const calendarUpcoming = useAppSelector((state) => state.calendar.upcoming);
  const upcomingLoading = useAppSelector((state) => state.calendar.upcomingLoading);

  // Prefer the calendar's projected occurrences (they carry real dates and
  // distinguish scheduled income from scheduled outflows); fall back to the
  // recurring list so the widget is never empty while data loads.
  const upcomingItems =
    calendarUpcoming?.upcoming.length
      ? calendarUpcoming.upcoming
      : upcomingBills.map((bill) => ({
          recurringTransactionId: bill._id,
          name: bill.name,
          merchant: bill.merchant,
          type: bill.type,
          amount: bill.amount,
          categoryId: bill.categoryId as never,
          date: new Date(bill.nextDueDate).toISOString().split('T')[0],
          frequency: bill.frequency,
        }));

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    dispatch(fetchDashboardThunk(timeRange));
    dispatch(fetchPendingDetectedThunk());
    dispatch(fetchUpcomingThunk());
    dispatch(fetchCategoriesThunk());
    dispatch(fetchGoalsThunk());
    dispatch(fetchCalendarUpcomingThunk(30));
  }, [dispatch, timeRange]);

  const handleRangeChange = (range: DashboardTimeRange) => {
    dispatch(setTimeRange(range));
    dispatch(fetchDashboardThunk(range));
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">
              Financial Command Center
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              • Real-time
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Here is your live balance, cash flow distribution, and spending intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Refresh Button */}
          <button
            onClick={() => dispatch(fetchDashboardThunk(timeRange))}
            className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs"
            title="Refresh analytics"
            aria-label="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>

          {/* Quick Add Button */}
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            onClick={() => setIsAddModalOpen(true)}
            className="shadow-2xs"
          >
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Detected Transactions Review Center (Top priority if any pending) */}
      <DetectedTransactionReviewCenter />

      {/* 4 Stat Cards - Financial Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {loading && !summary ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Balance"
              amount={formatINR(summary?.totalBalance || 0)}
              subtitle="All-time confirmed balance"
              icon={<Wallet className="w-4.5 h-4.5" />}
              accentColor="emerald"
              isHero={true}
              trend={{
                value: (summary?.savingsThisMonth || 0) >= 0 ? '+ Active' : 'Deficit',
                isPositive: (summary?.savingsThisMonth || 0) >= 0,
              }}
            />
            <StatCard
              title="Income This Month"
              amount={formatINR(summary?.incomeThisMonth || 0)}
              subtitle="Salary & inflows"
              icon={<ArrowUpRight className="w-4.5 h-4.5" />}
              accentColor="emerald"
              trend={{ value: 'Inflows', isPositive: true }}
            />
            <StatCard
              title="Expenses This Month"
              amount={formatINR(summary?.expensesThisMonth || 0)}
              subtitle="All debit transactions"
              icon={<ArrowDownLeft className="w-4.5 h-4.5" />}
              accentColor="rose"
              trend={{ value: 'Outflows', isPositive: false }}
            />
            <StatCard
              title="Savings This Month"
              amount={formatINR(summary?.savingsThisMonth || 0)}
              subtitle={`${summary?.savingsRate || 0}% Savings rate`}
              icon={<PiggyBank className="w-4.5 h-4.5" />}
              accentColor="amber"
              trend={{
                value: `${summary?.savingsRate || 0}% Rate`,
                isPositive: (summary?.savingsThisMonth || 0) >= 0,
              }}
            />
          </>
        )}
      </div>

      {/* Main Charts Section */}
      <div className="space-y-6">
        {/* Spending Trend Chart Card */}
        <Card className="p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
            <div>
              <CardTitle>Income & Expense Trend</CardTitle>
              <CardDescription>Daily cash inflows compared against debit expenditures</CardDescription>
            </div>

            {/* Time Range Filter Pills */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl self-start sm:self-auto border border-slate-200/50 dark:border-white/5">
              {(['today', '7d', '30d', '3m', '6m', '1y'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRangeChange(r)}
                  className={`px-3 py-1 text-xs font-bold tracking-tight rounded-lg transition-all whitespace-nowrap ${
                    timeRange === r
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {r === 'today' ? 'Today' : r === '7d' ? '7D' : r === '30d' ? '30D' : r === '3m' ? '3M' : r === '6m' ? '6M' : '1Y'}
                </button>
              ))}
            </div>
          </div>

          <ExpenseTrendChart data={spendingTrend} />
        </Card>

        {/* 2-Column Grid: Category Breakdown & Top Merchants */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5 sm:p-7">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle>Category Distribution</CardTitle>
              <CardDescription>Proportional spending across defined categories</CardDescription>
            </CardHeader>
            <CategoryBreakdownChart data={categoryBreakdown} />
          </Card>

          <Card className="p-5 sm:p-7">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle>Top Merchants</CardTitle>
              <CardDescription>Concentration of highest debit transactions</CardDescription>
            </CardHeader>
            <TopMerchantsChart data={topMerchants} />
          </Card>
        </div>
      </div>

      {/* Bottom Section: Goals & Upcoming widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GoalsWidget goals={goals} loading={goalsLoading} limit={3} />

        <UpcomingList
          upcoming={upcomingItems}
          loading={upcomingLoading}
          limit={4}
          footerLink={{ to: '/calendar', label: 'View calendar' }}
        />
      </div>

      {/* Recent Transactions List */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <CardTitle className="text-sm sm:text-base">Recent Ledger Activity</CardTitle>
                <CardDescription>Latest confirmed debits & credits</CardDescription>
              </div>
              <Link
                to="/transactions"
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-bold"
              >
                View all transactions
              </Link>
            </div>

            <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading && recentTransactions.length === 0 ? (
                <>
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                </>
              ) : recentTransactions.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 font-medium">
                  No transactions recorded yet. Click "+ Add Transaction" to begin.
                </div>
              ) : (
                recentTransactions.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  const cat = typeof tx.categoryId === 'object' && tx.categoryId !== null
                    ? tx.categoryId
                    : null;

                  return (
                    <div
                      key={tx._id}
                      onClick={() => setSelectedTx(tx)}
                      className="py-3 px-2 flex items-center justify-between hover:bg-slate-50/90 dark:hover:bg-slate-800/40 rounded-xl cursor-pointer transition-all duration-150 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${
                            isExpense
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          <CategoryIcon name={cat?.icon || 'Tag'} className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
                            {tx.merchant}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400 font-medium">
                              {formatRelativeDate(tx.transactionDate)}
                            </span>
                            <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                              {cat?.name || 'Uncategorized'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 pl-3">
                        <span
                          className={`text-xs sm:text-sm font-extrabold tabular-financial font-mono ${
                            isExpense
                              ? 'text-slate-900 dark:text-white'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isExpense ? '-' : '+'}
                          {formatINR(tx.amount)}
                        </span>
                        <span className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mt-0.5 tracking-wider">
                          {tx.paymentMethod}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link
              to="/transactions"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center gap-1 transition-colors"
            >
              Open Full Transactions Ledger
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Add Transaction Modal */}
      <TransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Transaction Details Drawer */}
      <TransactionDrawer
        transaction={selectedTx}
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        onEdit={(tx) => {
          setSelectedTx(null);
          setEditingTx(tx);
        }}
      />

      {/* Edit Transaction Modal */}
      {editingTx && (
        <TransactionModal
          isOpen={true}
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSuccess={() => {
            dispatch(fetchDashboardThunk(timeRange));
          }}
        />
      )}
    </div>
  );
};
