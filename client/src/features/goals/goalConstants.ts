import {
  Target,
  Laptop,
  Plane,
  Car,
  House,
  GraduationCap,
  HeartPulse,
  Gift,
  ShieldCheck,
  Banknote,
  Smartphone,
  Bike,
  BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface GoalIconOption {
  name: string;
  label: string;
  icon: LucideIcon;
}

/** Goal identity options, all drawn from the existing lucide icon set. */
export const GOAL_ICONS: GoalIconOption[] = [
  { name: 'Target', label: 'Target', icon: Target },
  { name: 'Laptop', label: 'Laptop', icon: Laptop },
  { name: 'Plane', label: 'Travel', icon: Plane },
  { name: 'Car', label: 'Vehicle', icon: Car },
  { name: 'House', label: 'Home', icon: House },
  { name: 'GraduationCap', label: 'Education', icon: GraduationCap },
  { name: 'HeartPulse', label: 'Health', icon: HeartPulse },
  { name: 'ShieldCheck', label: 'Emergency', icon: ShieldCheck },
  { name: 'Banknote', label: 'Cash', icon: Banknote },
  { name: 'Gift', label: 'Lifestyle', icon: Gift },
  { name: 'Smartphone', label: 'Device', icon: Smartphone },
  { name: 'Bike', label: 'Commute', icon: Bike },
  { name: 'BookOpen', label: 'Learning', icon: BookOpen },
];

const ICON_MAP = new Map(GOAL_ICONS.map((item) => [item.name, item.icon]));

export function getGoalIcon(name?: string | null): LucideIcon {
  if (!name) return Target;
  return ICON_MAP.get(name) ?? Target;
}

/**
 * Palette reused from the app's existing semantic colors (brand emerald plus
 * the indigo / sky / amber / rose accents already used by transactions and
 * budgets). No new hues are introduced.
 */
export const GOAL_COLORS: string[] = [
  '#10b981', // brand-500 emerald
  '#059669', // brand-600
  '#0ea5e9', // sky-500
  '#6366f1', // indigo-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
];

export const DEFAULT_GOAL_COLOR = GOAL_COLORS[0];
export const DEFAULT_GOAL_ICON = GOAL_ICONS[0].name;
