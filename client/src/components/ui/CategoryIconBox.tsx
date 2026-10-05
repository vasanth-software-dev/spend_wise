import React from 'react';
import { CategoryLike, resolveCategoryMeta } from '../../constants/categories.js';
import { CategoryIcon } from './CategoryIcon.js';
import { useAppSelector } from '../../store/index.js';

export interface CategoryIconBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  category?: CategoryLike | string | null;
  categories?: CategoryLike[];
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * Universal icon container component that renders the category icon styled with
 * the category's selected background tint, border, and accent color.
 * Used for merchants and category visual avatars across the entire project.
 */
export const CategoryIconBox: React.FC<CategoryIconBoxProps> = ({
  category,
  categories,
  size = 'md',
  className = '',
  style,
  ...props
}) => {
  const storeCategories = useAppSelector((state) => state.categories?.categories);
  const activeCategories = categories || storeCategories;
  const meta = resolveCategoryMeta(category, activeCategories);

  const sizeStyles = {
    xs: {
      box: 'w-7 h-7 rounded-lg',
      icon: 'w-3.5 h-3.5',
    },
    sm: {
      box: 'w-8 h-8 rounded-xl',
      icon: 'w-4 h-4',
    },
    md: {
      box: 'w-9 h-9 rounded-xl',
      icon: 'w-4 h-4',
    },
    lg: {
      box: 'w-10 h-10 rounded-xl',
      icon: 'w-4.5 h-4.5',
    },
    xl: {
      box: 'w-14 h-14 rounded-2xl',
      icon: 'w-7 h-7',
    },
  }[size];

  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 border shadow-2xs transition-transform ${sizeStyles.box} ${className}`}
      style={{
        backgroundColor: meta.bg,
        borderColor: meta.border,
        color: meta.color,
        ...style,
      }}
      title={meta.name}
      {...props}
    >
      <CategoryIcon
        name={meta.icon}
        className={sizeStyles.icon}
        color={meta.color}
      />
    </div>
  );
};
