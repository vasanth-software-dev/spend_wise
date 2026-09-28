import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-xl tracking-tight transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer';

    const variants = {
      primary:
        'bg-brand-600 hover:bg-brand-500 text-white shadow-xs hover:shadow-glow-emerald focus:ring-brand-500 dark:bg-brand-600 dark:hover:bg-brand-500 border border-emerald-500/20',
      secondary:
        'bg-slate-100 hover:bg-slate-200/80 text-slate-800 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 focus:ring-slate-400',
      outline:
        'border border-slate-200 hover:border-slate-300 bg-white/60 hover:bg-slate-50 text-slate-700 dark:border-slate-700/80 dark:hover:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800/60 focus:ring-slate-400 shadow-2xs',
      ghost:
        'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 focus:ring-slate-400',
      danger:
        'bg-rose-600 hover:bg-rose-500 text-white shadow-xs hover:shadow-glow-rose focus:ring-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500 border border-rose-500/20',
      success:
        'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs focus:ring-emerald-500 border border-emerald-500/20',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-lg',
      md: 'text-xs sm:text-sm px-4 py-2 gap-2 rounded-xl',
      lg: 'text-sm sm:text-base px-5 py-2.5 gap-2.5 rounded-xl',
      icon: 'p-2 aspect-square rounded-xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
