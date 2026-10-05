import React, { useEffect, useState, useMemo } from 'react';
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
import { fetchBudgetsThunk } from '../store/slices/budgetSlice.js';
import { fetchDebtsThunk } from '../store/slices/debtSlice.js';
import { fetchCalendarUpcomingThunk } from '../store/slices/calendarSlice.js';
import { fetchNetWorthThunk } from '../store/slices/accountSlice.js';
import { StatCard } from '../components/ui/StatCard.js';
import { Card, CardHeader, CardTitle, CardDescription } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { StatCardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton.js';
import { CategoryBadge } from '../components/ui/CategoryBadge.js';
import { CategoryIconBox } from '../components/ui/CategoryIconBox.js';
import { formatINR, formatRelativeDate } from '../utils/format.js';
import {
  calculateSafeToSpend,
  calculateFinancialHealthScore,
  generateSpendingInsights,
} from '../utils/financialCalculations.js';
import { ExpenseTrendChart } from '../features/dashboard/ExpenseTrendChart.js';
import { CategoryBreakdownChart } from '../features/dashboard/CategoryBreakdownChart.js';
import { TopMerchantsChart } from '../features/dashboard/TopMerchantsChart.js';
import { SafeToSpendCard } from '../features/dashboard/SafeToSpendCard.js';
import { MonthlyComparisonSection } from '../features/dashboard/MonthlyComparisonSection.js';
import { FinancialHealthWidget } from '../features/dashboard/FinancialHealthWidget.js';
import { SpendingInsightsWidget } from '../features/dashboard/SpendingInsightsWidget.js';
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
    previousSummary,
    previousCategoryBreakdown,
    spendingTrend,
    categoryBreakdown,
    topMerchants,
    recentTransactions,
    timeRange,
    loading,
  } = useAppSelector((state) => state.dashboard);

  const upcomingBills = useAppSelector((state) => state.recurring.upcomingList);
  const categories = useAppSelector((state) => state.categories.categories);
  const goals = useAppSelector((state) => state.goals.goals);
  const goalsLoading = useAppSelector((state) => state.goals.loading);
  const budgets = useAppSelector((state) => state.budgets.budgets);
  const debts = useAppSelector((state) => state.debts.debts);
  const calendarUpcoming = useAppSelector((state) => state.calendar.upcoming);
  const upcomingLoading = useAppSelector((state) => state.calendar.upcomingLoading);
  const netWorthSummary = useAppSelector((state) => state.accounts.netWorthSummary);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    dispatch(fetchDashboardThunk(timeRange));
    dispatch(fetchPendingDetectedThunk());
    dispatch(fetchUpcomingThunk());
    dispatch(fetchCategoriesThunk());
    dispatch(fetchGoalsThunk());
    dispatch(fetchBudgetsThunk());
    dispatch(fetchDebtsThunk());
    dispatch(fetchCalendarUpcomingThunk(30));
    dispatch(fetchNetWorthThunk());
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

  // Safe to Spend calculation
  const safeToSpendResult = useMemo(() => {
    return calculateSafeToSpend({
      currentBalance: summary?.totalBalance || 0,
      upcomingBills: upcomingBills.map((b) => ({
        amount: b.amount,
        type: b.type,
        nextDueDate: b.nextDueDate,
      })),
      plannedDebts: debts.map((d) => ({
        originalAmount: d.originalAmount,
        remainingAmount: d.remainingAmount,
        dueDate: d.dueDate,
        direction: d.direction,
      })),
    });
  }, [summary?.totalBalance, upcomingBills, debts]);

  // Monthly Comparison calculation
  const comparisonResult = useMemo(() => {
    const curMonthName = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date());
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonthName = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(prevDate);

    const curIncome = summary?.incomeThisMonth || 0;
    const curExpense = summary?.expensesThisMonth || 0;
    const curSavings = curIncome - curExpense;
    const curSavingsRate = curIncome > 0 ? Math.round((curSavings / curIncome) * 100) : 0;

    const prevIncome = previousSummary?.incomeThisMonth || 0;
    const prevExpense = previousSummary?.expensesThisMonth || 0;
    const prevSavings = prevIncome - prevExpense;
    const prevSavingsRate = prevIncome > 0 ? Math.round((prevSavings / prevIncome) * 100) : 0;

    const incomeChangePercent = summary?.incomeChangePercent ?? 0;
    const expensesChangePercent = summary?.expensesChangePercent ?? 0;
    const savingsChangePercent = summary?.savingsChangePercent ?? 0;

    // Map categories comparison
    const curCatMap = new Map(categoryBreakdown.map((c) => [c.categoryName, c]));
    const prevCatMap = new Map(previousCategoryBreakdown.map((c) => [c.categoryName, c]));

    const allCatNames = Array.from(new Set([...curCatMap.keys(), ...prevCatMap.keys()]));
    const comparedCategories = allCatNames.map((name) => {
      const cur = curCatMap.get(name);
      const prev = prevCatMap.get(name);
      const curAmt = cur?.totalAmount || 0;
      const prevAmt = prev?.totalAmount || 0;
      const change = prevAmt > 0
        ? Math.round(((curAmt - prevAmt) / prevAmt) * 1000) / 10
        : (curAmt > 0 ? 100 : 0);

      return {
        categoryId: cur?._id || prev?._id || name,
        categoryName: name,
        categoryColor: cur?.categoryColor || prev?.categoryColor || '#64748b',
        currentAmount: curAmt,
        previousAmount: prevAmt,
        changePercentage: change,
        isIncreased: curAmt > prevAmt,
      };
    });

    comparedCategories.sort((a, b) => b.currentAmount - a.currentAmount);

    return {
      currentMonth: {
        name: curMonthName,
        income: curIncome,
        expenses: curExpense,
        savings: curSavings,
        savingsRate: curSavingsRate,
      },
      previousMonth: {
        name: prevMonthName,
        income: prevIncome,
        expenses: prevExpense,
        savings: prevSavings,
        savingsRate: prevSavingsRate,
      },
      changes: {
        incomeChangePercent,
        expensesChangePercent,
        savingsChangePercent,
      },
      categories: comparedCategories,
    };
  }, [summary, previousSummary, categoryBreakdown, previousCategoryBreakdown]);

  // Deterministic Financial Health Score
  const healthScore = useMemo(() => {
    return calculateFinancialHealthScore({
      monthlyIncome: summary?.incomeThisMonth || 0,
      monthlyExpenses: summary?.expensesThisMonth || 0,
      savingsRate: summary?.savingsRate || 0,
      budgets,
      transactions: recentTransactions,
      upcomingObligations: safeToSpendResult.upcomingObligations,
      currentBalance: summary?.totalBalance || 0,
    });
  }, [summary, budgets, recentTransactions, safeToSpendResult]);

  // Real Spending Insights
  const spendingInsights = useMemo(() => {
    return generateSpendingInsights({
      monthlyComparison: comparisonResult,
      budgets,
      transactions: recentTransactions,
      upcomingBills,
      safeToSpend: safeToSpendResult,
    });
  }, [comparisonResult, budgets, recentTransactions, upcomingBills, safeToSpendResult]);

  // Trend indicator helpers
  const balanceChange = summary?.balanceChangePercent || 0;
  const isBalancePositive = balanceChange >= 0;

  const incomeChange = summary?.incomeChangePercent || 0;
  const isIncomePositive = incomeChange >= 0;

  // Expenses: decrease is positive (+), increase is negative (-)
  const expenseChange = summary?.expensesChangePercent || 0;
  const isExpenseFavorable = expenseChange <= 0;

  const savingsChange = summary?.savingsChangePercent || 0;
  const isSavingsPositive = savingsChange >= 0;

  const prevMonthName = comparisonResult.previousMonth.name;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">
              Personal Financial Command Center
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
          {netWorthSummary && (
            <Link
              to="/accounts"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-500/40 transition-colors shadow-2xs group"
              title="View all financial accounts and net worth balance sheet"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-300">
                Net Worth:
              </span>
              <span className={`text-xs font-bold font-mono ${
                netWorthSummary.netWorth >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-400'
              }`}>
                {formatINR(netWorthSummary.netWorth)}
              </span>
            </Link>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => dispatch(fetchDashboardThunk(timeRange))}
            className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-[background-color,border-color] duration-150 ease-out-expo shadow-2xs"
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
            {/* 1. Total Balance */}
            <StatCard
              title="Total Balance"
              amount={formatINR(summary?.totalBalance || 0)}
              subtitle="All-time confirmed balance"
              icon={<Wallet className="w-4.5 h-4.5" />}
              accentColor="emerald"
              isHero={true}
              trend={{
                value: balanceChange !== 0
                  ? `${isBalancePositive ? '+' : ''}${balanceChange}% vs ${prevMonthName}`
                  : (summary?.totalBalance || 0) >= 0 ? 'Active Positive' : 'Deficit',
                isPositive: isBalancePositive,
              }}
            />

            {/* 2. Income This Month */}
            <StatCard
              title="Income This Month"
              amount={formatINR(summary?.incomeThisMonth || 0)}
              subtitle={
                summary?.salaryIncome && summary?.salaryIncome > 0
                  ? `Salary: ${formatINR(summary.salaryIncome)} · Other: ${formatINR(summary?.otherIncome || 0)}`
                  : 'Total monthly cash inflows'
              }
              icon={<ArrowUpRight className="w-4.5 h-4.5" />}
              accentColor="emerald"
              trend={{
                value: incomeChange !== 0 ? `${isIncomePositive ? '+' : ''}${incomeChange}% vs ${prevMonthName}` : 'Inflows',
                isPositive: isIncomePositive,
              }}
            />

            {/* 3. Expenses This Month */}
            <StatCard
              title="Expenses This Month"
              amount={formatINR(summary?.expensesThisMonth || 0)}
              subtitle={`${summary?.expenseCount || 0} transactions recorded`}
              icon={<ArrowDownLeft className="w-4.5 h-4.5" />}
              accentColor={isExpenseFavorable ? 'emerald' : 'rose'}
              trend={{
                value: expenseChange !== 0 ? `${expenseChange > 0 ? '+' : ''}${expenseChange}% vs ${prevMonthName}` : 'Outflows',
                isPositive: isExpenseFavorable,
              }}
            />

            {/* 4. Savings This Month (Savings = Income - Expenses) */}
            <StatCard
              title="Savings This Month"
              amount={formatINR(summary?.savingsThisMonth || 0)}
              subtitle={`${summary?.savingsRate || 0}% Savings rate (Income - Expense)`}
              icon={<PiggyBank className="w-4.5 h-4.5" />}
              accentColor="amber"
              trend={{
                value: savingsChange !== 0 ? `${isSavingsPositive ? '+' : ''}${savingsChange}% vs ${prevMonthName}` : `${summary?.savingsRate || 0}% Rate`,
                isPositive: (summary?.savingsThisMonth || 0) >= 0,
              }}
            />
          </>
        )}
      </div>

      {/* Safe to Spend Hero Component */}
      <SafeToSpendCard safeToSpendData={safeToSpendResult} loading={loading && !summary} />

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
                  className={`px-3 py-1 text-xs font-bold tracking-tight rounded-lg transition-[background-color,color] duration-150 ease-out-expo whitespace-nowrap ${
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Category Distribution</CardTitle>
                  <CardDescription>Proportional spending across defined categories</CardDescription>
                </div>
                <span className="text-[11px] text-slate-400">Click to filter</span>
              </div>
            </CardHeader>
            <CategoryBreakdownChart data={categoryBreakdown} />
          </Card>

          <Card className="p-5 sm:p-7">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Top Merchants</CardTitle>
                  <CardDescription>Highest debit concentration with previous period shifts</CardDescription>
                </div>
                <span className="text-[11px] text-slate-400">Click to filter</span>
              </div>
            </CardHeader>
            <TopMerchantsChart data={topMerchants} />
          </Card>
        </div>
      </div>

      {/* Dedicated Monthly Comparison Section */}
      <MonthlyComparisonSection comparison={comparisonResult} loading={loading && !summary} />

      {/* 2-Column Grid: Financial Health & Spending Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinancialHealthWidget healthScore={healthScore} loading={loading && !summary} />
        <SpendingInsightsWidget insights={spendingInsights} loading={loading && !summary} />
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
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center mx-auto mb-3">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No expenses or income recorded yet
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                    Start tracking your financial transactions to see real-time balance calculations, spending pace, and intelligent insights.
                  </p>
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => setIsAddModalOpen(true)}
                  >
                    Add your first transaction
                  </Button>
                </div>
              ) : (
                recentTransactions.map((tx) => {
                  const isExpense = tx.type === 'expense';

                  return (
                    <div
                      key={tx._id}
                      onClick={() => setSelectedTx(tx)}
                      className="py-3 px-2 flex items-center justify-between hover:bg-slate-50/90 dark:hover:bg-slate-800/40 rounded-xl cursor-pointer transition-[background-color] duration-150 ease-out-expo group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIconBox
                          category={tx.categoryId}
                          categories={categories}
                          size="lg"
                          className="group-hover:scale-105"
                        />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
                            {tx.merchant}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400 font-medium">
                              {formatRelativeDate(tx.transactionDate)}
                            </span>
                            <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                            <CategoryBadge category={tx.categoryId} categories={categories} size="xs" />
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
