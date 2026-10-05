import React, { useEffect, useState } from 'react';
import { Plus, Repeat, Calendar, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import {
  fetchRecurringThunk,
  createRecurringThunk,
  deleteRecurringThunk,
} from '../store/slices/recurringSlice.js';
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
import { formatINR, formatDate } from '../utils/format.js';
import { RecurringFrequency, PaymentMethod, TransactionType } from '../types/index.js';

export const RecurringPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const recurringList = useAppSelector((state) => state.recurring.recurringList);
  const categories = useAppSelector((state) => state.categories.categories);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    dispatch(fetchRecurringThunk());
    dispatch(fetchCategoriesThunk());
  }, [dispatch]);

  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!name.trim() || isNaN(numAmount) || numAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await dispatch(
        createRecurringThunk({
          name: name.trim(),
          amount: numAmount,
          currency: 'INR',
          type,
          categoryId: categoryId || null,
          merchant: merchant.trim() || name.trim(),
          frequency,
          paymentMethod,
          startDate: new Date(startDate),
        })
      ).unwrap();
      setIsModalOpen(false);
      setName('');
      setAmount('');
      setMerchant('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalMonthlyCommitment = recurringList
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Recurring Bills & Subscriptions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track rent, Netflix, mutual fund SIPs, EMIs, and recurring monthly salary.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          onClick={() => setIsModalOpen(true)}
          className="shadow-2xs"
        >
          Add Recurring Item
        </Button>
      </div>

      {/* Summary KPI Tile */}
      {recurringList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-5 bg-gradient-to-b from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-900/60 border-slate-200/80 dark:border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Monthly Commitment
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-slate-900 dark:text-white mt-1.5">
              {formatINR(totalMonthlyCommitment)}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">Active recurring outflows</span>
          </Card>
          <Card className="p-5 bg-gradient-to-b from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-900/60 border-slate-200/80 dark:border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Subscriptions
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-slate-900 dark:text-white mt-1.5">
              {recurringList.length}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">Scheduled automated cycles</span>
          </Card>
        </div>
      )}

      {recurringList.length === 0 ? (
        <EmptyState
          icon={<Repeat className="w-8 h-8 text-slate-400" />}
          title="No recurring bills tracked"
          description="Add your house rent, OTT subscriptions, gym memberships, or SIP investments."
          actionText="Add your first recurring payment"
          onAction={() => setIsModalOpen(true)}
          className="py-16"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recurringList.map((item) => {
            const isExpense = item.type === 'expense';

            return (
              <Card key={item._id} interactive className="p-5 sm:p-6 flex flex-col justify-between group">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIconBox category={item.categoryId} categories={categories} size="lg" />
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                            {item.merchant}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <CategoryBadge category={item.categoryId} categories={categories} size="xs" />
                        </div>
                      </div>
                    </div>

                    <Badge variant={isExpense ? 'rose' : 'emerald'} dot>
                      {item.frequency.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between">
                    <span
                      className={`text-2xl font-extrabold font-mono tabular-financial ${
                        isExpense
                          ? 'text-slate-900 dark:text-white'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isExpense ? '-' : '+'}
                      {formatINR(item.amount)}
                    </span>
                    <span className="text-[11px] uppercase font-bold text-slate-400">
                      via {item.paymentMethod}
                    </span>
                  </div>

                  <div className="mt-4 p-3 bg-slate-50/80 dark:bg-slate-850/60 rounded-xl text-xs flex items-center justify-between text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/5">
                    <div className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      <span>Next Due:</span>
                    </div>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {formatDate(item.nextDueDate, 'dd MMM yyyy')}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end">
                  <button
                    onClick={() => {
                      if (confirm(`Remove recurring item "${item.name}"?`)) {
                        dispatch(deleteRecurringThunk(item._id));
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-500/10"
                    title="Delete recurring payment"
                    aria-label="Delete recurring payment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Recurring Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Recurring Transaction"
        description="Set up a regular monthly, weekly, or yearly payment."
      >
        <form onSubmit={handleCreateRecurring} className="space-y-4">
          <Input
            label="Name / Purpose"
            placeholder="e.g. Netflix Subscription, Flat Rent, Nifty SIP"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (INR)"
              type="number"
              min="1"
              placeholder="e.g. 649"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Input
              label="Merchant"
              placeholder="e.g. Netflix, Landlord"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => {
                  const newType = e.target.value as TransactionType;
                  setType(newType);
                  const currentCat = categories.find((c) => c._id === categoryId);
                  if (currentCat && currentCat.type !== newType && currentCat.type !== 'both') {
                    setCategoryId('');
                  }
                }}
                className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Category
              </label>
              <CategorySelect
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Select Category..."
                grouped
                typeFilter={type === 'income' ? 'income' : 'expense'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm"
              >
                <option value="upi">UPI</option>
                <option value="bank">Bank / Auto-Debit</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              First Due Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Save Recurring Item
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
