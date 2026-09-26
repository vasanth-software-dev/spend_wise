import React from 'react';
import { Card } from './Card.js';

interface StatCardProps {
  title: string;
  amount: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  accentColor?: 'emerald' | 'indigo' | 'rose' | 'amber' | 'blue';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  amount,
  subtitle,
  icon,
  trend,
  accentColor = 'emerald',
}) => {
  const accentStyles = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
  };

  return (
    <Card className="hover:shadow-premium transition-all duration-200 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">{title}</span>
        {icon && (
          <div className={`p-2.5 rounded-xl ${accentStyles[accentColor]}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3">
        <h4 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {amount}
        </h4>

        <div className="mt-2 flex items-center justify-between">
          {subtitle && (
            <span className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</span>
          )}
          {trend && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                trend.isPositive
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};
