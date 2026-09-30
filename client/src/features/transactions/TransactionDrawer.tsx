import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Calendar, Tag, CreditCard, Mail, Trash2, Edit3, ShieldCheck, UserRound, ExternalLink } from 'lucide-react';
import { Person, Transaction } from '../../types/index.js';
import { formatINR, formatDate, getConfidenceBadge } from '../../utils/format.js';
import { Badge } from '../../components/ui/Badge.js';
import { CategoryIcon } from '../../components/ui/CategoryIcon.js';
import { api } from '../../services/api.js';
import { toast } from '../../components/ui/Toast.js';
import { TransactionModal } from './TransactionModal.js';

interface TransactionDrawerProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
}

export const TransactionDrawer: React.FC<TransactionDrawerProps> = ({
  transaction,
  isOpen,
  onClose,
  onDelete,
  onEdit,
}) => {
  const [localTx, setLocalTx] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState('');
  const [isCreatingPerson, setIsCreatingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonVpa, setNewPersonVpa] = useState('');
  const [creatingLoading, setCreatingLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !transaction) {
      setLocalTx(null);
      return;
    }
    setLocalTx(transaction);
    const currentPersonId = typeof transaction.personId === 'object' ? transaction.personId?._id : transaction.personId;
    setPersonId(currentPersonId || '');
    setIsCreatingPerson(false);
    setNewPersonName(transaction.merchant || '');
    setNewPersonVpa(transaction.vpa || '');
    api.get('/people').then((response) => setPeople(response.data.data.people)).catch(() => setPeople([]));
  }, [isOpen, transaction]);

  const assignPerson = async (nextPersonId: string) => {
    if (!transaction) return;
    if (nextPersonId === '__new__') {
      setIsCreatingPerson(true);
      return;
    }
    await api.patch(`/transactions/${transaction._id}/person`, { personId: nextPersonId || null });
    setPersonId(nextPersonId);
  };

  const handleCreateAndAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction || !newPersonName.trim()) return;

    try {
      setCreatingLoading(true);
      const created = await api.post('/people', {
        name: newPersonName.trim(),
        vpa: newPersonVpa.trim() || undefined,
      });
      const newPerson = created.data.data.person;
      await api.patch(`/transactions/${transaction._id}/person`, { personId: newPerson._id });
      setPeople((current) => [...current, newPerson]);
      setPersonId(newPerson._id);
      setIsCreatingPerson(false);
      toast.success(`Created & linked "${newPerson.name}"`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create person.');
    } finally {
      setCreatingLoading(false);
    }
  };

  if (!isOpen || !transaction) return null;

  const displayedTx = localTx || transaction;
  const isExpense = displayedTx.type === 'expense';
  const category =
    typeof displayedTx.categoryId === 'object' && displayedTx.categoryId !== null
      ? displayedTx.categoryId
      : null;

  const sourceAccount =
    typeof displayedTx.sourceAccountId === 'object' && displayedTx.sourceAccountId !== null
      ? displayedTx.sourceAccountId
      : null;

  const metadata = displayedTx.metadata || {};
  const confidenceScore = (metadata.confidenceScore as number) || undefined;

  const handleTriggerEdit = () => {
    if (onEdit) {
      onEdit(displayedTx);
    } else {
      setIsEditModalOpen(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#0c121e] border-l border-slate-200/90 dark:border-white/10 shadow-fintech-lg h-full z-10 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250">
        <div className="p-6 sm:p-7">
          {/* Top Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Transaction Details
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTriggerEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold tracking-tight text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200/80 dark:border-slate-700/80 shadow-2xs"
                title="Edit Transaction"
              >
                <Edit3 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>Edit</span>
              </button>
              <button
                onClick={onClose}
                aria-label="Close drawer"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Amount and Merchant Header */}
          <div className="mt-7 text-center">
            <div
              className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3.5 shadow-2xs ${
                isExpense
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              }`}
            >
              <CategoryIcon name={category?.icon || 'Tag'} className="w-7 h-7" />
            </div>

            <h3 className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white tabular-financial">
              {isExpense ? '-' : '+'}
              {formatINR(transaction.amount)}
            </h3>

            <p className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-200 mt-1.5">
              {transaction.merchant}
            </p>

            <div className="mt-3 flex items-center justify-center gap-2">
              <Badge variant={isExpense ? 'rose' : 'emerald'} dot>
                {transaction.type.toUpperCase()}
              </Badge>
              <Badge variant="slate">
                {transaction.paymentMethod.toUpperCase()}
              </Badge>
              {transaction.source === 'email' && (
                <Badge variant="blue" className="gap-1">
                  <Mail className="w-3 h-3" />
                  EMAIL SYNC
                </Badge>
              )}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="mt-8 space-y-3.5 bg-slate-50/70 dark:bg-slate-850/40 p-4 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-white/5">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar className="w-4 h-4" />
                <span>Date</span>
              </div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {formatDate(transaction.transactionDate, 'dd MMMM yyyy, h:mm a')}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Tag className="w-4 h-4" />
                <span>Category</span>
              </div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                {category?.name || 'Uncategorized'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <CreditCard className="w-4 h-4" />
                <span>Payment Mode</span>
              </div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                {transaction.paymentMethod}
              </span>
            </div>

            {Boolean(transaction.vpa) && (
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500">VPA / UPI ID</span>
                <span className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                  {transaction.vpa}
                </span>
              </div>
            )}

            {(transaction.refNo || transaction.externalTransactionId) && (
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500 font-medium">Ref.No</span>
                <span className="font-mono text-xs text-brand-700 dark:text-brand-300 bg-brand-500/10 px-2 py-1 rounded-lg border border-brand-500/20 font-semibold select-all">
                  {transaction.refNo || transaction.externalTransactionId}
                </span>
              </div>
            )}

            {transaction.notes && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs">
                <span className="text-slate-500 block mb-1">Notes</span>
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  {transaction.notes}
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <UserRound className="w-4 h-4" />
                  <span>Person / Payee</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={personId}
                    onChange={(event) => assignPerson(event.target.value)}
                    className="max-w-[190px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">Unassigned</option>
                    {people.map((person) => (
                      <option key={person._id} value={person._id}>
                        {person.name}
                        {person.vpa ? ` (${person.vpa})` : ''}
                      </option>
                    ))}
                    <option value="__new__">+ Create new person</option>
                  </select>

                  {personId && (
                    <Link
                      to={`/people/${personId}`}
                      onClick={onClose}
                      className="p-1.5 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/50 transition-colors"
                      title="View Person Profile"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>

              {isCreatingPerson && (
                <form
                  onSubmit={handleCreateAndAssign}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Create & Assign Person
                  </span>
                  <div>
                    <input
                      type="text"
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      placeholder="Person name (e.g. ABIRAMI P)"
                      required
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newPersonVpa}
                      onChange={(e) => setNewPersonVpa(e.target.value)}
                      placeholder="VPA / UPI ID (Optional)"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingPerson(false)}
                      className="px-2.5 py-1 rounded-md text-[11px] text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingLoading}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-brand-600 text-white hover:bg-brand-700"
                    >
                      {creatingLoading ? 'Saving...' : 'Save & Assign'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Email Intelligence Context Card (Requirement 24) */}
          {transaction.source === 'email' && (
            <div className="mt-5 p-4 rounded-2xl bg-brand-50/60 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900/60">
              <div className="flex items-center gap-2 text-brand-800 dark:text-brand-300 text-xs font-bold mb-2">
                <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                Email Intelligence
              </div>
              <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                {sourceAccount && (
                  <p>
                    <span className="text-slate-400">Imported from:</span>{' '}
                    <span className="font-semibold">{sourceAccount.email}</span>
                  </p>
                )}
                {confidenceScore && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-400">Detection Confidence:</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                        getConfidenceBadge(confidenceScore).color
                      }`}
                    >
                      {getConfidenceBadge(confidenceScore).label}
                    </span>
                  </div>
                )}
                {Boolean(metadata.subject) && (
                  <p className="text-[11px] text-slate-500 truncate pt-1">
                    Email: "{String(metadata.subject)}"
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
          {onDelete && (
            <button
              onClick={() => onDelete(displayedTx._id)}
              className="py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <button
            onClick={handleTriggerEdit}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <Edit3 className="w-4 h-4" />
            Edit Transaction
          </button>
        </div>
      </div>

      {/* Embedded Edit Modal */}
      {isEditModalOpen && (
        <TransactionModal
          isOpen={true}
          transaction={displayedTx}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(updated) => {
            setLocalTx(updated);
            setIsEditModalOpen(false);
            if (onEdit) onEdit(updated);
          }}
        />
      )}
    </div>
  );
};
