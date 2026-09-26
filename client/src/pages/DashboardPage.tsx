import React, { useEffect, useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  PiggyBank,
  Plus,
  RefreshCw,
  Repeat,
  ChevronRight,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import { fetchDashboardThunk, setTimeRange } from '../store/slices/dashboardSlice.js';
import { fetchPendingDetectedThunk } from '../store/slices/detectedTransactionSlice.js';
import { fetchUpcomingThunk } from '../store/slices/recurringSlice.js';
import { fetchCategoriesThunk } from '../store/slices/categorySlice.js';
import { StatCard } from '../components/ui/StatCard.js';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { StatCardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton.js';
import { CategoryIcon } from '../components/ui/CategoryIcon.js';
import { formatINR, formatDate, formatRelativeDate } from '../utils/format.js';
import { ExpenseTrendChart } from '../features/dashboard/ExpenseTrendChart.js';
import { CategoryBreakdownChart } from '../features/dashboard/CategoryBreakdownChart.js';
import { TopMerchantsChart } from '../features/dashboard/TopMerchantsChart.js';
import { DetectedTransactionReviewCenter } from '../features/emailSync/DetectedTransactionReviewCenter.js';
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

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    dispatch(fetchDashboardThunk(timeRange));
    dispatch(fetchPendingDetectedThunk());
    dispatch(fetchUpcomingThunk());
    dispatch(fetchCategoriesThunk());
  }, [dispatch, timeRange]);

  const handleRangeChange = (range: '7d' | '30d' | '3m' | '6m' | '1y') => {
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
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'User'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Here's your real-time financial intelligence and spending overview.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={() => dispatch(fetchDashboardThunk(timeRange))}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Quick Add Button */}
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Detected Transactions Review Center (Top priority if any pending) */}
      <DetectedTransactionReviewCenter />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              icon={<Wallet className="w-5 h-5" />}
              accentColor="indigo"
            />
            <StatCard
              title="Income This Month"
              amount={formatINR(summary?.incomeThisMonth || 0)}
              subtitle="Salary & inflows"
              icon={<ArrowUpRight className="w-5 h-5" />}
              accentColor="emerald"
              trend={{ value: '+100%', isPositive: true }}
            />
            <StatCard
              title="Expenses This Month"
              amount={formatINR(summary?.expensesThisMonth || 0)}
              subtitle="All debit transactions"
              icon={<ArrowDownLeft className="w-5 h-5" />}
              accentColor="rose"
            />
            <StatCard
              title="Savings This Month"
              amount={formatINR(summary?.savingsThisMonth || 0)}
              subtitle={`${summary?.savingsRate || 0}% Savings rate`}
              icon={<PiggyBank className="w-5 h-5" />}
              accentColor="amber"
              trend={{
                value: `${summary?.savingsRate || 0}%`,
                isPositive: (summary?.savingsThisMonth || 0) >= 0,
              }}
            />
          </>
        )}
      </div>

      {/* Main Charts Section */}
      <div className="space-y-6">
        {/* Spending Trend Chart Card */}
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
            <div>
              <CardTitle>Income & Expense Trend</CardTitle>
              <CardDescription>Daily cash flow vs spending patterns</CardDescription>
            </div>

            {/* Time Range Filter Pills */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
              {(['7d', '30d', '3m', '6m', '1y'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRangeChange(r)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    timeRange === r
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {r === '7d' ? '7D' : r === '30d' ? '30D' : r === '3m' ? '3M' : r === '6m' ? '6M' : '1Y'}
                </button>
              ))}
            </div>
          </div>

          <ExpenseTrendChart data={spendingTrend} />
        </Card>

        {/* 2-Column Grid: Category Breakdown & Top Merchants */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5 sm:p-6">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle>Category Spending</CardTitle>
              <CardDescription>Distribution of expenses by category</CardDescription>
            </CardHeader>
            <CategoryBreakdownChart data={categoryBreakdown} />
          </Card>

          <Card className="p-5 sm:p-6">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle>Top Merchants</CardTitle>
              <CardDescription>Where your money went the most</CardDescription>
            </CardHeader>
            <TopMerchantsChart data={topMerchants} />
          </Card>
        </div>
      </div>

      {/* Bottom Grid: Upcoming Recurring Bills & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Recurring Bills Card (1 col) */}
        <Card className="p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <CardTitle className="text-sm sm:text-base">Upcoming Bills</CardTitle>
              </div>
              <Link
                to="/recurring"
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold"
              >
                View all
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {upcomingBills.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No upcoming recurring bills
                </p>
              ) : (
                upcomingBills.slice(0, 4).map((bill) => (
                  <div
                    key={bill._id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {bill.name}
                      </p>
                      <p className="text-slate-400 mt-0.5">
                        Due {formatDate(bill.nextDueDate, 'dd MMM')}
                      </p>
                    </div>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100">
                      {formatINR(bill.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link
              to="/recurring"
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 flex items-center justify-center gap-1"
            >
              Manage subscriptions & EMI
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>

        {/* Recent Transactions List (2 cols) */}
        <Card className="lg:col-span-2 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <CardTitle className="text-sm sm:text-base">Recent Transactions</CardTitle>
                <CardDescription>Latest financial activity</CardDescription>
              </div>
              <Link
                to="/transactions"
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold"
              >
                View all transactions
              </Link>
            </div>

            <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading && recentTransactions.length === 0 ? (
                <>
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                </>
              ) : recentTransactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No transactions yet. Click "+ Add Transaction" to begin.
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
                      className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isExpense
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                          }`}
                        >
                          <CategoryIcon name={cat?.icon || 'Tag'} className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                            {tx.merchant}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {cat?.name || 'Uncategorized'} • {formatRelativeDate(tx.transactionDate)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs sm:text-sm font-extrabold ${
                            isExpense
                              ? 'text-slate-900 dark:text-slate-100'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isExpense ? '-' : '+'}
                          {formatINR(tx.amount)}
                        </span>
                        <span className="block text-[10px] uppercase font-semibold text-slate-400">
                          {tx.paymentMethod}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <Link
              to="/transactions"
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 flex items-center justify-center gap-1"
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
      />
    </div>
  );
};
