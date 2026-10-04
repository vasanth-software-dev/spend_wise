import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Link2,
  PlusCircle,
  X,
  XCircle,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/index.js';
import {
  fetchDebtCandidatesThunk,
  resolveDebtCandidateThunk,
  ignoreDebtCandidateThunk,
  ignoreAllDebtCandidatesThunk,
} from '../../store/slices/debtCandidateSlice.js';
import { fetchDebtsThunk, fetchDebtSummaryThunk } from '../../store/slices/debtSlice.js';
import { Button } from '../../components/ui/Button.js';
import { Modal } from '../../components/ui/Modal.js';
import { Input } from '../../components/ui/Input.js';
import { toast } from '../../components/ui/Toast.js';
import { formatINR, formatDate, getConfidenceBadge } from '../../utils/format.js';
import type { Debt, DebtCandidate } from '../../types/index.js';
import { getDebtRemaining } from './debtUtils.js';

interface Props {
  className?: string;
}

const MATCH_LABELS: Record<DebtCandidate['match'], string> = {
  EXACT_SETTLEMENT: 'Looks like a full repayment',
  PARTIAL_PAYMENT: 'Looks like a partial repayment',
  NO_MATCH: 'No open debt found for this person',
};

export const DebtCandidatePanel: React.FC<Props> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { candidates, loading, resolving, bulkIgnoring } = useAppSelector(
    (state) => state.debtCandidates
  );
  const debts = useAppSelector((state) => state.debts.debts);

  const [active, setActive] = useState<DebtCandidate | null>(null);
  const [showDismissAllModal, setShowDismissAllModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [debtDate, setDebtDate] = useState('');
  const [description, setDescription] = useState('');
  const [targetDebtId, setTargetDebtId] = useState('');

  const pending = useMemo(
    () => candidates.filter((c) => c.status === 'PENDING'),
    [candidates]
  );

  useEffect(() => {
    dispatch(fetchDebtCandidatesThunk('PENDING'));
  }, [dispatch]);

  // Matching a payment to an existing debt needs the debt list, which may not be
  // loaded when the panel is shown on the Email Sync page.
  useEffect(() => {
    if (debts.length === 0) {
      dispatch(fetchDebtsThunk());
      dispatch(fetchDebtSummaryThunk());
    }
  }, [dispatch, debts.length]);

  useEffect(() => {
    if (active) {
      setAmount(String(active.amount));
      setDebtDate(String(active.transactionDate).slice(0, 10));
      setDescription(`${active.merchant} — ${active.source === 'email' ? 'detected from email' : 'detected from statement import'}`);
      setTargetDebtId(
        typeof active.suggestedDebtId === 'string' ? active.suggestedDebtId : ''
      );
    }
  }, [active]);

  if (pending.length === 0 && !loading) return null;

  const openDebtsFor = (candidate: DebtCandidate): Debt[] => {
    const candidatePersonId =
      typeof candidate.personId === 'string'
        ? candidate.personId
        : candidate.personId?._id;
    return debts.filter((d) => {
      if (getDebtRemaining(d) <= 0) return false;
      if (candidatePersonId) {
        return typeof d.personId === 'string' && d.personId === candidatePersonId;
      }
      return d.personName.trim().toLowerCase() === candidate.personName.trim().toLowerCase();
    });
  };

  const handleAcceptAsPayment = async () => {
    if (!active) return;
    if (!targetDebtId) {
      toast.error('Choose a debt to match, or add a new debt instead');
      return;
    }
    try {
      const res = await dispatch(
        resolveDebtCandidateThunk({
          id: active._id,
          data: {
            debtId: targetDebtId,
            amount: Number(amount),
            debtDate,
          },
        })
      ).unwrap();
      const remaining = res?.data?.debt?.remainingAmount;
      toast.success(
        remaining === 0 ? 'Payment recorded — debt settled!' : 'Payment recorded against debt'
      );
      dispatch(fetchDebtsThunk());
      dispatch(fetchDebtSummaryThunk());
      setActive(null);
    } catch (e: unknown) {
      toast.error(typeof e === 'string' ? e : 'Failed to record payment');
    }
  };

  const handleAcceptAsNewDebt = async () => {
    if (!active) return;
    try {
      await dispatch(
        resolveDebtCandidateThunk({
          id: active._id,
          data: {
            debtId: null,
            amount: Number(amount),
            debtDate,
            description: description.trim() || undefined,
          },
        })
      ).unwrap();
      toast.success('Debt created from detected payment');
      dispatch(fetchDebtsThunk());
      dispatch(fetchDebtSummaryThunk());
      setActive(null);
    } catch (e: unknown) {
      toast.error(typeof e === 'string' ? e : 'Failed to create debt');
    }
  };

  const handleIgnore = async (candidate: DebtCandidate) => {
    try {
      await dispatch(ignoreDebtCandidateThunk(candidate._id)).unwrap();
      if (active?._id === candidate._id) setActive(null);
      toast.success('Suggestion dismissed');
    } catch (e: unknown) {
      toast.error(typeof e === 'string' ? e : 'Failed to dismiss suggestion');
    }
  };

  const handleDismissAll = async () => {
    try {
      await dispatch(ignoreAllDebtCandidatesThunk(undefined)).unwrap();
      toast.success(`Dismissed ${pending.length} debt suggestion${pending.length === 1 ? '' : 's'}`);
      setShowDismissAllModal(false);
      if (active) setActive(null);
    } catch (e: unknown) {
      toast.error(typeof e === 'string' ? e : 'Failed to dismiss suggestions');
    }
  };

  const options = active ? openDebtsFor(active) : [];

  return (
    <div className={className}>
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-slate-900/10 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-amber-200/40 dark:border-amber-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Possible Debt Payments
                {pending.length > 0 && (
                  <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {pending.length} to review
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Person-to-person payments from email sync and statement import. Nothing is
                recorded as a debt until you confirm it.
              </p>
            </div>
          </div>

          {pending.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                onClick={() => setShowDismissAllModal(true)}
                disabled={bulkIgnoring}
                className="hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800"
              >
                Dismiss All ({pending.length})
              </Button>
            </div>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            No person-to-person payments waiting for review.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pending.map((c) => {
              const confidence = getConfidenceBadge(c.confidence);
              const busy = !!resolving[c._id];
              const sent = c.direction === 'I_OWE';
              const suggested =
                typeof c.suggestedDebtId === 'object' && c.suggestedDebtId
                  ? (c.suggestedDebtId as Debt)
                  : null;

              return (
                <div
                  key={c._id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-subtle"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        {sent ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownLeft className="w-3 h-3" />
                        )}
                        {sent ? 'Money sent' : 'Money received'}
                      </span>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {formatINR(c.amount)}
                      </h4>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {c.personName}
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${confidence.color}`}>
                      {confidence.label}
                    </span>
                  </div>

                  <div className="mt-3 text-xs space-y-1 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    <p className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>{MATCH_LABELS[c.match]}</span>
                    </p>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span>
                        {formatDate(c.transactionDate, 'dd MMM yyyy')} ·{' '}
                        {c.source === 'email' ? 'Email sync' : 'Statement import'}
                      </span>
                      {c.refNo && (
                        <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">
                          Ref: {c.refNo}
                        </span>
                      )}
                    </div>
                    {c.vpa && (
                      <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {c.vpa}
                      </p>
                    )}
                    {suggested && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Suggested match: {suggested.personName} debt,{' '}
                        {formatINR(c.suggestedDebtRemaining ?? getDebtRemaining(suggested))} remaining
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      isLoading={busy}
                      leftIcon={<X className="w-4 h-4" />}
                      onClick={() => handleIgnore(c)}
                    >
                      Ignore
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<Link2 className="w-4 h-4" />}
                      onClick={() => setActive(c)}
                    >
                      Review
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!active}
        onClose={() => setActive(null)}
        title="Confirm Debt Treatment"
        description={
          active
            ? `${formatINR(active.amount)} · ${active.personName} · ${formatDate(active.transactionDate)}`
            : undefined
        }
        maxWidth="lg"
      >
        {active && (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3 text-xs text-amber-800 dark:text-amber-200">
              This payment is not recorded as a debt yet. A person-to-person UPI payment
              could also be a purchase, gift, or bill — choose what actually happened.
            </div>

            <Input
              label="Amount (INR) *"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Date
              </label>
              <input
                type="date"
                value={debtDate}
                onChange={(e) => setDebtDate(e.target.value)}
                className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Match to existing debt (optional)
              </label>
              {options.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No open debts for {active.personName}.
                </p>
              ) : (
                <select
                  value={targetDebtId}
                  onChange={(e) => setTargetDebtId(e.target.value)}
                  className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                >
                  <option value="">— Not matching a debt —</option>
                  {options.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.direction === 'I_OWE' ? 'You owe' : 'Owes you'} ·{' '}
                      {formatINR(getDebtRemaining(d))} remaining · {d.description || d.personName}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {!targetDebtId && (
              <Input
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was this payment for?"
              />
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" size="sm" onClick={() => handleIgnore(active)}>
                Ignore
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<PlusCircle className="w-4 h-4" />}
                onClick={handleAcceptAsNewDebt}
                isLoading={resolving[active._id]}
              >
                Add New Debt ({active.direction === 'I_OWE' ? 'I owe' : 'owed to me'})
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Link2 className="w-4 h-4" />}
                onClick={handleAcceptAsPayment}
                isLoading={resolving[active._id]}
              >
                Record as Debt Payment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Dismiss All Confirmation Modal */}
      <Modal
        isOpen={showDismissAllModal}
        onClose={() => setShowDismissAllModal(false)}
        title="Dismiss All Debt Suggestions"
        description="Are you sure you want to dismiss all pending debt suggestions?"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This will dismiss <strong>{pending.length}</strong> debt suggestion{pending.length === 1 ? '' : 's'}. Existing debts and balances in your ledger will not be affected.
          </p>
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDismissAllModal(false)}
              disabled={bulkIgnoring}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<XCircle className="w-4 h-4" />}
              onClick={handleDismissAll}
              isLoading={bulkIgnoring}
            >
              Dismiss All ({pending.length})
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DebtCandidatePanel;