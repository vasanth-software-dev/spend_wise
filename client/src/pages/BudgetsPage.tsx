import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, PiggyBank, Trash2, AlertTriangle, CheckCircle2, TrendingUp, ArrowRight } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import {
  fetchBudgetsThunk,
  createBudgetThunk,
  deleteBudgetThunk,
} from '../store/slices/budgetSlice.js';
import { fetchCategoriesThunk } from '../store/slices/categorySlice.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { CategorySelect } from '../components/ui/CategorySelect.js';
import { CategoryBadge } from '../components/ui/CategoryBadge.js';
import { CategoryIconBox } from '../components/ui/CategoryIconBox.js';
import { formatINR } from '../utils/format.js';
import { calculateBudgetPacing } from '../utils/financialCalculations.js';

export const BudgetsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const budgets = useAppSelector((state) => state.budgets.budgets);
  const categories = useAppSelector((state) => state.categories.categories);
  const transactions = useAppSelector((state) => state.transactions.transactions);
  const loading = useAppSelector((state) => state.budgets.loading);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [threshold, setThreshold] = useState('80');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    dispatch(fetchBudgetsThunk());
    dispatch(fetchCategoriesThunk());
  }, [dispatch]);

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!name.trim() || isNaN(numAmount) || numAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await dispatch(
        createBudgetThunk({
          name: name.trim(),
          amount: numAmount,
          categoryId: categoryId || null,
          notificationThreshold: parseInt(threshold) || 80,
        })
      ).unwrap();
      setIsModalOpen(false);
      setName('');
      setAmount('');
      setCategoryId('');
      setThreshold('80');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aggregate metrics
  const aggregate = useMemo(() => {
    const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);
    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const overBudgetCount = budgets.filter((b) => b.isExceeded).length;
    const warningCount = budgets.filter((b) => b.isWarning && !b.isExceeded).length;
    const overallPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    return { totalBudget, totalSpent, totalRemaining, overBudgetCount, warningCount, overallPercentage };
  }, [budgets]);

  const thresholdPresets = [50, 75, 80, 90, 100];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Budgets & Spending Limits
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Establish proactive spending guardrails with pace projections and smart threshold warnings.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsModalOpen(true)}
        >
          Create Budget
        </Button>
      </div>

      {/* Aggregate Overview KPI Banner */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-slate-900/40 border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Budget Pool
            </span>
            <div className="text-2xl font-extrabold text-white font-mono tabular-financial mt-1">
              {formatINR(aggregate.totalBudget)}
            </div>
            <span className="text-xs text-slate-500 mt-0.5 block">
              Across {budgets.length} configured targets
            </span>
          </Card>

          <Card className="p-4 bg-slate-900/40 border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Spent So Far
            </span>
            <div className="text-2xl font-extrabold text-rose-400 font-mono tabular-financial mt-1">
              {formatINR(aggregate.totalSpent)}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-semibold text-slate-400">
                {aggregate.overallPercentage}% allocated
              </span>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/40 border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Discretionary Remaining
            </span>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono tabular-financial mt-1">
              {formatINR(aggregate.totalRemaining)}
            </div>
            <span className="text-xs text-slate-500 mt-0.5 block">
              Until end of current cycle
            </span>
          </Card>

          <Card className="p-4 bg-slate-900/40 border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Health Status
            </span>
            <div className="text-lg font-bold text-white mt-1.5 flex items-center gap-2">
              {aggregate.overBudgetCount > 0 ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                  <span className="text-rose-400 text-sm font-semibold">
                    {aggregate.overBudgetCount} exceeded
                  </span>
                </>
              ) : aggregate.warningCount > 0 ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span className="text-amber-400 text-sm font-semibold">
                    {aggregate.warningCount} near threshold
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-emerald-400 text-sm font-semibold">
                    All budgets on track
                  </span>
                </>
              )}
            </div>
            <span className="text-xs text-slate-500 mt-0.5 block">
              Active monitoring enabled
            </span>
          </Card>
        </div>
      )}

      {budgets.length === 0 && !loading ? (
        <EmptyState
          icon={<PiggyBank className="w-8 h-8 text-slate-400" />}
          title="No budgets created yet"
          description="Set up monthly caps for Dining, Groceries, Shopping, or overall spending to keep expenses under control."
          actionText="Create your first budget"
          onAction={() => setIsModalOpen(true)}
          className="py-16"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((b) => {
            const cat =
              typeof b.categoryId === 'object' && b.categoryId !== null
                ? b.categoryId
                : null;

            const percentage = Math.min(100, b.percentageUsed);
            const pacing = calculateBudgetPacing(b, transactions);

            return (
              <Card key={b._id} interactive className="p-5 sm:p-6 flex flex-col justify-between group">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {cat && <CategoryIconBox category={b.categoryId} categories={categories} size="md" />}
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                          {b.name}
                        </h3>
                        <div className="mt-1">
                          {cat ? (
                            <CategoryBadge category={b.categoryId} categories={categories} size="xs" />
                          ) : (
                            <p className="text-xs text-slate-400 font-medium">
                              Overall Monthly Spending
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {b.isExceeded ? (
                      <Badge variant="rose" dot className="font-bold">
                        EXCEEDED
                      </Badge>
                    ) : b.isWarning ? (
                      <Badge variant="amber" dot className="font-bold">
                        NEAR LIMIT ({b.percentageUsed}%)
                      </Badge>
                    ) : (
                      <Badge variant="emerald" dot className="font-bold">
                        HEALTHY
                      </Badge>
                    )}
                  </div>

                  {/* Amounts */}
                  <div className="mt-5 flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-financial">
                        {formatINR(b.spent)}
                      </span>
                      <span className="text-xs text-slate-400 font-medium ml-1.5">
                        spent
                      </span>
                    </div>
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                      Cap:{' '}
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        {formatINR(b.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3.5 space-y-2">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ease-out-expo ${b.isExceeded
                            ? 'bg-rose-500'
                            : b.isWarning
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                          }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-400 font-mono">{b.percentageUsed}% utilized</span>
                      <span className={b.isExceeded ? 'text-rose-500 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                        {b.isExceeded
                          ? `₹${(b.spent - b.amount).toLocaleString('en-IN')} over cap`
                          : `₹${b.remaining.toLocaleString('en-IN')} remaining`}
                      </span>
                    </div>
                  </div>

                  {/* Spending Pace & Projected Overrun Note */}
                  <div className={`mt-4 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                    pacing.isPaceExceeding
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                      : 'bg-slate-850/60 border-white/5 text-slate-400'
                  }`}>
                    {pacing.isPaceExceeding ? (
                      <TrendingUp className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="leading-snug">
                      <span className="font-semibold text-white">
                        {pacing.isPaceExceeding ? 'Pacing Alert: ' : 'Pace: '}
                      </span>
                      {pacing.paceMessage}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      Alert at {b.notificationThreshold || 80}%
                    </span>
                    {cat && (
                      <button
                        type="button"
                        onClick={() => navigate(`/transactions?categoryId=${cat._id}`)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 ml-2"
                      >
                        Ledger <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Delete budget "${b.name}"?`)) {
                        dispatch(deleteBudgetThunk(b._id));
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-500/10"
                    title="Delete budget"
                    aria-label="Delete budget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Budget Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Spending Budget"
        description="Set a target limit for a specific category or your entire monthly outflow."
      >
        <form onSubmit={handleCreateBudget} className="space-y-4">
          <Input
            label="Budget Name"
            placeholder="e.g. Dining Out & Takeout"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Budget Limit (INR)"
            type="number"
            min="1"
            placeholder="e.g. 10000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Category (Optional, leave blank for total monthly budget)
            </label>
            <CategorySelect
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="All Spending (Overall Monthly)"
              grouped
              typeFilter="expense"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Warning Notification Threshold (%)
            </label>
            <div className="flex items-center gap-2 mb-2">
              {thresholdPresets.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setThreshold(String(pct))}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                    threshold === String(pct)
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <input
              type="number"
              min="50"
              max="99"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Establish Budget
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
