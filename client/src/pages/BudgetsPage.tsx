import React, { useEffect, useState } from 'react';
import { Plus, PiggyBank, AlertTriangle, AlertCircle, Trash2 } from 'lucide-react';
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
import { formatINR } from '../utils/format.js';

export const BudgetsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const budgets = useAppSelector((state) => state.budgets.budgets);
  const categories = useAppSelector((state) => state.categories.categories);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Budgets & Spending Limits
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Establish proactive spending guardrails with automatic 80% threshold warnings.
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

            return (
              <Card key={b._id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {b.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {cat?.name || 'Overall Monthly Spending'}
                      </p>
                    </div>

                    {b.isExceeded ? (
                      <Badge variant="rose" className="gap-1 font-bold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        EXCEEDED
                      </Badge>
                    ) : b.isWarning ? (
                      <Badge variant="amber" className="gap-1 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        NEAR LIMIT ({b.percentageUsed}%)
                      </Badge>
                    ) : (
                      <Badge variant="emerald" className="font-bold">
                        HEALTHY
                      </Badge>
                    )}
                  </div>

                  {/* Amounts */}
                  <div className="mt-5 flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                        {formatINR(b.spent)}
                      </span>
                      <span className="text-xs text-slate-400 font-medium ml-1">
                        spent
                      </span>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      Cap:{' '}
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {formatINR(b.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          b.isExceeded
                            ? 'bg-rose-500'
                            : b.isWarning
                            ? 'bg-amber-500'
                            : 'bg-brand-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>{b.percentageUsed}% utilized</span>
                      <span>
                        {b.isExceeded
                          ? `₹${(b.spent - b.amount).toLocaleString('en-IN')} over cap`
                          : `₹${b.remaining.toLocaleString('en-IN')} remaining`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                  <button
                    onClick={() => {
                      if (confirm(`Delete budget "${b.name}"?`)) {
                        dispatch(deleteBudgetThunk(b._id));
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg"
                    title="Delete budget"
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
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm"
            >
              <option value="">All Spending (Overall Monthly)</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Warning Notification Threshold (%)
            </label>
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
