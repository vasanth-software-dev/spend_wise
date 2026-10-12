import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Scale, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card.js';
import { formatINR } from '../../utils/format.js';
import { MonthlyComparisonResult } from '../../utils/financialCalculations.js';

interface MonthlyComparisonSectionProps {
  comparison: MonthlyComparisonResult;
  loading?: boolean;
}

export const MonthlyComparisonSection: React.FC<MonthlyComparisonSectionProps> = ({ comparison, loading }) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card className="p-6">
        <div className="h-6 w-48 bg-slate-800 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-slate-800/60 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-800/60 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-800/60 rounded-xl animate-pulse" />
        </div>
      </Card>
    );
  }

  const { currentMonth, previousMonth, changes, categories } = comparison;

  // For expenses: spending decrease is positive (green), spending increase is negative (rose)
  const isExpenseDecreased = changes.expensesChangePercent <= 0;
  const isIncomeIncreased = changes.incomeChangePercent >= 0;
  const isSavingsIncreased = changes.savingsChangePercent >= 0;

  const handleCategoryClick = (categoryId: string) => {
    if (categoryId && categoryId !== 'uncategorized') {
      navigate(`/transactions?categoryId=${categoryId}`);
    } else {
      navigate('/transactions');
    }
  };

  return (
    <Card className="p-5 sm:p-7">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-4 h-4 text-brand-500" />
              <CardTitle className="text-base sm:text-lg">
                {currentMonth.name} vs {previousMonth.name}
              </CardTitle>
            </div>
            <CardDescription>
              Detailed comparative analysis between the current and previous billing cycles
            </CardDescription>
          </div>
          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            Month-over-Month
          </span>
        </div>
      </CardHeader>

      {/* 3 Core KPI Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
        {/* Income Comparison */}
        <div className="bg-slate-50/70 dark:bg-slate-850/60 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>Income Flow</span>
            <span
              className={`flex items-center gap-0.5 text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
                isIncomeIncreased
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isIncomeIncreased ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {isIncomeIncreased ? '+' : ''}
              {changes.incomeChangePercent}%
            </span>
          </div>
          <div className="space-y-1 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{currentMonth.name}:</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {formatINR(currentMonth.income)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{previousMonth.name}:</span>
              <span>{formatINR(previousMonth.income)}</span>
            </div>
          </div>
        </div>

        {/* Expenses Comparison (Polarity: Lower spend = Green, Higher spend = Rose) */}
        <div className="bg-slate-50/70 dark:bg-slate-850/60 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>Expenses Outflow</span>
            <span
              className={`flex items-center gap-0.5 text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
                isExpenseDecreased
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isExpenseDecreased ? <TrendingDown className="w-3 h-3 text-emerald-500" /> : <TrendingUp className="w-3 h-3 text-rose-500" />}
              {changes.expensesChangePercent > 0 ? '+' : ''}
              {changes.expensesChangePercent}%
            </span>
          </div>
          <div className="space-y-1 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{currentMonth.name}:</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {formatINR(currentMonth.expenses)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{previousMonth.name}:</span>
              <span>{formatINR(previousMonth.expenses)}</span>
            </div>
          </div>
        </div>

        {/* Savings Comparison */}
        <div className="bg-slate-50/70 dark:bg-slate-850/60 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-4 transition-all hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span>Net Monthly Savings</span>
            <span
              className={`flex items-center gap-0.5 text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
                isSavingsIncreased
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {isSavingsIncreased ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {isSavingsIncreased ? '+' : ''}
              {changes.savingsChangePercent}%
            </span>
          </div>
          <div className="space-y-1 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{currentMonth.name}:</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {formatINR(currentMonth.savings)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{previousMonth.name}:</span>
              <span>{formatINR(previousMonth.savings)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Level Shifts */}
      {categories.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/70">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Category-Level Shifts
            </h4>
            <span className="text-[11px] text-slate-400">Click category to view transactions</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {categories.slice(0, 6).map((cat) => {
              const isDecreased = !cat.isIncreased;
              return (
                <div
                  key={cat.categoryId}
                  onClick={() => handleCategoryClick(cat.categoryId)}
                  className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/60 hover:border-brand-500/40 dark:hover:border-brand-500/40 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.categoryColor || '#64748b' }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-brand-500 transition-colors">
                        {cat.categoryName}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">
                        {formatINR(cat.currentAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-1">
                    <span
                      className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded ${
                        isDecreased
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {cat.changePercentage > 0 ? '+' : ''}
                      {cat.changePercentage}%
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};
