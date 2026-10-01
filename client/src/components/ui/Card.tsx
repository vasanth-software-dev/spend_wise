import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'subtle';
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  interactive = false,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-fintech',
    elevated: 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-fintech-md',
    glass: 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-fintech',
    subtle: 'bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60',
  };

  const interactiveStyles = interactive
    ? 'transition-[transform,box-shadow,border-color] duration-150 ease-out-expo'
    : '';

  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 transition-colors ${variantStyles[variant]} ${interactiveStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => <div className={`flex flex-col space-y-1 mb-4 ${className}`} {...props}>{children}</div>;

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <h3 className={`text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <p className={`text-xs text-slate-500 dark:text-slate-400 font-normal leading-relaxed ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => <div className={className} {...props}>{children}</div>;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between ${className}`} {...props}>
    {children}
  </div>
);
