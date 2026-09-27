import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import { createTransactionThunk, updateTransactionThunk } from '../../store/slices/transactionSlice.js';
import { fetchDashboardThunk } from '../../store/slices/dashboardSlice.js';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { CategoryIcon } from '../../components/ui/CategoryIcon.js';
import { TransactionType, PaymentMethod, Transaction } from '../../types/index.js';
import { toast } from '../..//components/ui/Toast.js';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: TransactionType;
  transaction?: Transaction | null;
  onSuccess?: (updated: Transaction) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'expense',
  transaction,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const categories = useAppSelector((state) => state.categories.categories);

  const isEditing = !!transaction;

  const [type, setType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (transaction) {
        setType(transaction.type);
        setAmount(String(transaction.amount));
        setMerchant(transaction.merchant || '');
        const catId =
          typeof transaction.categoryId === 'object' && transaction.categoryId !== null
            ? transaction.categoryId._id
            : (transaction.categoryId as string) || '';
        setCategoryId(catId);
        setPaymentMethod(transaction.paymentMethod || 'upi');
        setDate(
          transaction.transactionDate
            ? new Date(transaction.transactionDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]
        );
        setNotes(transaction.notes || '');
        setError(null);
      } else {
        setType(defaultType);
        setAmount('');
        setMerchant('');
        setNotes('');
        setError(null);
        setDate(new Date().toISOString().split('T')[0]);

        // Pick default category for type
        const defaultCat = categories.find((c) => c.type === defaultType || c.type === 'both');
        if (defaultCat) setCategoryId(defaultCat._id);
      }
    }
  }, [isOpen, transaction, defaultType, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }
    if (!merchant.trim()) {
      setError('Please provide a merchant, payee, or source name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && transaction) {
        const res = await dispatch(
          updateTransactionThunk({
            id: transaction._id,
            data: {
              type,
              amount: numAmount,
              currency: 'INR',
              categoryId: categoryId || null,
              merchant: merchant.trim(),
              paymentMethod,
              transactionDate: new Date(date),
              notes: notes.trim() || undefined,
            },
          })
        ).unwrap();

        toast.success('Transaction updated successfully');
        dispatch(fetchDashboardThunk('30d'));
        if (onSuccess) onSuccess(res);
        onClose();
      } else {
        await dispatch(
          createTransactionThunk({
            type,
            amount: numAmount,
            currency: 'INR',
            categoryId: categoryId || undefined,
            merchant: merchant.trim(),
            paymentMethod,
            transactionDate: new Date(date),
            notes: notes.trim() || undefined,
            source: 'manual',
          })
        ).unwrap();

        toast.success('Transaction created successfully');
        dispatch(fetchDashboardThunk('30d'));
        onClose();
      }
    } catch (err: any) {
      setError(err || 'Failed to save transaction');
      toast.error(err || 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentMethods: Array<{ id: PaymentMethod; label: string }> = [
    { id: 'upi', label: 'UPI (GPay/PhonePe/Paytm)' },
    { id: 'bank', label: 'Net Banking / IMPS' },
    { id: 'card', label: 'Debit / Credit Card' },
    { id: 'cash', label: 'Cash' },
    { id: 'wallet', label: 'Mobile Wallet' },
    { id: 'other', label: 'Other' },
  ];

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === 'both'
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Transaction' : 'Add Transaction'}
      description={
        isEditing
          ? 'Update transaction details in your financial ledger.'
          : 'Record a manual financial activity in your ledger.'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Transaction Type Segmented Control */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              type === 'expense'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              type === 'income'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => setType('transfer')}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              type === 'transfer'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Transfer
          </button>
        </div>

        {/* Large Numeric Amount Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Amount (INR)
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-4 text-2xl font-bold text-slate-400">
              ₹
            </span>
            <input
              type="number"
              step="any"
              min="0"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-300"
            />
          </div>
        </div>

        {/* Merchant / Payee */}
        <Input
          label={type === 'income' ? 'Received From (Source / Company)' : 'Paid To (Merchant / Payee)'}
          placeholder={type === 'income' ? 'e.g. Infosys, Freelance Client' : 'e.g. Swiggy, Amazon, Uber'}
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          required
        />

        {/* Category Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
            Category
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
            {filteredCategories.map((c) => (
              <button
                type="button"
                key={c._id}
                onClick={() => setCategoryId(c._id)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-all ${
                  categoryId === c._id
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-semibold ring-1 ring-brand-500'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${c.color}20` }}
                >
                  <CategoryIcon name={c.icon} className="w-4 h-4" color={c.color} />
                </div>
                <span className="text-[11px] truncate w-full">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Notes */}
        <Input
          label="Notes (Optional)"
          placeholder="e.g. Dinner with team, flat grocery split"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
            {isEditing ? 'Update Transaction' : 'Save Transaction'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
