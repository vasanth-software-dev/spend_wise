import React from 'react';
import { CategoryLike, resolveCategoryMeta } from '../../constants/categories.js';
import { CategoryIcon } from './CategoryIcon.js';
import { useAppSelector } from '../../store/index.js';

export interface CategoryBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  category?: CategoryLike | string | null;
  categories?: CategoryLike[];
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
  truncateMax?: string;
}

/**
 * Universal badge component that renders category name, icon, and colors
 * dynamically based on the category's selected color scheme across the application.
 */
export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  categories,
  size = 'sm',
  showIcon = true,
  className = '',
  truncateMax,
  style,
  ...props
}) => {
  const storeCategories = useAppSelector((state) => state.categories?.categories);
  const activeCategories = categories || storeCategories;
  const meta = resolveCategoryMeta(category, activeCategories);

  const sizeStyles = {
    xs: {
      padding: 'px-1.5 py-0.5',
      text: 'text-[10px]',
      gap: 'gap-1',
      icon: 'w-2.5 h-2.5',
      rounded: 'rounded',
    },
    sm: {
      padding: 'px-2 py-0.5',
      text: 'text-xs',
      gap: 'gap-1.5',
      icon: 'w-3 h-3',
      rounded: 'rounded-lg',
    },
    md: {
      padding: 'px-2.5 py-1',
      text: 'text-xs sm:text-sm',
      gap: 'gap-1.5',
      icon: 'w-3.5 h-3.5',
      rounded: 'rounded-lg',
    },
  }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold border transition-colors shadow-2xs ${sizeStyles.rounded} ${sizeStyles.padding} ${sizeStyles.text} ${sizeStyles.gap} ${className}`}
      style={{
        backgroundColor: meta.bg,
        borderColor: meta.border,
        color: meta.color,
        ...style,
      }}
      title={meta.name}
      {...props}
    >
      {showIcon && (
        <CategoryIcon
          name={meta.icon}
          className={`${sizeStyles.icon} flex-shrink-0`}
          color={meta.color}
        />
      )}
      <span className={truncateMax ? `truncate ${truncateMax}` : 'truncate'}>
        {meta.name}
      </span>
    </span>
  );
};
