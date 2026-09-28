import React from 'react';

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...props
}) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 dark:bg-slate-800/60 rounded-xl ${className}`}
      {...props}
    />
  );
};

export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-fintech">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-8 w-36" />
        <div className="flex items-center justify-between mt-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export const TableRowSkeleton: React.FC = () => {
  return (
    <div className="flex items-center justify-between py-3.5 px-4 border-b border-slate-100 dark:border-slate-800/60">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="text-right space-y-1.5">
        <Skeleton className="h-4 w-20 ml-auto" />
        <Skeleton className="h-3 w-14 ml-auto" />
      </div>
    </div>
  );
};
