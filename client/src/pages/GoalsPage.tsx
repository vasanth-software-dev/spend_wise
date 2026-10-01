import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Target, AlertTriangle, PiggyBank, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/index.js';
import {
  deleteGoalThunk,
  fetchGoalsThunk,
} from '../store/slices/goalSlice.js';
import { fetchCategoriesThunk } from '../store/slices/categorySlice.js';
import { fetchAccountsThunk } from '../store/slices/emailAccountSlice.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { StatCardSkeleton } from '../components/ui/Skeleton.js';
import { GoalCard } from '../features/goals/GoalCard.js';
import { GoalFormModal } from '../features/goals/GoalFormModal.js';
import { AddContributionModal } from '../features/goals/AddContributionModal.js';
import { DeleteGoalDialog } from '../features/goals/DeleteGoalDialog.js';
import { GoalProgressBar } from '../features/goals/GoalProgressBar.js';
import { computeGoalSummary, filterGoals, GoalFilter } from '../features/goals/goalUtils.js';
import { toast } from '../components/ui/Toast.js';
import { formatINR } from '../utils/format.js';
import type { Goal } from '../types/index.js';

const FILTERS: Array<{ value: GoalFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
];

export const GoalsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { goals, loading, submitting, error } = useAppSelector((state) => state.goals);

  const [filter, setFilter] = useState<GoalFilter>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contributionGoal, setContributionGoal] = useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  useEffect(() => {
    dispatch(fetchGoalsThunk());
    dispatch(fetchCategoriesThunk());
    dispatch(fetchAccountsThunk());
  }, [dispatch]);

  const summary = useMemo(() => computeGoalSummary(goals), [goals]);
  const visibleGoals = useMemo(() => filterGoals(goals, filter), [goals, filter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dispatch(deleteGoalThunk(deleteTarget._id)).unwrap();
      toast.success('Goal deleted');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err || 'Failed to delete goal');
    }
  };

  const isInitialLoad = loading && goals.length === 0;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Goals
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create savings targets and track how far you have come.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => dispatch(fetchGoalsThunk())}
            aria-label="Refresh goals"
            title="Refresh goals"
            className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            onClick={() => {
              setEditingGoal(null);
              setIsFormOpen(true);
            }}
            className="shadow-2xs"
          >
            Create Goal
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-600 dark:text-rose-400 font-semibold">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Summary tiles */}
      {isInitialLoad ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        goals.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-fintech">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Target
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-slate-900 dark:text-white mt-1.5">
                  {formatINR(summary.totalTargetAmount)}
                </div>
                <span className="text-xs text-slate-400 mt-1 block">Across all goals</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-fintech">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Saved
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-brand-600 dark:text-brand-400 mt-1.5">
                  {formatINR(summary.totalSavedAmount)}
                </div>
                <span className="text-xs text-slate-400 mt-1 block">
                  {formatINR(summary.totalRemainingAmount)} remaining
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-fintech">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Active Goals
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-slate-900 dark:text-white mt-1.5">
                  {summary.activeCount}
                </div>
                <span className="text-xs text-slate-400 mt-1 block">In progress</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-fintech">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Completed
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-financial text-emerald-600 dark:text-emerald-400 mt-1.5">
                  {summary.completedCount}
                </div>
                <span className="text-xs text-slate-400 mt-1 block">Targets reached</span>
              </div>
            </div>

            {/* Overall progress */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-fintech">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Overall Progress
                </span>
                <span className="text-sm font-extrabold font-mono tabular-financial text-slate-900 dark:text-white">
                  {Math.round(summary.percentageComplete)}%
                </span>
              </div>
              <GoalProgressBar
                percentage={summary.percentageComplete}
                aria-label="Overall goal progress"
              />
            </div>
          </div>
        )
      )}

      {/* Filter pills */}
      {goals.length > 0 && (
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl self-start border border-slate-200/50 dark:border-white/5">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={`px-3 py-1 text-xs font-bold tracking-tight rounded-lg transition-all ${
                filter === option.value
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Goal list */}
      {goals.length === 0 && !loading ? (
        <EmptyState
          icon={<Target className="w-8 h-8 text-slate-400" />}
          title="No goals yet"
          description="Create your first savings goal and start tracking your progress."
          actionText="Create your first goal"
          onAction={() => {
            setEditingGoal(null);
            setIsFormOpen(true);
          }}
          className="py-16"
        />
      ) : visibleGoals.length === 0 && !loading ? (
        <EmptyState
          icon={filter === 'COMPLETED' ? <CheckCircle2 className="w-8 h-8 text-slate-400" /> : <PiggyBank className="w-8 h-8 text-slate-400" />}
          title={filter === 'COMPLETED' ? 'No completed goals yet' : 'No active goals'}
          description={
            filter === 'COMPLETED'
              ? 'Goals you fully fund will show up here with a completed badge.'
              : 'All of your goals are completed. Create a new one to keep saving.'
          }
          className="py-12"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleGoals.map((goal) => (
            <GoalCard
              key={goal._id}
              goal={goal}
              onAddContribution={(g) => setContributionGoal(g)}
              onEdit={(g) => {
                setEditingGoal(g);
                setIsFormOpen(true);
              }}
              onDelete={(g) => setDeleteTarget(g)}
            />
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      <GoalFormModal
        isOpen={isFormOpen}
        goal={editingGoal}
        onClose={() => {
          setIsFormOpen(false);
          setEditingGoal(null);
        }}
      />

      {/* Contribution modal */}
      {contributionGoal && (
        <AddContributionModal
          isOpen={!!contributionGoal}
          goal={contributionGoal}
          onClose={() => setContributionGoal(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteGoalDialog
          isOpen={!!deleteTarget}
          goal={deleteTarget}
          busy={submitting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};
