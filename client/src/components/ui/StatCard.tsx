import React from 'react';
import { Card } from './Card.js';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

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
  isHero?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  amount,
  subtitle,
  icon,
  trend,
  accentColor = 'emerald',
  isHero = false,
}) => {
  const accentStyles = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
    blue: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20',
  };

  return (
    <Card
      interactive
      className={`relative overflow-hidden p-5 sm:p-6 transition-all duration-200 group ${
        isHero
          ? 'bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-900/80 border-slate-200/90 dark:border-slate-800 ring-1 ring-brand-500/20 shadow-fintech-md'
          : ''
      }`}
    >
      {/* Top subtle highlight shimmer for hero */}
      {isHero && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-500/60 to-transparent" />
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {icon && (
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-transform duration-200 group-hover:scale-105 ${accentStyles[accentColor]}`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3.5">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-financial text-slate-900 dark:text-white">
          {amount}
        </div>

        <div className="mt-2.5 flex items-center justify-between text-xs gap-2">
          {subtitle && (
            <span className="text-slate-500 dark:text-slate-400 truncate font-normal">
              {subtitle}
            </span>
          )}

          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                trend.isPositive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              }`}
            >
              {trend.isPositive ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {trend.value}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};
