import React from 'react';
import {
  Utensils,
  ShoppingBag,
  ShoppingCart,
  Car,
  Fuel,
  Zap,
  Home,
  Film,
  HeartPulse,
  GraduationCap,
  Plane,
  CreditCard,
  Briefcase,
  TrendingUp,
  Tag,
  DollarSign,
  Coffee,
  Users,
  Scissors,
  Banknote,
  HelpCircle,
  LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Utensils,
  ShoppingBag,
  ShoppingCart,
  Car,
  Fuel,
  Zap,
  Home,
  Film,
  HeartPulse,
  GraduationCap,
  Plane,
  CreditCard,
  Briefcase,
  TrendingUp,
  Tag,
  DollarSign,
  Coffee,
  Users,
  Scissors,
  Banknote,
};

interface CategoryIconProps {
  name?: string;
  className?: string;
  color?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name = 'Tag',
  className = 'w-5 h-5',
  color,
}) => {
  const IconComponent = iconMap[name] || HelpCircle;

  return (
    <IconComponent
      className={className}
      style={color ? { color } : undefined}
    />
  );
};
