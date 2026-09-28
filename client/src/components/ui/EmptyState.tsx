import React from 'react';
import { Button } from './Button.js';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800/80 bg-gradient-to-b from-slate-50/40 to-slate-50/10 dark:from-slate-900/40 dark:to-slate-900/10 ${className}`}
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800/90 shadow-fintech border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 transition-transform hover:scale-105">
          {icon}
        </div>
      )}
      <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1.5 mb-5 leading-relaxed font-normal">
        {description}
      </p>
      {actionText && onAction && (
        <Button onClick={onAction} variant="primary" size="sm">
          {actionText}
        </Button>
      )}
    </div>
  );
};
