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
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 ${className}`}
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-subtle border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-5">
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
