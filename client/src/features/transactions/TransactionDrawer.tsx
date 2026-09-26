import React from 'react';
import { X, Calendar, Tag, CreditCard, Mail, Trash2, Edit3, ShieldCheck } from 'lucide-react';
import { Transaction } from '../../types/index.js';
import { formatINR, formatDate, getConfidenceBadge } from '../../utils/format.js';
import { Badge } from '../../components/ui/Badge.js';
import { CategoryIcon } from '../../components/ui/CategoryIcon.js';

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
  if (!isOpen || !transaction) return null;

  const isExpense = transaction.type === 'expense';
  const category = typeof transaction.categoryId === 'object' && transaction.categoryId !== null
    ? transaction.categoryId
    : null;

  const sourceAccount = typeof transaction.sourceAccountId === 'object' && transaction.sourceAccountId !== null
    ? transaction.sourceAccountId
    : null;

  const metadata = transaction.metadata || {};
  const confidenceScore = (metadata.confidenceScore as number) || undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-premium h-full z-10 flex flex-col justify-between overflow-y-auto">
        <div className="p-6">
          {/* Top Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Transaction Details
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Amount and Merchant Header */}
          <div className="mt-6 text-center">
            <div
              className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 ${
                isExpense
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
              }`}
            >
              <CategoryIcon name={category?.icon || 'Tag'} className="w-7 h-7" />
            </div>

            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {isExpense ? '-' : '+'}
              {formatINR(transaction.amount)}
            </h3>

            <p className="text-base font-semibold text-slate-700 dark:text-slate-300 mt-1">
              {transaction.merchant}
            </p>

            <div className="mt-2.5 flex items-center justify-center gap-2">
              <Badge variant={isExpense ? 'rose' : 'emerald'}>
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
          <div className="mt-8 space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
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

            {transaction.externalTransactionId && (
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500">Reference / UTR</span>
                <span className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                  {transaction.externalTransactionId}
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
              onClick={() => onDelete(transaction._id)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(transaction)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
