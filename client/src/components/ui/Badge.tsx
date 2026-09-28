import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'emerald' | 'rose' | 'amber' | 'blue' | 'purple' | 'slate' | 'gold';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'slate',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const variants = {
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    blue: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
    purple: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
    slate: 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/60',
    gold: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  };

  const dotColors = {
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    blue: 'bg-sky-500',
    purple: 'bg-indigo-500',
    slate: 'bg-slate-400',
    gold: 'bg-amber-500',
  };

  const sizes = {
    sm: 'text-[10px] sm:text-[11px] px-2 py-0.5 font-semibold',
    md: 'text-xs px-2.5 py-0.5 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border tracking-tight ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      <span>{children}</span>
    </span>
  );
};
