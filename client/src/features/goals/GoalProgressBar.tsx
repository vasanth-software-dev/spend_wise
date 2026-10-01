import React from 'react';

interface GoalProgressBarProps {
  percentage: number;
  color?: string;
  className?: string;
  /** Renders the fill with a repeating stripe for completed goals. */
  isComplete?: boolean;
  'aria-label'?: string;
}

/** Progress track shared by goal cards, the details hero and dashboard widget. */
export const GoalProgressBar: React.FC<GoalProgressBarProps> = ({
  percentage,
  color = '#10b981',
  className = '',
  isComplete = false,
  'aria-label': ariaLabel = 'Goal progress',
}) => {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(percentage) ? percentage : 0));

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden ${className}`}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${clamped}%`,
          backgroundColor: color,
          opacity: isComplete ? 1 : 0.9,
        }}
      />
    </div>
  );
};
