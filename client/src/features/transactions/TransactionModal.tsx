import React, { useState, useEffect } from 'react';
import { ScanLine } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import { createTransactionThunk, updateTransactionThunk } from '../../store/slices/transactionSlice.js';
import { fetchDashboardThunk } from '../../store/slices/dashboardSlice.js';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { CategoryIcon } from '../../components/ui/CategoryIcon.js';
import { ReceiptScannerModal } from '../receiptScanner/ReceiptScannerModal.js';
import { TransactionType, PaymentMethod, Transaction } from '../../types/index.js';
import { toast } from '../..//components/ui/Toast.js';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: TransactionType;
  /** Pre-fills the date field, e.g. when adding from a calendar day. */
  defaultDate?: string | null;
  transaction?: Transaction | null;
  onSuccess?: (updated: Transaction) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'expense',
  defaultDate,
  transaction,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const categories = useAppSelector((state) => state.categories.categories);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const isEditing = !!transaction;
  const initialDate = defaultDate || new Date().toISOString().split('T')[0];

  const [type, setType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [date, setDate] = useState(initialDate);
  const [refNo, setRefNo] = useState('');
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
        setRefNo(transaction.refNo || transaction.externalTransactionId || '');
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
        setRefNo('');
        setNotes('');
        setError(null);
        setDate(initialDate);

        // Pick default category for type
        const defaultCat = categories.find((c) => c.type === defaultType || c.type === 'both');
        if (defaultCat) setCategoryId(defaultCat._id);
      }
    }
  }, [isOpen, transaction, defaultType, categories, initialDate]);

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
      const trimmedRef = refNo.trim() || undefined;

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
              refNo: trimmedRef,
              externalTransactionId: trimmedRef,
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
            refNo: trimmedRef,
            externalTransactionId: trimmedRef,
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
      title={isEditing ? 'Edit Transaction' : 'Record Transaction'}
      description={
        isEditing
          ? 'Update entry details in your financial ledger.'
          : 'Log an immediate debit, credit, or transfer.'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-semibold animate-in fade-in">
            {error}
          </div>
        )}

        {/* Transaction Type Segmented Control */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-white/5">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 py-2 text-xs font-bold tracking-tight rounded-lg transition-all ${
              type === 'expense'
                ? 'bg-rose-500 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 py-2 text-xs font-bold tracking-tight rounded-lg transition-all ${
              type === 'income'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => setType('transfer')}
            className={`flex-1 py-2 text-xs font-bold tracking-tight rounded-lg transition-all ${
              type === 'transfer'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Transfer
          </button>
        </div>

        {/* Scan Receipt / Ticket entry point, available when adding a new expense */}
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl border border-brand-500/30 bg-brand-500/[0.06] hover:bg-brand-500/10 transition-colors text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0">
              <ScanLine className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                Scan Receipt / Ticket
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Photo a bus or movie ticket and read it on your device
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex-shrink-0">
              Scan
            </span>
          </button>
        )}

        {/* Tactile Financial Amount Input */}
        <div className="bg-slate-50/60 dark:bg-slate-850/40 p-4 rounded-2xl border border-slate-200/70 dark:border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Amount (INR)
            </label>
            <span className="text-[10px] font-semibold text-slate-400">Indian Rupee (₹)</span>
          </div>

          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-2xl sm:text-3xl font-bold text-slate-400 dark:text-slate-500 font-mono pointer-events-none">
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
              placeholder="0.00"
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 tabular-financial shadow-2xs"
            />
          </div>

          {/* Quick Amount Suggestion Chips */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-0.5">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">Quick:</span>
            {[100, 250, 500, 1000, 2000, 5000].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(String(val))}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors shadow-2xs"
              >
                +₹{val >= 1000 ? `${val / 1000}k` : val}
              </button>
            ))}
          </div>
        </div>

        {/* Merchant / Payee */}
        <Input
          label={type === 'income' ? 'Received From (Source / Client)' : 'Paid To (Merchant / Payee)'}
          placeholder={type === 'income' ? 'e.g. Infosys, Consulting, Client' : 'e.g. Amazon, Swiggy, Uber, Landlord'}
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          required
        />

        {/* Category Picker */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Category
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
            {filteredCategories.map((c) => (
              <button
                type="button"
                key={c._id}
                onClick={() => setCategoryId(c._id)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-all ${
                  categoryId === c._id
                    ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300 font-bold ring-1 ring-brand-500 shadow-2xs'
                    : 'border-slate-200/70 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${c.color}20` }}
                >
                  <CategoryIcon name={c.icon} className="w-4 h-4" color={c.color} />
                </div>
                <span className="text-[11px] truncate w-full font-medium">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors shadow-2xs font-medium"
            >
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors shadow-2xs font-medium"
            />
          </div>
        </div>

        {/* Ref.No / Reference ID */}
        <Input
          label="Ref.No / Reference ID (Optional)"
          placeholder="e.g. 130408174425 or 0000130408174425"
          value={refNo}
          onChange={(e) => setRefNo(e.target.value)}
        />

        {/* Notes */}
        <Input
          label="Notes (Optional)"
          placeholder="e.g. Dinner with team, flat grocery split"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
            {isEditing ? 'Update Transaction' : 'Save Transaction'}
          </Button>
        </div>
      </form>

      {/* Scanner is layered above this form and creates the expense itself once
          the user confirms, so this modal closes underneath it. */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        defaultDate={defaultDate || null}
      />
    </Modal>
  );
};
