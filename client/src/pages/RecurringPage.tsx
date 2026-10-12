import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Repeat, Calendar, Trash2, Sparkles, Check } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import {
  fetchRecurringThunk,
  createRecurringThunk,
  deleteRecurringThunk,
  updateRecurringThunk,
  processRecurringThunk,
} from '../store/slices/recurringSlice.js';
import { fetchCategoriesThunk } from '../store/slices/categorySlice.js';
import { fetchTransactionsThunk } from '../store/slices/transactionSlice.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { ConfirmModal } from '../components/ui/ConfirmModal.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { CategorySelect } from '../components/ui/CategorySelect.js';
import { CategoryBadge } from '../components/ui/CategoryBadge.js';
import { CategoryIconBox } from '../components/ui/CategoryIconBox.js';
import { toast } from '../components/ui/Toast.js';
import { formatINR, formatDate } from '../utils/format.js';
import { RecurringFrequency, PaymentMethod, TransactionType } from '../types/index.js';

interface DetectedRecurringCandidate {
  merchant: string;
  amount: number;
  count: number;
  type: TransactionType;
  categoryId?: string | null;
  paymentMethod: PaymentMethod;
}

export const RecurringPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const recurringList = useAppSelector((state) => state.recurring.recurringList);
  const categories = useAppSelector((state) => state.categories.categories);
  const transactions = useAppSelector((state) => state.transactions.transactions);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubscription, setIsSubscription] = useState(false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'subscriptions' | 'bills' | 'dueSoon' | 'income'>('all');

  useEffect(() => {
    dispatch(fetchRecurringThunk());
    dispatch(fetchCategoriesThunk());
    dispatch(fetchTransactionsThunk({ limit: 100 }));
  }, [dispatch]);

  const handleRecordPayment = async (id: string, name: string) => {
    setProcessingId(id);
    try {
      await dispatch(processRecurringThunk(id)).unwrap();
      dispatch(fetchTransactionsThunk({ limit: 100 }));
      toast.success(`Payment recorded for "${name}" and next due date updated!`);
    } catch (err: any) {
      if (typeof err === 'string' && (err.includes('already recorded') || err.includes('ALREADY_PROCESSED'))) {
        toast.info('Payment was already recorded recently for this cycle.');
      } else {
        toast.error(err || 'Failed to record recurring payment');
      }
    } finally {
      setProcessingId(null);
    }
  };

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
          isSubscription,
          reminderDaysBefore: Number(reminderDaysBefore),
        })
      ).unwrap();
      setIsModalOpen(false);
      setName('');
      setAmount('');
      setMerchant('');
      setIsSubscription(false);
      setReminderDaysBefore(3);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    dispatch(updateRecurringThunk({ id, data: { isActive: !currentActive } }));
  };

  // Calculations for Monthly recurring commitments
  const { totalMonthlyCommitments, next30DaysCommitments, activeCount } = useMemo(() => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let monthly = 0;
    let next30 = 0;
    let active = 0;

    recurringList.forEach((item) => {
      const isActive = item.isActive !== false;
      if (isActive) active++;

      if (item.type === 'expense' && isActive) {
        // Calculate monthly equivalent
        switch (item.frequency) {
          case 'daily':
            monthly += item.amount * 30;
            break;
          case 'weekly':
            monthly += item.amount * 4.33;
            break;
          case 'yearly':
            monthly += item.amount / 12;
            break;
          case 'monthly':
          default:
            monthly += item.amount;
            break;
        }

        // Check if next due date is within next 30 days
        const dueDate = new Date(item.nextDueDate);
        if (dueDate >= now && dueDate <= in30Days) {
          next30 += item.amount;
        }
      }
    });

    return {
      totalMonthlyCommitments: Math.round(monthly),
      next30DaysCommitments: Math.round(next30),
      activeCount: active,
    };
  }, [recurringList]);

  const getDueInfo = (dateStr: string | Date) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return {
      diffDays,
      isOverdue: diffDays < 0,
      isDueToday: diffDays === 0,
      isDueSoon: diffDays >= 0 && diffDays <= 7,
    };
  };

  const dueSoonCount = useMemo(() => {
    return recurringList.filter((item) => {
      if (item.isActive === false) return false;
      const { diffDays } = getDueInfo(item.nextDueDate);
      return diffDays <= 7;
    }).length;
  }, [recurringList]);

  const subscriptionCount = useMemo(
    () => recurringList.filter((i) => Boolean(i.isSubscription)).length,
    [recurringList]
  );
  const billCount = useMemo(
    () => recurringList.filter((i) => i.type === 'expense' && !i.isSubscription).length,
    [recurringList]
  );
  const incomeCount = useMemo(
    () => recurringList.filter((i) => i.type === 'income').length,
    [recurringList]
  );

  const filteredRecurring = useMemo(() => {
    return recurringList.filter((item) => {
      if (activeTab === 'dueSoon') {
        if (item.isActive === false) return false;
        const { diffDays } = getDueInfo(item.nextDueDate);
        return diffDays <= 7;
      }
      if (activeTab === 'subscriptions') return Boolean(item.isSubscription);
      if (activeTab === 'bills') return item.type === 'expense' && !item.isSubscription;
      if (activeTab === 'income') return item.type === 'income';
      return true;
    });
  }, [recurringList, activeTab]);

  // Detect repeating transactions from transaction ledger
  const detectedCandidates = useMemo(() => {
    if (!transactions || transactions.length < 2) return [];

    const existingMerchants = new Set(
      recurringList.map((r) => r.merchant.toLowerCase().trim())
    );

    // Group transactions by lowercased merchant
    const merchantMap = new Map<string, typeof transactions>();
    transactions.forEach((tx) => {
      if (!tx.merchant || tx.type !== 'expense') return;
      const key = tx.merchant.toLowerCase().trim();
      if (existingMerchants.has(key)) return; // already tracked

      const list = merchantMap.get(key) || [];
      list.push(tx);
      merchantMap.set(key, list);
    });

    const candidates: DetectedRecurringCandidate[] = [];

    merchantMap.forEach((txs, _) => {
      if (txs.length >= 2) {
        // Check if same or very similar amount
        const firstAmount = txs[0].amount;
        const allSimilar = txs.filter((t) => Math.abs(t.amount - firstAmount) <= 1);
        if (allSimilar.length >= 2) {
          candidates.push({
            merchant: txs[0].merchant,
            amount: firstAmount,
            count: allSimilar.length,
            type: 'expense',
            categoryId: typeof txs[0].categoryId === 'string' ? txs[0].categoryId : (txs[0].categoryId as any)?._id || null,
            paymentMethod: txs[0].paymentMethod || 'upi',
          });
        }
      }
    });

    return candidates.slice(0, 3);
  }, [transactions, recurringList]);

  const handleAcceptCandidate = (candidate: DetectedRecurringCandidate) => {
    setName(`${candidate.merchant} Subscription`);
    setMerchant(candidate.merchant);
    setAmount(String(candidate.amount));
    setType('expense');
    setCategoryId(candidate.categoryId || '');
    setFrequency('monthly');
    setPaymentMethod(candidate.paymentMethod);
    setIsSubscription(true);
    setReminderDaysBefore(3);
    setIsModalOpen(true);
  };

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

      {/* Summary KPI Tiles */}
      {recurringList.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 bg-gradient-to-b from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-900/60 border-slate-200/80 dark:border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monthly Recurring Commitments
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-slate-900 dark:text-white mt-1.5">
              {formatINR(totalMonthlyCommitments)}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Estimated recurring outflow / mo
            </span>
          </Card>

          <Card className="p-5 bg-gradient-to-b from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-900/60 border-slate-200/80 dark:border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Next 30 Days Due
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-amber-500 dark:text-amber-400 mt-1.5">
              {formatINR(next30DaysCommitments)}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Obligations scheduled in next 30 days
            </span>
          </Card>

          <Card className="p-5 bg-gradient-to-b from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-900/60 border-slate-200/80 dark:border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Subscriptions
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-emerald-600 dark:text-emerald-400 mt-1.5">
              {activeCount}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              {recurringList.length - activeCount > 0 ? `${recurringList.length - activeCount} paused` : 'All cycles running'}
            </span>
          </Card>
        </div>
      )}

      {/* Repeating Transaction Detection Banner (Section 13) */}
      {detectedCandidates.length > 0 && (
        <Card className="p-4 bg-emerald-950/20 border-emerald-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Possible Recurring Payments Detected
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  We identified repeated transactions in your ledger. Confirm to track them as recurring rules:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {detectedCandidates.map((c) => (
                    <button
                      key={c.merchant}
                      type="button"
                      onClick={() => handleAcceptCandidate(c)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-colors"
                    >
                      <span>{c.merchant}</span>
                      <span className="font-mono font-bold text-white">{formatINR(c.amount)}</span>
                      <span className="text-[10px] text-emerald-400/80">({c.count}x detected)</span>
                      <Check className="w-3 h-3 ml-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
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
        <>
          <div className="flex items-center gap-1.5 border-b border-slate-200/70 dark:border-white/5 pb-2 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Schedules ({recurringList.length})
            </button>
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'subscriptions'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Subscriptions ({subscriptionCount})
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'bills'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Bills & Expenses ({billCount})
            </button>
            <button
              onClick={() => setActiveTab('dueSoon')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                activeTab === 'dueSoon'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Due Soon (≤ 7 Days)</span>
              {dueSoonCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'dueSoon' ? 'bg-amber-600 text-white' : 'bg-amber-500/20 text-amber-500'
                  }`}
                >
                  {dueSoonCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('income')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'income'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Recurring Income ({incomeCount})
            </button>
          </div>

          {filteredRecurring.length === 0 ? (
            <EmptyState
              icon={<Repeat className="w-8 h-8 text-slate-400" />}
              title="No items in this filter"
              description="No recurring schedules match your selected filter view."
              actionText="View all schedules"
              onAction={() => setActiveTab('all')}
              className="py-12"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRecurring.map((item) => {
                const isExpense = item.type === 'expense';
                const isActive = item.isActive !== false;
                const { diffDays, isOverdue, isDueToday } = getDueInfo(item.nextDueDate);

                return (
                  <Card
                    key={item._id}
                    interactive
                    className={`p-5 sm:p-6 flex flex-col justify-between group transition-opacity ${
                      !isActive ? 'opacity-60 bg-slate-900/30' : ''
                    }`}
                  >
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
                              {item.isSubscription && (
                                <>
                                  <span className="text-slate-300 dark:text-slate-600">•</span>
                                  <Badge variant="purple" size="sm">
                                    Subscription
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <Badge variant={isExpense ? 'rose' : 'emerald'} dot>
                            {item.frequency.toUpperCase()}
                          </Badge>
                          <Badge variant={isActive ? 'emerald' : 'slate'} size="sm">
                            {isActive ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
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

                      <div className="mt-4 p-3 bg-slate-50/80 dark:bg-slate-850/60 rounded-xl text-xs space-y-2 border border-slate-200/60 dark:border-white/5">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                            <span>Next Due:</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-slate-900 dark:text-white">
                              {formatDate(item.nextDueDate, 'dd MMM yyyy')}
                            </span>
                            {isActive && isOverdue && (
                              <Badge variant="rose" size="sm">
                                Overdue by {Math.abs(diffDays)}d
                              </Badge>
                            )}
                            {isActive && isDueToday && (
                              <Badge variant="amber" size="sm">
                                Due Today
                              </Badge>
                            )}
                            {isActive && !isOverdue && !isDueToday && diffDays <= 7 && (
                              <Badge variant="amber" size="sm">
                                Due in {diffDays}d
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200/50 dark:border-white/5">
                          <span className="flex items-center gap-1 font-medium">
                            🔔 Remind {item.reminderDaysBefore === 0 ? 'on due date' : `${item.reminderDaysBefore ?? 3}d prior`}
                          </span>
                          {item.lastProcessedDate && (
                            <span className="text-slate-400 dark:text-slate-500">
                              Last paid: {formatDate(item.lastProcessedDate, 'dd MMM')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleRecordPayment(item._id, item.name)}
                      disabled={!isActive || processingId === item._id}
                      isLoading={processingId === item._id}
                      className="text-xs py-1 px-3 shadow-2xs"
                    >
                      Pay / Record
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(item._id, isActive)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                        isActive
                          ? 'text-slate-400 hover:text-amber-400 border-slate-200 dark:border-slate-800 hover:border-amber-500/30'
                          : 'text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10'
                      }`}
                    >
                      {isActive ? 'Pause' : 'Resume'}
                    </button>
                  </div>

                  <button
                    onClick={() => setItemToDelete(item)}
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
    </>
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

          <div className="p-3 bg-slate-50 dark:bg-slate-850/70 rounded-xl border border-slate-200/70 dark:border-white/5 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isSubscription}
                onChange={(e) => setIsSubscription(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Mark as Subscription (SaaS, Streaming OTT, Gym, Memberships)
              </span>
            </label>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Due Reminder Alert
              </label>
              <select
                value={reminderDaysBefore}
                onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
                className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value={0}>On due date</option>
                <option value={1}>1 day before</option>
                <option value={2}>2 days before</option>
                <option value={3}>3 days before (Recommended)</option>
                <option value={5}>5 days before</option>
                <option value={7}>7 days before</option>
              </select>
            </div>
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

      <ConfirmModal
        isOpen={!!itemToDelete}
        title="Remove Recurring Payment"
        message={`Are you sure you want to remove "${itemToDelete?.name}"? Future occurrences will no longer be tracked or projected on your calendar.`}
        confirmText="Remove Rule"
        onConfirm={() => {
          if (itemToDelete) {
            dispatch(deleteRecurringThunk(itemToDelete._id));
            setItemToDelete(null);
          }
        }}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
