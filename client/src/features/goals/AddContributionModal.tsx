import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import { addContributionThunk } from '../../store/slices/goalSlice.js';
import { toast } from '../../components/ui/Toast.js';
import type { Goal } from '../../types/index.js';

interface AddContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal;
}

function todayInputValue(): string {
  return new Date().toISOString().split('T')[0];
}

export const AddContributionModal: React.FC<AddContributionModalProps> = ({
  isOpen,
  onClose,
  goal,
}) => {
  const dispatch = useAppDispatch();
  const accounts = useAppSelector((state) => state.emailAccounts.accounts);
  const submitting = useAppSelector((state) => state.goals.submitting);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAmount('');
    setDate(todayInputValue());
    setAccountId(
      typeof goal.accountId === 'object' && goal.accountId ? goal.accountId._id : (goal.accountId as string) || ''
    );
    setNote('');
    setAmountError(undefined);
    setFormError(null);
  }, [isOpen, goal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!amount.trim() || isNaN(value) || value <= 0) {
      setAmountError('Contribution amount must be greater than 0');
      return;
    }

    setFormError(null);
    try {
      await dispatch(
        addContributionThunk({
          goalId: goal._id,
          data: {
            amount: value,
            accountId: accountId || null,
            contributionDate: date || null,
            note: note.trim() || null,
          },
        })
      ).unwrap();
      toast.success('Contribution added to goal');
      onClose();
    } catch (err: any) {
      const message = err || 'Failed to add contribution';
      setFormError(message);
      toast.error(message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Contribution"
      description={`Record savings toward ${goal.name}. Contributions are savings, not expenses.`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-semibold">
            {formError}
          </div>
        )}

        <div className="bg-slate-50/60 dark:bg-slate-850/40 p-4 rounded-2xl border border-slate-200/70 dark:border-white/5">
          <label
            htmlFor="contribution-amount"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5"
          >
            Amount (INR)
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-2xl sm:text-3xl font-bold text-slate-400 dark:text-slate-500 font-mono pointer-events-none">
              ₹
            </span>
            <input
              id="contribution-amount"
              type="number"
              step="any"
              min="0"
              required
              autoFocus
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountError(undefined);
              }}
              placeholder="0.00"
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-[border-color,box-shadow] duration-150 ease-out-expo placeholder:text-slate-300 dark:placeholder:text-slate-600 tabular-financial shadow-2xs"
            />
          </div>
          {amountError && (
            <p className="text-xs text-rose-500 dark:text-rose-400 font-medium mt-1.5">
              {amountError}
            </p>
          )}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
            Saving toward a goal never counts as an expense, so your reports and
            account balances stay accurate.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="contribution-date"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Date
            </label>
            <input
              id="contribution-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-[border-color,box-shadow] duration-150 ease-out-expo shadow-2xs font-medium"
            />
          </div>

          <div>
            <label
              htmlFor="contribution-account"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Account
            </label>
            <select
              id="contribution-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-[border-color,box-shadow] duration-150 ease-out-expo shadow-2xs font-medium"
            >
              <option value="">No account</option>
              {accounts.map((account) => (
                <option key={account._id} value={account._id}>
                  {account.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="Note (Optional)"
          leftIcon={<Wallet className="w-4 h-4" />}
          placeholder="e.g. Monthly transfer to HDFC savings"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
            Add Contribution
          </Button>
        </div>
      </form>
    </Modal>
  );
};
