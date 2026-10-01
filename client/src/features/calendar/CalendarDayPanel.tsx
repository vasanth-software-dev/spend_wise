import React from 'react';
import { Plus, Repeat, CalendarX, Target, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { CategoryIcon } from '../../components/ui/CategoryIcon.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';
import { formatINR, formatDate } from '../../utils/format.js';
import type { CalendarDayDetail, Transaction, TransactionType } from '../../types/index.js';

interface CalendarDayPanelProps {
  detail: CalendarDayDetail | null;
  loading: boolean;
  onAddTransaction: () => void;
  onSelectTransaction: (transaction: Transaction) => void;
}

interface Group {
  key: TransactionType;
  label: string;
  items: Transaction[];
  total: number;
}

const TYPE_ACCENTS: Record<TransactionType, string> = {
  income: 'text-emerald-600 dark:text-emerald-400',
  expense: 'text-rose-600 dark:text-rose-400',
  transfer: 'text-indigo-600 dark:text-indigo-400',
};

const TYPE_BG: Record<TransactionType, string> = {
  income: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  expense: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  transfer: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
};

const TYPE_SIGN: Record<TransactionType, string> = {
  income: '+',
  expense: '-',
  transfer: '',
};

function groupTransactions(transactions: Transaction[]): Group[] {
  const order: TransactionType[] = ['income', 'expense', 'transfer'];
  return order
    .map((type) => {
      const items = transactions.filter((tx) => tx.type === type);
      return {
        key: type,
        label: type === 'income' ? 'Income' : type === 'expense' ? 'Expenses' : 'Transfers',
        items,
        total: items.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
      };
    })
    .filter((group) => group.items.length > 0);
}

export const CalendarDayPanel: React.FC<CalendarDayPanelProps> = ({
  detail,
  loading,
  onAddTransaction,
  onSelectTransaction,
}) => {
  const groups = detail ? groupTransactions(detail.transactions) : [];
  const summary = detail?.summary;
  const goals = detail?.goals ?? [];
  const debts = detail?.debts ?? [];
  const isEmpty =
    groups.length === 0 && detail?.scheduled.length === 0 && goals.length === 0 && debts.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
            {detail ? formatDate(detail.date, 'd MMMM yyyy') : 'Select a date'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {summary ? `${summary.count} ${summary.count === 1 ? 'transaction' : 'transactions'}` : ' '}
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          onClick={onAddTransaction}
        >
          <span className="hidden sm:inline">Add Transaction</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {loading && !detail ? (
        <div className="mt-2">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      ) : !detail ? (
        <EmptyState
          icon={<CalendarX className="w-8 h-8 text-slate-400" />}
          title="No date selected"
          description="Pick a day from the calendar to see the money that moved on it."
          className="my-8"
        />
      ) : isEmpty ? (
        <EmptyState
          icon={<CalendarX className="w-8 h-8 text-slate-400" />}
          title="No transactions on this date."
          description="Add a transaction to start tracking your finances."
          actionText="Add a transaction"
          onAction={onAddTransaction}
          className="my-8"
        />
      ) : (
        <>
          {/* Summary */}
          {summary && (
            <div className="mt-3.5 grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Income
                </span>
                <span className="block text-xs sm:text-sm font-extrabold font-mono tabular-financial text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
                  {formatINR(summary.income)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Expenses
                </span>
                <span className="block text-xs sm:text-sm font-extrabold font-mono tabular-financial text-rose-700 dark:text-rose-300 mt-0.5 truncate">
                  {formatINR(summary.expense)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/70 dark:border-white/5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Net
                </span>
                <span
                  className={`block text-xs sm:text-sm font-extrabold font-mono tabular-financial mt-0.5 truncate ${
                    summary.net >= 0
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {formatINR(summary.net)}
                </span>
              </div>
            </div>
          )}

          {/* Transaction groups */}
          <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
            {groups.map((group) => (
              <div key={group.key}>
                <div className="flex items-center justify-between pb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {group.label}
                  </span>
                  <span
                    className={`text-[11px] font-extrabold font-mono tabular-financial ${TYPE_ACCENTS[group.key]}`}
                  >
                    {TYPE_SIGN[group.key]}
                    {formatINR(group.total)}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {group.items.map((tx) => {
                    const category =
                      typeof tx.categoryId === 'object' && tx.categoryId ? tx.categoryId : null;
                    return (
                      <button
                        key={tx._id}
                        type="button"
                        onClick={() => onSelectTransaction(tx)}
                        className="w-full py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${TYPE_BG[tx.type]}`}
                          >
                            <CategoryIcon name={category?.icon || 'Tag'} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
                              {tx.merchant}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium truncate">
                              {category?.name || 'Uncategorized'}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-extrabold font-mono tabular-financial flex-shrink-0 ${TYPE_ACCENTS[tx.type]}`}
                        >
                          {TYPE_SIGN[tx.type]}
                          {formatINR(tx.amount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Goal deadlines landing on this day */}
            {goals.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 pb-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Goal deadlines
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="py-2.5 px-2 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/20 bg-emerald-500/10"
                          style={{ backgroundColor: `${goal.color}1f` }}
                        >
                          <CategoryIcon name={goal.icon || 'Target'} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate tracking-tight">
                            {goal.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">
                            {goal.isOverdue ? 'Deadline passed' : 'Deadline'} ·{' '}
                            {Math.round(goal.percentageComplete)}% saved
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono tabular-financial flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                        {formatINR(goal.remainingAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debt due dates landing on this day */}
            {debts.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 pb-1.5">
                  <Users className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Debts due
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {debts.map((debt) => (
                    <div
                      key={debt.id}
                      className="py-2.5 px-2 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border border-rose-500/20 bg-rose-500/10">
                          <Users className="w-4 h-4 text-rose-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate tracking-tight">
                            {debt.personName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">
                            {debt.direction === 'I_OWE' ? 'You owe' : 'Owed to you'}
                            {debt.isOverdue ? ' · Overdue' : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono tabular-financial flex-shrink-0 text-rose-600 dark:text-rose-400">
                        {formatINR(debt.remainingAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled occurrences for this day */}
            {detail.scheduled.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 pb-1.5">
                  <Repeat className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Scheduled
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {detail.scheduled.map((item) => {
                    const category =
                      item.categoryId && typeof item.categoryId === 'object'
                        ? (item.categoryId as { name?: string; icon?: string })
                        : null;
                    return (
                      <div
                        key={`${item.recurringTransactionId}-${item.date}`}
                        className="py-2.5 px-2 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border border-dashed border-slate-300 dark:border-slate-600 text-slate-400">
                            <CategoryIcon name={category?.icon || 'Repeat'} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate tracking-tight">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {category?.name || item.merchant} · {item.frequency}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold font-mono tabular-financial flex-shrink-0 ${
                            item.type === 'income'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {item.type === 'income' ? '+' : '○ '}
                          {formatINR(item.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
