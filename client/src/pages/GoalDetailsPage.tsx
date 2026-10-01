import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import {
  deleteContributionThunk,
  deleteGoalThunk,
  fetchGoalThunk,
} from '../store/slices/goalSlice.js';
import { fetchAccountsThunk } from '../store/slices/emailAccountSlice.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { toast } from '../components/ui/Toast.js';
import { formatINR, formatDate } from '../utils/format.js';
import { getGoalMetrics } from '../features/goals/goalUtils.js';
import { getGoalIcon } from '../features/goals/goalConstants.js';
import { GoalProgressBar } from '../features/goals/GoalProgressBar.js';
import { GoalFormModal } from '../features/goals/GoalFormModal.js';
import { AddContributionModal } from '../features/goals/AddContributionModal.js';
import { DeleteGoalDialog } from '../features/goals/DeleteGoalDialog.js';
import { ContributionHistory } from '../features/goals/ContributionHistory.js';
import type { GoalContribution } from '../types/index.js';

export const GoalDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { selectedGoal, detailLoading, submitting, error } = useAppSelector((state) => state.goals);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [contributionToRemove, setContributionToRemove] = useState<GoalContribution | null>(null);

  useEffect(() => {
    if (id) {
      dispatch(fetchGoalThunk(id));
      dispatch(fetchAccountsThunk());
    }
  }, [dispatch, id]);

  const goal = selectedGoal;

  if (!goal) {
    return (
      <div className="max-w-4xl mx-auto pb-12 space-y-4">
        <Link
          to="/goals"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Goals
        </Link>

        {detailLoading ? (
          <Card className="p-6 space-y-4">
            <div className="h-6 w-48 rounded-lg bg-slate-200/80 dark:bg-slate-800/60 animate-pulse" />
            <div className="h-3 w-full rounded-lg bg-slate-200/80 dark:bg-slate-800/60 animate-pulse" />
            <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800/60 animate-pulse" />
          </Card>
        ) : (
          <Card className="p-10 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Goal unavailable
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
              {error || 'This goal could not be found or is no longer available.'}
            </p>
            <Button variant="outline" size="sm" className="mt-5" onClick={() => navigate('/goals')}>
              Back to Goals
            </Button>
          </Card>
        )}
      </div>
    );
  }

  const metrics = getGoalMetrics(goal);
  const Icon = getGoalIcon(goal.icon);
  const category =
    typeof goal.categoryId === 'object' && goal.categoryId ? goal.categoryId : null;
  const account =
    typeof goal.accountId === 'object' && goal.accountId ? goal.accountId : null;

  const handleDeleteContribution = async () => {
    if (!contributionToRemove || !goal) return;
    try {
      await dispatch(
        deleteContributionThunk({ goalId: goal._id, contributionId: contributionToRemove._id })
      ).unwrap();
      toast.success('Contribution removed');
      setContributionToRemove(null);
    } catch (err: any) {
      toast.error(err || 'Failed to remove contribution');
    }
  };

  const handleDeleteGoal = async () => {
    try {
      await dispatch(deleteGoalThunk(goal._id)).unwrap();
      toast.success('Goal deleted');
      navigate('/goals');
    } catch (err: any) {
      toast.error(err || 'Failed to delete goal');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <Link
        to="/goals"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Goals
      </Link>

      {/* Hero */}
      <Card className="p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border"
              style={{
                backgroundColor: `${goal.color}1f`,
                borderColor: `${goal.color}33`,
                color: goal.color,
              }}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {goal.name}
                </h1>
                {metrics.isCompleted ? (
                  <Badge variant="emerald" dot className="font-bold">
                    COMPLETED
                  </Badge>
                ) : metrics.isOverdue ? (
                  <Badge variant="rose" dot className="font-bold">
                    OVERDUE
                  </Badge>
                ) : (
                  <Badge variant="blue" dot className="font-bold">
                    ACTIVE
                  </Badge>
                )}
              </div>
              {goal.description && (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {goal.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 font-medium flex-wrap">
                {category && <span>{category.name}</span>}
                {account && <span className="truncate">{account.email}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={() => setIsContributeOpen(true)}
            >
              Add Contribution
            </Button>
            <button
              onClick={() => setIsEditOpen(true)}
              aria-label="Edit goal"
              title="Edit goal"
              className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-2xs"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsDeleteOpen(true)}
              aria-label="Delete goal"
              title="Delete goal"
              className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-800 transition-all shadow-2xs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress visualization */}
        <div className="mt-7">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <span className="text-3xl sm:text-4xl font-extrabold font-mono tabular-financial text-slate-900 dark:text-white">
                {formatINR(metrics.currentAmount)}
              </span>
              <span className="text-sm text-slate-400 font-medium ml-2">
                of {formatINR(metrics.targetAmount)}
              </span>
            </div>
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-slate-600 dark:text-slate-300">
              {Math.round(metrics.percentageComplete)}%
            </span>
          </div>
          <GoalProgressBar
            className="mt-3 h-2.5"
            percentage={metrics.percentageComplete}
            color={goal.color}
            isComplete={metrics.isCompleted}
            aria-label={`${goal.name} progress`}
          />

          {metrics.isCompleted && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Target reached. Nothing left to save for this goal.
            </div>
          )}
          {metrics.isOverdue && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-semibold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              The target date has passed. Update the goal to add a new deadline.
            </div>
          )}
        </div>
      </Card>

      {/* Figures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Remaining
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-financial text-slate-900 dark:text-white mt-1.5">
            {formatINR(metrics.remainingAmount)}
          </div>
        </Card>
        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Required Monthly
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-financial text-slate-900 dark:text-white mt-1.5">
            {metrics.requiredMonthlyContribution === null
              ? '—'
              : formatINR(metrics.requiredMonthlyContribution)}
          </div>
          {goal.monthlyContribution ? (
            <span className="text-xs text-slate-400 mt-1 block">
              Planned {formatINR(goal.monthlyContribution)}/mo
            </span>
          ) : null}
        </Card>
        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Target Date
          </span>
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-2 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
            {goal.targetDate ? formatDate(goal.targetDate, 'dd MMM yyyy') : 'No target date'}
          </div>
          {metrics.monthsRemaining !== null && (
            <span className="text-xs text-slate-400 mt-1 block">
              {metrics.monthsRemaining} {metrics.monthsRemaining === 1 ? 'month' : 'months'} left
            </span>
          )}
        </Card>
        <Card className="p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Expected Completion
          </span>
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-2 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
            {metrics.expectedCompletionDate
              ? formatDate(metrics.expectedCompletionDate, 'MMM yyyy')
              : 'Add a monthly plan'}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {metrics.expectedCompletionDate
              ? 'At your current monthly pace'
              : 'Set a monthly contribution to project'}
          </span>
        </Card>
      </div>

      {/* History */}
      <Card className="p-5 sm:p-6">
        <ContributionHistory
          goal={goal}
          contributions={goal.contributions ?? []}
          loading={detailLoading}
          onDelete={(c) => setContributionToRemove(c)}
        />
      </Card>

      {/* Modals */}
      <GoalFormModal
        isOpen={isEditOpen}
        goal={goal}
        onClose={() => setIsEditOpen(false)}
      />

      {isContributeOpen && (
        <AddContributionModal isOpen={isContributeOpen} goal={goal} onClose={() => setIsContributeOpen(false)} />
      )}

      {isDeleteOpen && (
        <DeleteGoalDialog
          isOpen={isDeleteOpen}
          goal={goal}
          busy={submitting}
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteGoal}
        />
      )}

      <Modal
        isOpen={!!contributionToRemove}
        onClose={() => setContributionToRemove(null)}
        title="Remove contribution?"
        description="This reduces the saved amount for this goal by the contribution amount."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-slate-700 dark:text-slate-200">
            {contributionToRemove && (
              <>
                Remove <strong>{formatINR(contributionToRemove.amount)}</strong> from{' '}
                <strong>{goal.name}</strong>?
              </>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setContributionToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={submitting}
              onClick={handleDeleteContribution}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
