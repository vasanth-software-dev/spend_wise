import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { formatINR, formatDate } from '../../utils/format.js';
import type { Goal } from '../../types/index.js';
import { getGoalMetrics } from './goalUtils.js';
import { getGoalIcon } from './goalConstants.js';
import { GoalProgressBar } from './GoalProgressBar.js';

interface GoalCardProps {
  goal: Goal;
  onAddContribution: (goal: Goal) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, onAddContribution, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const metrics = getGoalMetrics(goal);
  const Icon = getGoalIcon(goal.icon);
  const percentage = Math.round(metrics.percentageComplete);
  const category =
    typeof goal.categoryId === 'object' && goal.categoryId ? goal.categoryId : null;

  return (
    <Card
      interactive
      className="p-5 sm:p-6 flex flex-col justify-between group"
      role="article"
      aria-label={`Goal ${goal.name}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-transform duration-150 ease-out-expo hover-scale-105"
              style={{
                backgroundColor: `${goal.color}1f`,
                borderColor: `${goal.color}33`,
                color: goal.color,
              }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {goal.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium truncate">
                {category?.name || 'Savings goal'}
              </p>
            </div>
          </div>

          {metrics.isCompleted ? (
            <Badge variant="emerald" dot className="font-bold shrink-0">
              COMPLETED
            </Badge>
          ) : metrics.isOverdue ? (
            <Badge variant="rose" dot className="font-bold shrink-0">
              OVERDUE
            </Badge>
          ) : (
            <Badge variant="blue" dot className="font-bold shrink-0">
              ACTIVE
            </Badge>
          )}
        </div>

        {/* Saved / target */}
        <div className="mt-5 flex items-baseline justify-between gap-2">
          <div>
            <span
              className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-financial"
            >
              {formatINR(metrics.currentAmount)}
            </span>
            <span className="text-xs text-slate-400 font-medium ml-1.5">
              of {formatINR(metrics.targetAmount)}
            </span>
          </div>
          <span className="text-xs sm:text-sm font-extrabold font-mono tabular-financial text-slate-600 dark:text-slate-300">
            {percentage}%
          </span>
        </div>

        <div className="mt-3.5 space-y-2">
          <GoalProgressBar
            percentage={metrics.percentageComplete}
            color={goal.color}
            isComplete={metrics.isCompleted}
            aria-label={`${goal.name} progress`}
          />
          <div className="flex items-center justify-between text-xs font-medium gap-2">
            <span className="text-slate-400 font-mono">
              {metrics.isCompleted
                ? 'Target reached'
                : `${formatINR(metrics.remainingAmount)} remaining`}
            </span>
            {goal.targetDate && (
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <CalendarClock className="w-3.5 h-3.5" />
                {formatDate(goal.targetDate, 'dd MMM yyyy')}
              </span>
            )}
          </div>
        </div>

        {!metrics.isCompleted && metrics.requiredMonthlyContribution !== null && (
          <div className="mt-3 p-2.5 bg-slate-50/70 dark:bg-slate-850/50 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
              <PiggyBank className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              Required monthly saving
            </span>
            <span className="font-extrabold font-mono text-slate-900 dark:text-white tabular-financial">
              {formatINR(metrics.requiredMonthlyContribution)}
              <span className="font-medium text-slate-400">/mo</span>
            </span>
          </div>
        )}

        {metrics.isCompleted && (
          <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Goal completed. Savings kept as-is.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
        <Button
          size="sm"
          variant="primary"
          onClick={() => onAddContribution(goal)}
          leftIcon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
          className="flex-1"
        >
          Contribute
        </Button>
        <button
          onClick={() => navigate(`/goals/${goal._id}`)}
          aria-label={`View ${goal.name}`}
          title="View goal"
          className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-lg hover:bg-brand-500/10"
        >
          View
        </button>
        <button
          onClick={() => onEdit(goal)}
          aria-label={`Edit ${goal.name}`}
          title="Edit goal"
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(goal)}
          aria-label={`Delete ${goal.name}`}
          title="Delete goal"
          className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-500/10"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );
};
