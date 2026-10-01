import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, Trash2 } from 'lucide-react';
import { formatINR, formatDate } from '../../utils/format.js';
import type { Goal, GoalContribution } from '../../types/index.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

interface ContributionHistoryProps {
  goal: Goal;
  contributions: GoalContribution[];
  loading: boolean;
  onDelete: (contribution: GoalContribution) => void;
}

export const ContributionHistory: React.FC<ContributionHistoryProps> = ({
  goal,
  contributions,
  loading,
  onDelete,
}) => {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const totalContributed = useMemo(
    () => contributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
    [contributions]
  );

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Contribution History
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {contributions.length} {contributions.length === 1 ? 'entry' : 'entries'} ·{' '}
            {formatINR(totalContributed)} recorded
          </p>
        </div>
      </div>

      <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800/60">
        {loading && contributions.length === 0 ? (
          <>
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </>
        ) : contributions.length === 0 ? (
          <EmptyState
            icon={<ArrowDownLeft className="w-8 h-8 text-slate-400" />}
            title="No contributions yet"
            description="Add your first contribution to start tracking progress toward this goal."
            className="py-10"
          />
        ) : (
          contributions.map((contribution) => (
            <div
              key={contribution._id}
              className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-50/90 dark:hover:bg-slate-800/40 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    {formatDate(contribution.contributionDate, 'MMMM yyyy')}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {formatDate(contribution.contributionDate, 'dd MMM yyyy')}
                    </span>
                    {contribution.note && (
                      <>
                        <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                          {contribution.note}
                        </span>
                      </>
                    )}
                    {typeof contribution.accountId === 'object' && contribution.accountId && (
                      <>
                        <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                          {contribution.accountId.email}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs sm:text-sm font-extrabold text-brand-600 dark:text-brand-400 tabular-financial font-mono">
                  +{formatINR(contribution.amount)}
                </span>
                <button
                  onClick={() => {
                    setPendingId(contribution._id);
                    onDelete(contribution);
                  }}
                  disabled={pendingId === contribution._id}
                  aria-label={`Remove contribution of ${formatINR(contribution.amount)}`}
                  title="Remove contribution"
                  className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-500/10 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
        Contributions are tracked separately for {goal.name} and are never counted as expenses
        in your reports.
      </p>
    </div>
  );
};
