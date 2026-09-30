import React from 'react';
import { getCategoryIcon } from '../../constants/categoryIcons.js';

interface CategoryIconProps {
  name?: string;
  className?: string;
  color?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name,
  className = 'w-5 h-5',
  color,
}) => {
  const IconComponent = getCategoryIcon(name);

  return (
    <IconComponent
      className={className}
      style={color ? { color } : undefined}
    />
  );
};
