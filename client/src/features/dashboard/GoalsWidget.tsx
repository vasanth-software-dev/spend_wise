import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Target } from 'lucide-react';
import { Card, CardTitle, CardDescription } from '../../components/ui/Card.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { formatINR } from '../../utils/format.js';
import type { Goal } from '../../types/index.js';
import { getGoalIcon } from '../goals/goalConstants.js';
import { GoalProgressBar } from '../goals/GoalProgressBar.js';
import { getGoalMetrics } from '../goals/goalUtils.js';

interface GoalsWidgetProps {
  goals: Goal[];
  loading: boolean;
  limit?: number;
}

export const GoalsWidget: React.FC<GoalsWidgetProps> = ({ goals, loading, limit = 3 }) => {
  const active = goals
    .filter((goal) => !getGoalMetrics(goal).isCompleted)
    .slice(0, limit);

  return (
    <Card className="p-5 sm:p-6 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base">Goals</CardTitle>
              <CardDescription>Active savings targets</CardDescription>
            </div>
          </div>
          <Link
            to="/goals"
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-bold"
          >
            View all
          </Link>
        </div>

        <div className="mt-4 space-y-4">
          {loading && goals.length === 0 ? (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          ) : active.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center font-medium">
              No active goals yet. Create one to start tracking your savings.
            </p>
          ) : (
            active.map((goal) => {
              const metrics = getGoalMetrics(goal);
              const Icon = getGoalIcon(goal.icon);
              return (
                <Link
                  key={goal._id}
                  to={`/goals/${goal._id}`}
                  className="block group"
                >
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${goal.color}1f`, color: goal.color }}
                      >
                        <Icon className="w-3 h-3" />
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight truncate">
                        {goal.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-extrabold font-mono tabular-financial text-slate-500 dark:text-slate-400 flex-shrink-0">
                      {Math.round(metrics.percentageComplete)}%
                    </span>
                  </div>
                  <GoalProgressBar
                    percentage={metrics.percentageComplete}
                    color={goal.color}
                    aria-label={`${goal.name} progress`}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-slate-400 font-medium font-mono">
                      {formatINR(metrics.currentAmount)} of {formatINR(metrics.targetAmount)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatINR(metrics.remainingAmount)} left
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-6 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-center">
        <Link
          to="/goals"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center gap-1 transition-colors"
        >
          Manage savings goals
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </Card>
  );
};
